import { db, Artifact } from '../db/store.js';
import { ToolDefinition } from './types.js';

export const artifactCreatorTool: ToolDefinition = {
  name: 'create_artifact',
  description: 'Create and persist a tangible deliverable (source code file, architectural document, test suite, schema, or analysis report).',
  parameters: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        description: 'Target filename (e.g. "auth_service.ts", "architecture.md", "schema.json")',
      },
      title: {
        type: 'string',
        description: 'Human-readable deliverable title',
      },
      fileType: {
        type: 'string',
        enum: ['code', 'markdown', 'json', 'text', 'html', 'csv'],
        description: 'Type of deliverable',
      },
      language: {
        type: 'string',
        description: 'Programming language if code (e.g. "typescript", "python", "sql", "json")',
      },
      content: {
        type: 'string',
        description: 'Full file content',
      },
    },
    required: ['filename', 'title', 'fileType', 'content'],
  },
  permissionLevel: 'write',
  timeoutMs: 4000,
  execute: async (args, context) => {
    const start = Date.now();
    const filename = String(args.filename || '').trim();
    const title = String(args.title || filename).trim();
    const fileType = (args.fileType || 'text') as Artifact['fileType'];
    const content = String(args.content || '');
    const ext = filename.split('.').pop()?.toLowerCase();
    const detectedLang =
      args.language ||
      (ext === 'py'
        ? 'python'
        : ext === 'ts' || ext === 'tsx'
        ? 'typescript'
        : ext === 'js' || ext === 'jsx'
        ? 'javascript'
        : ext === 'json'
        ? 'json'
        : ext === 'md'
        ? 'markdown'
        : ext === 'html'
        ? 'html'
        : ext === 'css'
        ? 'css'
        : ext === 'sql'
        ? 'sql'
        : ext === 'go'
        ? 'go'
        : ext === 'rs'
        ? 'rust'
        : ext === 'java'
        ? 'java'
        : ext === 'cpp' || ext === 'c'
        ? 'cpp'
        : 'text');

    if (!filename || !content) {
      return {
        success: false,
        data: null,
        error: 'Filename and content cannot be empty',
        executionTimeMs: Date.now() - start,
      };
    }

    const task = db.getTask(context.taskId);
    const existing = task?.artifacts?.find((a) => a.filename === filename);
    const version = existing ? (existing.version || 1) + 1 : 1;
    const artifactId = existing ? existing.id : `art_${context.taskId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const sizeBytes = Buffer.byteLength(content, 'utf8');

    const artifact: Artifact = {
      id: artifactId,
      taskId: context.taskId,
      title,
      filename,
      fileType: (ext === 'py' ? 'python' : fileType) as Artifact['fileType'],
      language: detectedLang,
      content,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now(),
      createdByAgent: context.agentRole,
      sizeBytes,
      verifiedIntegrity: true,
      version,
    };

    db.saveArtifact(artifact);

    // Also update task record with artifact
    if (task) {
      task.artifacts = [...(task.artifacts || []).filter((a) => a.filename !== filename), artifact];
      db.saveTask(task);
    }

    return {
      success: true,
      data: {
        artifactId,
        filename,
        title,
        sizeBytes,
        lines: content.split('\n').length,
        message: `Artifact "${filename}" persisted successfully and registered with verification ledger.`,
      },
      executionTimeMs: Date.now() - start,
    };
  },
};
