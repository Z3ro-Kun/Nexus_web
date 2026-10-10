export interface ToolParameterSchema {
  type: string;
  description: string;
  enum?: string[];
  properties?: Record<string, any>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterSchema>;
    required?: string[];
  };
  permissionLevel: 'read' | 'execute' | 'write' | 'admin';
  timeoutMs: number;
  requiresHumanApproval?: boolean;
  execute: (args: Record<string, any>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}

export interface ToolExecutionContext {
  taskId: string;
  nodeId?: string;
  agentRole: string;
  untrustedDataSources?: string[];
}

export interface ToolExecutionResult {
  success: boolean;
  data: any;
  error?: string;
  evidence?: {
    source: string;
    url?: string;
    location?: string;
    excerpt?: string;
    untrusted: boolean;
  };
  executionTimeMs: number;
}
