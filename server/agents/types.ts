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

/**
 * Determines whether a user prompt asks for or requires a tangible file / code deliverable,
 * as opposed to an informational question, conceptual explanation, or Q&A.
 * Artifacts are ONLY created when explicitly asked/needed.
 */
export function isArtifactNeeded(prompt: string): boolean {
  if (!prompt || typeof prompt !== 'string') return false;
  const p = prompt.toLowerCase().trim();

  // If asking about previous conversation, history, or what was asked before, NEVER create artifacts
  if (/\b(what (did|have) i (ask|say)|tell me what i (asked|said)|previous question|conversation history|what was my last)\b/i.test(p)) {
    return false;
  }

  // Purely conceptual, explanatory, or informational queries
  const isExplanationOrQuestion =
    /^(what\b|how\b|why\b|explain\b|describe\b|tell me\b|can you explain\b|help me understand\b|difference between\b|compare\b|is there\b|who\b|when\b|which\b|where\b)/i.test(p);

  // Explicit instruction to generate a code file or downloadable deliverable
  const explicitFileGeneration =
    /\b(write|create|generate|implement|build|produce|give me|output)\s+(a|an|the|some)?\s*(clean\s+|runnable\s+|working\s+)?(code|script|sql|python|typescript|javascript|bash|query|program|application|component|file|deliverable)\b/i.test(p) ||
    /\b(sql code|sql query file|python script|bash script|typescript file|tsx file|html file|json file)\b/i.test(p) ||
    /\b(download|save as|export to|persisted in)\b/i.test(p) ||
    (/\bleetcode\s*\d+\b/i.test(p) && /\b(code|sql|python|query|solution file|script)\b/i.test(p));

  // If it's a question/explanation and not an explicit file creation request, no artifact
  if (isExplanationOrQuestion && !explicitFileGeneration) {
    return false;
  }

  return Boolean(explicitFileGeneration);
}
