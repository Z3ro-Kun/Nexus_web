import { Artifact, DAGNode, SourceCitation } from '../db/store.js';

export type AgentRoleName =
  | 'architect'
  | 'planner'
  | 'requirements'
  | 'researcher'
  | 'implementer'
  | 'reviewer'
  | 'verifier'
  | 'replanner';

export interface AgentContext {
  taskId: string;
  userPrompt: string;
  assumptions: string[];
  currentNode?: DAGNode;
  allNodes?: DAGNode[];
  completedNodeOutputs?: Record<string, any>;
  artifacts?: Artifact[];
  documentEvidence?: string;
  citations?: SourceCitation[];
  conversationHistory?: any[];
  isFollowUp?: boolean;
  latestFollowUp?: string;
}

export interface AgentResult {
  role: AgentRoleName;
  summary: string;
  details?: string;
  data?: any;
  artifactsCreated?: string[];
  toolCallsMade?: any[];
  citations?: SourceCitation[];
  verdict?: 'passed' | 'failed' | 'needs_revision';
  confidence?: number;
  clarificationNeeded?: boolean;
  clarificationQuestion?: string;
  clarificationOptions?: string[];
}
