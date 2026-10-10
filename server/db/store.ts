import fs from 'fs';
import path from 'path';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: number;
  artifactIds?: string[];
  artifacts?: Artifact[];
  agentSummary?: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  userPrompt: string;
  createdAt: number;
  updatedAt: number;
  status: 'idle' | 'analyzing' | 'waiting_clarification' | 'planning' | 'executing' | 'reviewing' | 'verifying' | 'replanning' | 'completed' | 'failed';
  conversation: ChatMessage[];
  finalResponse?: string;
  clarification?: {
    question: string;
    options?: string[];
    answered: boolean;
    answer?: string;
  };
  assumptions: string[];
  plan?: ExecutionPlan;
  activeAgents: string[];
  artifacts: Artifact[];
  metrics: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: number;
    durationMs: number;
    toolsInvokedCount: number;
    replanningCycles: number;
  };
}

export interface DAGNode {
  id: string;
  title: string;
  description: string;
  role: 'architect' | 'planner' | 'requirements' | 'researcher' | 'implementer' | 'reviewer' | 'verifier' | 'replanner';
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'replanned';
  inputs: Record<string, any>;
  expectedOutputs: string;
  acceptanceCriteria: string[];
  output?: {
    summary: string;
    details?: string;
    code?: string;
    calculations?: Record<string, any>;
    citations?: SourceCitation[];
    toolCalls?: any[];
  };
  verification?: {
    verified: boolean;
    verdict: 'passed' | 'failed' | 'needs_revision';
    findings: string[];
    testsRun?: { name: string; passed: boolean; output: string }[];
  };
  retryCount: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface ExecutionPlan {
  id: string;
  taskId: string;
  objective: string;
  version: number;
  nodes: DAGNode[];
  createdAt: number;
}

export interface SourceCitation {
  sourceType: 'web' | 'document' | 'calculation';
  sourceTitle: string;
  sourceUrl?: string;
  documentId?: string;
  location?: string;
  excerpt: string;
  verified: boolean;
}

export interface Artifact {
  id: string;
  taskId: string;
  title: string;
  filename: string;
  fileType: 'code' | 'markdown' | 'json' | 'text' | 'html' | 'csv' | 'python';
  language?: string;
  content: string;
  createdAt: number;
  updatedAt?: number;
  createdByAgent: string;
  sizeBytes: number;
  verifiedIntegrity: boolean;
  version: number;
}

export interface DocumentRecord {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: number;
  chunkCount: number;
  extractedTextLength: number;
  metadata: Record<string, any>;
}

export interface AuditEvent {
  id: string;
  taskId: string;
  timestamp: number;
  type: 'agent_start' | 'agent_thought' | 'agent_output' | 'tool_invoke' | 'tool_result' | 'clarification_requested' | 'clarification_answered' | 'verification_check' | 'replan_triggered' | 'task_completed' | 'task_failed';
  agentRole?: string;
  nodeId?: string;
  message: string;
  payload?: any;
}

class Store {
  private dataDir: string;
  private tasksFile: string;
  private docsFile: string;
  private artifactsFile: string;
  private eventsFile: string;

  private tasks: Map<string, TaskRecord> = new Map();
  private documents: Map<string, DocumentRecord> = new Map();
  private artifacts: Map<string, Artifact> = new Map();
  private events: AuditEvent[] = [];

  constructor(dataDir = './data') {
    this.dataDir = path.resolve(process.cwd(), dataDir);
    this.tasksFile = path.join(this.dataDir, 'tasks.json');
    this.docsFile = path.join(this.dataDir, 'documents.json');
    this.artifactsFile = path.join(this.dataDir, 'artifacts.json');
    this.eventsFile = path.join(this.dataDir, 'events.json');

    this.ensureDir();
    this.load();
  }

  private ensureDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.tasksFile)) {
        const raw = JSON.parse(fs.readFileSync(this.tasksFile, 'utf-8'));
        raw.forEach((t: TaskRecord) => {
          if (!t.conversation || t.conversation.length === 0) {
            t.conversation = [
              {
                id: `msg_${t.createdAt}_u`,
                sender: 'user',
                content: t.userPrompt,
                timestamp: t.createdAt,
              },
            ];
            if (t.status === 'completed') {
              t.conversation.push({
                id: `msg_${t.updatedAt}_a`,
                sender: 'assistant',
                content: t.finalResponse || `I have implemented and verified your request: **"${t.userPrompt}"**. The deliverable files are ready for download in the artifact preview panel below.`,
                timestamp: t.updatedAt,
                artifacts: t.artifacts,
                agentSummary: 'Multi-agent orchestration and verification completed.',
              });
            }
          }
          this.tasks.set(t.id, t);
        });
      }
      if (fs.existsSync(this.docsFile)) {
        const raw = JSON.parse(fs.readFileSync(this.docsFile, 'utf-8'));
        raw.forEach((d: DocumentRecord) => this.documents.set(d.id, d));
      }
      if (fs.existsSync(this.artifactsFile)) {
        const raw = JSON.parse(fs.readFileSync(this.artifactsFile, 'utf-8'));
        raw.forEach((a: Artifact) => this.artifacts.set(a.id, a));
      }
      if (fs.existsSync(this.eventsFile)) {
        this.events = JSON.parse(fs.readFileSync(this.eventsFile, 'utf-8'));
      }
    } catch (err) {
      console.error('[Store] Failed to load data from disk, initializing fresh:', err);
    }
  }

  private flushTasks() {
    try {
      fs.writeFileSync(this.tasksFile, JSON.stringify(Array.from(this.tasks.values()), null, 2));
    } catch (e) {
      console.error('[Store] flushTasks failed', e);
    }
  }

  private flushDocs() {
    try {
      fs.writeFileSync(this.docsFile, JSON.stringify(Array.from(this.documents.values()), null, 2));
    } catch (e) {
      console.error('[Store] flushDocs failed', e);
    }
  }

  private flushArtifacts() {
    try {
      fs.writeFileSync(this.artifactsFile, JSON.stringify(Array.from(this.artifacts.values()), null, 2));
    } catch (e) {
      console.error('[Store] flushArtifacts failed', e);
    }
  }

  private flushEvents() {
    try {
      // Keep recent 1000 events to prevent massive disk bloat
      const recent = this.events.slice(-1000);
      fs.writeFileSync(this.eventsFile, JSON.stringify(recent, null, 2));
    } catch (e) {
      console.error('[Store] flushEvents failed', e);
    }
  }

  // Tasks
  getTask(id: string): TaskRecord | undefined {
    return this.tasks.get(id);
  }

  listTasks(): TaskRecord[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  saveTask(task: TaskRecord): void {
    task.updatedAt = Date.now();
    this.tasks.set(task.id, task);
    this.flushTasks();
  }

  deleteTask(id: string): boolean {
    const res = this.tasks.delete(id);
    this.flushTasks();
    return res;
  }

  // Documents
  getDocument(id: string): DocumentRecord | undefined {
    return this.documents.get(id);
  }

  listDocuments(): DocumentRecord[] {
    return Array.from(this.documents.values()).sort((a, b) => b.uploadedAt - a.uploadedAt);
  }

  saveDocument(doc: DocumentRecord): void {
    this.documents.set(doc.id, doc);
    this.flushDocs();
  }

  deleteDocument(id: string): boolean {
    const res = this.documents.delete(id);
    this.flushDocs();
    return res;
  }

  // Artifacts
  getArtifact(id: string): Artifact | undefined {
    return this.artifacts.get(id);
  }

  getArtifactsForTask(taskId: string): Artifact[] {
    return Array.from(this.artifacts.values()).filter(a => a.taskId === taskId);
  }

  saveArtifact(artifact: Artifact): void {
    this.artifacts.set(artifact.id, artifact);
    this.flushArtifacts();
  }

  // Audit Events (append-only)
  appendEvent(event: AuditEvent): void {
    this.events.push(event);
    this.flushEvents();
  }

  getEventsForTask(taskId: string): AuditEvent[] {
    return this.events.filter(e => e.taskId === taskId);
  }
}

export const db = new Store();
