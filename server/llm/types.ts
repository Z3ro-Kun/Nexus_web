export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface LLMRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
  tools?: LLMToolDefinition[];
  responseFormat?: 'json' | 'text';
  responseSchema?: any;
  timeoutMs?: number;
}

export interface LLMResponse {
  text: string;
  toolCalls?: LLMToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  provider: string;
  model: string;
  finishReason?: string;
}

export interface LLMProvider {
  name: string;
  isAvailable(): boolean;
  generateText(messages: LLMMessage[], options?: LLMRequestOptions): Promise<LLMResponse>;
}
