import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  passwordHash?: string;
  salt?: string;
  avatarColor: string;
  createdAt: number;
  lastLoginAt?: number;
}

export interface SafeUserRecord {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  createdAt: number;
  lastLoginAt?: number;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export interface ToolCallRecord {
  tool: string;
  query?: string;
  url?: string;
  statusCode?: number;
  extractedLength?: number;
  args?: Record<string, any>;
  summary?: string;
  success: boolean;
  durationMs?: number;
  results?: Array<{ title: string; url: string; snippet?: string }>;
  excerpt?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  thinking?: string;
  timestamp: number;
  artifactIds?: string[];
  artifacts?: Artifact[];
  agentSummary?: string;
  toolCalls?: ToolCallRecord[];
  citations?: SourceCitation[];
}

export interface TaskRecord {
  id: string;
  userId?: string;
  sessionId?: string;
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
  toolCalls?: ToolCallRecord[];
  citations?: SourceCitation[];
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
  private usersFile: string;
  private sessionsFile: string;
  private tasksFile: string;
  private docsFile: string;
  private artifactsFile: string;
  private eventsFile: string;

  private users: Map<string, UserRecord> = new Map();
  private sessions: Map<string, SessionRecord> = new Map();
  private tasks: Map<string, TaskRecord> = new Map();
  private documents: Map<string, DocumentRecord> = new Map();
  private artifacts: Map<string, Artifact> = new Map();
  private events: AuditEvent[] = [];

  constructor(dataDir = './data') {
    this.dataDir = path.resolve(process.cwd(), dataDir);
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.sessionsFile = path.join(this.dataDir, 'sessions.json');
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

  private hashPassword(password: string, salt: string): string {
    return crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
  }

  private load() {
    try {
      if (fs.existsSync(this.usersFile)) {
        const raw = JSON.parse(fs.readFileSync(this.usersFile, 'utf-8'));
        raw.forEach((u: UserRecord) => this.users.set(u.id, u));
      }

      // Seed User 1 (id: user_a)
      let userA = this.users.get('user_a');
      if (!userA) {
        const salt = crypto.randomBytes(16).toString('hex');
        userA = {
          id: 'user_a',
          username: 'user_1',
          displayName: 'User 1',
          avatarColor: '#06b6d4',
          createdAt: 1700000000000,
          salt,
          passwordHash: this.hashPassword('password123', salt),
        };
        this.users.set(userA.id, userA);
      } else if (!userA.passwordHash) {
        userA.salt = crypto.randomBytes(16).toString('hex');
        userA.passwordHash = this.hashPassword('password123', userA.salt);
        if (userA.username === 'user_a') userA.displayName = 'User 1';
      }

      // Seed User 2 (id: user_b)
      let userB = this.users.get('user_b');
      if (!userB) {
        const salt = crypto.randomBytes(16).toString('hex');
        userB = {
          id: 'user_b',
          username: 'user_2',
          displayName: 'User 2',
          avatarColor: '#ec4899',
          createdAt: 1700000001000,
          salt,
          passwordHash: this.hashPassword('password123', salt),
        };
        this.users.set(userB.id, userB);
      } else if (!userB.passwordHash) {
        userB.salt = crypto.randomBytes(16).toString('hex');
        userB.passwordHash = this.hashPassword('password123', userB.salt);
        if (userB.username === 'user_b') userB.displayName = 'User 2';
      }
      this.flushUsers();

      // Load sessions
      if (fs.existsSync(this.sessionsFile)) {
        try {
          const rawSessions = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf-8'));
          const now = Date.now();
          rawSessions.forEach((s: SessionRecord) => {
            if (s.expiresAt > now) {
              this.sessions.set(s.token, s);
            }
          });
        } catch (e) {
          console.warn('[Store] Failed to parse sessionsFile', e);
        }
      }

      if (fs.existsSync(this.tasksFile)) {
        const raw = JSON.parse(fs.readFileSync(this.tasksFile, 'utf-8'));
        raw.forEach((t: TaskRecord) => {
          if (!t.userId) {
            t.userId = 'user_a';
          }
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

  private flushUsers() {
    try {
      fs.writeFileSync(this.usersFile, JSON.stringify(Array.from(this.users.values()), null, 2));
    } catch (e) {
      console.error('[Store] flushUsers failed', e);
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

  private flushSessions() {
    try {
      fs.writeFileSync(this.sessionsFile, JSON.stringify(Array.from(this.sessions.values()), null, 2));
    } catch (e) {
      console.error('[Store] flushSessions failed', e);
    }
  }

  // Users & Auth
  toSafeUser(user: UserRecord): SafeUserRecord {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  getUser(id: string): UserRecord | undefined {
    return this.users.get(id);
  }

  getSafeUser(id: string): SafeUserRecord | undefined {
    const user = this.users.get(id);
    return user ? this.toSafeUser(user) : undefined;
  }

  getUserByUsername(username: string): UserRecord | undefined {
    const lower = username.toLowerCase().trim();
    // Also handle alias user_a <=> user_1, user_b <=> user_2
    for (const u of this.users.values()) {
      if (u.username.toLowerCase() === lower || u.id.toLowerCase() === lower) {
        return u;
      }
      if ((lower === 'user_1' || lower === 'user_a') && (u.id === 'user_a' || u.username === 'user_1' || u.username === 'user_a')) {
        return u;
      }
      if ((lower === 'user_2' || lower === 'user_b') && (u.id === 'user_b' || u.username === 'user_2' || u.username === 'user_b')) {
        return u;
      }
    }
    return undefined;
  }

  createSession(userId: string): SessionRecord {
    // 30 days expiration
    const token = `sess_${crypto.randomBytes(24).toString('hex')}`;
    const session: SessionRecord = {
      token,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    this.sessions.set(token, session);
    this.flushSessions();
    return session;
  }

  validateSession(token: string): SafeUserRecord | null {
    if (!token || typeof token !== 'string') return null;
    const session = this.sessions.get(token.trim());
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      this.flushSessions();
      return null;
    }
    const user = this.users.get(session.userId);
    if (!user) return null;
    return this.toSafeUser(user);
  }

  deleteSession(token: string): boolean {
    const res = this.sessions.delete(token);
    if (res) this.flushSessions();
    return res;
  }

  loginUser(username: string, password: string): { user: SafeUserRecord; token: string } {
    const user = this.getUserByUsername(username);
    if (!user) {
      throw new Error('Invalid username or password');
    }
    if (!user.passwordHash || !user.salt) {
      // Set default password if none was previously configured
      user.salt = crypto.randomBytes(16).toString('hex');
      user.passwordHash = this.hashPassword(password, user.salt);
      this.flushUsers();
    } else {
      const computed = this.hashPassword(password, user.salt);
      if (computed !== user.passwordHash) {
        throw new Error('Invalid username or password');
      }
    }
    user.lastLoginAt = Date.now();
    this.flushUsers();
    const session = this.createSession(user.id);
    return { user: this.toSafeUser(user), token: session.token };
  }

  registerUser(username: string, password: string, displayName?: string): { user: SafeUserRecord; token: string } {
    const cleanUser = username.trim().toLowerCase();
    if (cleanUser.length < 3) {
      throw new Error('Username must be at least 3 characters');
    }
    if (password.length < 4) {
      throw new Error('Password must be at least 4 characters');
    }
    const existing = this.getUserByUsername(cleanUser);
    if (existing) {
      throw new Error('A user with that username or ID already exists');
    }

    const colors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
    const color = colors[this.users.size % colors.length];
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = this.hashPassword(password, salt);

    const newUser: UserRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      username: cleanUser,
      displayName: (displayName || username).trim(),
      avatarColor: color,
      createdAt: Date.now(),
      salt,
      passwordHash,
      lastLoginAt: Date.now(),
    };
    this.users.set(newUser.id, newUser);
    this.flushUsers();

    const session = this.createSession(newUser.id);
    return { user: this.toSafeUser(newUser), token: session.token };
  }

  createUser(username: string, displayName?: string): UserRecord {
    const existing = this.getUserByUsername(username);
    if (existing) return existing;

    const colors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];
    const color = colors[this.users.size % colors.length];

    const salt = crypto.randomBytes(16).toString('hex');
    const newUser: UserRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      username: username.trim(),
      displayName: (displayName || username).trim(),
      avatarColor: color,
      createdAt: Date.now(),
      salt,
      passwordHash: this.hashPassword('password123', salt),
    };
    this.users.set(newUser.id, newUser);
    this.flushUsers();
    return newUser;
  }

  // Tasks (Scoped by User / Session)
  getTask(id: string, userId?: string): TaskRecord | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    if (userId && task.userId && task.userId !== userId) {
      return undefined;
    }
    return task;
  }

  listTasks(userId?: string): TaskRecord[] {
    const all = Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
    if (!userId) return all;
    return all.filter((t) => t.userId === userId);
  }

  saveTask(task: TaskRecord): void {
    if (!task.userId) task.userId = 'user_a';
    task.updatedAt = Date.now();
    this.tasks.set(task.id, task);
    this.flushTasks();
  }

  deleteTask(id: string, userId?: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    if (userId && task.userId && task.userId !== userId) {
      return false;
    }
    const res = this.tasks.delete(id);
    if (res) {
      // Also clean up associated artifacts and events
      for (const [artId, art] of Array.from(this.artifacts.entries())) {
        if (art.taskId === id) {
          this.artifacts.delete(artId);
        }
      }
      this.events = this.events.filter((e) => e.taskId !== id);
      this.flushTasks();
      this.flushArtifacts();
      this.flushEvents();
    }
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
