import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './server/config.js';
import { db, DocumentRecord, SafeUserRecord } from './server/db/store.js';
import { OrchestrationEngine } from './server/orchestrator/engine.js';
import { eventHub } from './server/orchestrator/events.js';
import { DocumentParser } from './server/rag/parser.js';
import { DocumentChunker } from './server/rag/chunker.js';
import { globalIndexer } from './server/rag/indexer.js';
import { llmRouter } from './server/llm/router.js';
import { toolRegistry } from './server/tools/registry.js';
import { SystemTestSuite } from './server/tests/suite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  const port = config.port;

  // JSON payload parser with generous limit for document uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Index existing documents on startup
  const existingDocs = db.listDocuments();
  for (const doc of existingDocs) {
    try {
      const docPath = path.join(db['dataDir'] || './data', `doc_${doc.id}`);
      if (fs.existsSync(docPath)) {
        const content = fs.readFileSync(docPath);
        const parsed = DocumentParser.parse(doc.filename, content, doc.mimeType);
        const chunks = DocumentChunker.chunk(doc.id, parsed);
        globalIndexer.addChunks(chunks);
      }
    } catch (e) {
      console.warn(`[Server] Failed to re-index document ${doc.id}:`, e);
    }
  }

  function getSessionToken(req: express.Request): string | undefined {
    const authHeader = req.headers['authorization'] as string;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) return token;
    }
    const headerToken = req.headers['x-session-token'] as string;
    if (headerToken && headerToken.trim()) return headerToken.trim();
    const queryToken = req.query.sessionToken as string || req.query.token as string;
    if (queryToken && queryToken.trim()) return queryToken.trim();
    return undefined;
  }

  function getAuthenticatedUser(req: express.Request): SafeUserRecord | null {
    const token = getSessionToken(req);
    if (token) {
      const validated = db.validateSession(token);
      if (validated) return validated;
    }
    // Fallback for dev / header
    const legacyUserId = req.headers['x-user-id'] as string;
    if (legacyUserId && legacyUserId.trim()) {
      const safe = db.getSafeUser(legacyUserId.trim());
      if (safe) return safe;
    }
    return null;
  }

  function requireAuth(req: express.Request, res: express.Response): SafeUserRecord | null {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return null;
    }
    return user;
  }

  // --- API Routes ---

  // Auth & Session Management
  app.post('/api/auth/register', (req, res) => {
    const { username, password, displayName } = req.body;
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username/ID is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    try {
      const result = db.registerUser(username, password, displayName);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'Username/ID is required' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }
    try {
      const result = db.loginUser(username, password);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = getSessionToken(req);
    if (token) {
      db.deleteSession(token);
    }
    res.json({ success: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json(user);
  });

  // Health and System Config
  app.get('/api/system/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      providers: llmRouter.getAvailableProviders(),
      registeredToolsCount: toolRegistry.list().length,
      indexedChunksCount: globalIndexer.getChunkCount(),
    });
  });

  app.get('/api/system/config', (req, res) => {
    res.json({
      providers: llmRouter.getAvailableProviders(),
      defaultProvider: config.defaultProvider,
      geminiModel: config.geminiModel,
      openrouterModel: config.openrouterModel,
      groqModel: config.groqModel,
      roleModels: config.roleModels,
      tools: toolRegistry.list().map((t) => ({
        name: t.name,
        description: t.description,
        permissionLevel: t.permissionLevel,
        parameters: t.parameters,
      })),
    });
  });

  // Task Management (Session / User Scoped)
  app.get('/api/tasks', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const tasks = db.listTasks(user.id);
    res.json(tasks);
  });

  app.post('/api/tasks', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Task prompt cannot be empty' });
    }

    try {
      const task = await OrchestrationEngine.submitTask(prompt.trim(), { userId: user.id });
      res.json(task);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tasks/:id', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const task = db.getTask(req.params.id, user.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied for this user session' });
    }
    const artifacts = db.getArtifactsForTask(req.params.id);
    const events = db.getEventsForTask(req.params.id);
    res.json({
      ...task,
      artifacts,
      events,
    });
  });

  app.delete('/api/tasks/:id', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const taskId = req.params.id;
    const deleted = db.deleteTask(taskId, user.id);
    res.json({ success: deleted });
  });

  // Real-Time Server-Sent Events (SSE) Stream
  app.get('/api/tasks/:id/events', (req, res) => {
    const token = (req.query.token as string) || (req.headers['x-session-token'] as string);
    const user = token ? db.validateSession(token) : getAuthenticatedUser(req);
    const taskId = req.params.id;
    const task = db.getTask(taskId, user?.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send existing events first
    const existingEvents = db.getEventsForTask(taskId);
    for (const evt of existingEvents) {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    }

    // If task is already completed or failed, finish stream cleanly so client does not reconnect
    if (task.status === 'completed' || task.status === 'failed') {
      res.end();
      return;
    }

    const keepAlive = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': keepalive\n\n');
      }
    }, 15000);

    const unsubscribe = eventHub.subscribe(taskId, res);

    req.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
      res.end();
    });
  });

  // Clarification Q&A Flow
  app.post('/api/tasks/:id/clarify', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const task = db.getTask(req.params.id, user.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }
    const { answer } = req.body;
    if (!answer || typeof answer !== 'string') {
      return res.status(400).json({ error: 'Answer is required' });
    }

    try {
      const updated = await OrchestrationEngine.answerClarification(req.params.id, answer.trim());
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Follow-Up Request in Conversation
  app.post('/api/tasks/:id/follow-up', async (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const task = db.getTask(req.params.id, user.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Follow-up prompt cannot be empty' });
    }

    try {
      const updated = await OrchestrationEngine.submitFollowUp(req.params.id, prompt.trim());
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Cancel Task
  app.post('/api/tasks/:id/cancel', (req, res) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const task = db.getTask(req.params.id, user.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }
    OrchestrationEngine.cancelTask(req.params.id);
    res.json({ success: true, message: 'Task cancelled' });
  });

  // Documents: Upload & Ingestion
  app.post('/api/documents/upload', (req, res) => {
    try {
      const { filename, contentBase64, contentText, mimeType } = req.body;
      if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
      }

      const fileBuffer = contentBase64
        ? Buffer.from(contentBase64, 'base64')
        : Buffer.from(contentText || '', 'utf-8');

      const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const parsed = DocumentParser.parse(filename, fileBuffer, mimeType);
      const chunks = DocumentChunker.chunk(docId, parsed);

      // Save document file to disk
      const storageDir = path.resolve(process.cwd(), config.storageDir);
      if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
      fs.writeFileSync(path.join(storageDir, `doc_${docId}`), fileBuffer);

      // Index chunks in global RAG indexer
      globalIndexer.addChunks(chunks);

      const record: DocumentRecord = {
        id: docId,
        filename,
        originalName: filename,
        mimeType: mimeType || 'text/plain',
        fileSize: fileBuffer.length,
        uploadedAt: Date.now(),
        chunkCount: chunks.length,
        extractedTextLength: parsed.rawText.length,
        metadata: {
          format: parsed.format,
          sections: parsed.sections.length,
          ...parsed.metadata,
        },
      };

      db.saveDocument(record);

      res.json({
        success: true,
        document: record,
        chunksPreview: chunks.slice(0, 3),
      });
    } catch (err: any) {
      res.status(500).json({ error: `Upload processing failed: ${err.message}` });
    }
  });

  app.get('/api/documents', (req, res) => {
    res.json(db.listDocuments());
  });

  app.delete('/api/documents/:id', (req, res) => {
    const docId = req.params.id;
    globalIndexer.removeDocument(docId);
    db.deleteDocument(docId);
    res.json({ success: true });
  });

  // Artifacts
  app.get('/api/artifacts/:id', (req, res) => {
    const artifact = db.getArtifact(req.params.id);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    res.json(artifact);
  });

  // Automated Test Suite Runner
  app.post('/api/tests/run', async (req, res) => {
    try {
      const report = await SystemTestSuite.runAll();
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware in development vs static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Autonomous Multi-Agent System] Server running on http://0.0.0.0:${port}`);
  });
}

createServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
