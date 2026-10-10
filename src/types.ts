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
  status:
    | 'idle'
    | 'analyzing'
    | 'waiting_clarification'
    | 'planning'
    | 'executing'
    | 'reviewing'
    | 'verifying'
    | 'replanning'
    | 'completed'
    | 'failed';
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
  events?: AuditEvent[];
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
  fileType: 'code' | 'markdown' | 'json' | 'text' | 'html' | 'csv';
  language?: string;
  content: string;
  createdAt: number;
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
  type:
    | 'agent_start'
    | 'agent_thought'
    | 'agent_output'
    | 'tool_invoke'
    | 'tool_result'
    | 'clarification_requested'
    | 'clarification_answered'
    | 'verification_check'
    | 'replan_triggered'
    | 'task_completed'
    | 'task_failed';
  agentRole?: string;
  nodeId?: string;
  message: string;
  payload?: any;
}

export interface TestCaseResult {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: string;
}

export interface TestSuiteReport {
  timestamp: number;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  durationMs: number;
  results: TestCaseResult[];
}

export interface SystemConfig {
  providers: { id: string; name: string; available: boolean; defaultModel: string }[];
  defaultProvider: string;
  geminiModel: string;
  groqModel: string;
  roleModels: Record<string, any>;
  tools: {
    name: string;
    description: string;
    permissionLevel: string;
    parameters: any;
  }[];
}
