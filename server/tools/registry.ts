import { calculatorTool } from './calculator.js';
import { codeExecutorTool } from './codeExecutor.js';
import { documentRetrieverTool } from './documentRetriever.js';
import { artifactCreatorTool } from './artifactCreator.js';
import { webSearchTool, httpFetchTool } from './webSearch.js';
import { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from './types.js';
import { LLMToolDefinition } from '../llm/types.js';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.register(calculatorTool);
    this.register(webSearchTool);
    this.register(httpFetchTool);
    this.register(documentRetrieverTool);
    this.register(codeExecutorTool);
    this.register(artifactCreatorTool);
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  // Get tools permitted for a specific agent role
  getToolsForRole(role: string): ToolDefinition[] {
    switch (role) {
      case 'architect':
        return [this.get('create_artifact')!, this.get('document_retriever')!].filter(Boolean);
      case 'researcher':
        return [this.get('web_search')!, this.get('http_fetch')!, this.get('document_retriever')!].filter(Boolean);
      case 'implementer':
        return [
          this.get('calculator')!,
          this.get('create_artifact')!,
          this.get('code_executor')!,
          this.get('document_retriever')!,
        ].filter(Boolean);
      case 'verifier':
        return [
          this.get('code_executor')!,
          this.get('calculator')!,
          this.get('document_retriever')!,
        ].filter(Boolean);
      case 'reviewer':
        return [this.get('document_retriever')!].filter(Boolean);
      default:
        return this.list();
    }
  }

  getLLMDefinitionsForRole(role: string): LLMToolDefinition[] {
    const roleTools = this.getToolsForRole(role);
    return roleTools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: t.parameters.properties,
        required: t.parameters.required,
      },
    }));
  }

  async invoke(
    toolName: string,
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        data: null,
        error: `Tool "${toolName}" is not registered in the system`,
        executionTimeMs: 0,
      };
    }

    // Validate required arguments
    const required = tool.parameters.required || [];
    for (const req of required) {
      if (args[req] === undefined || args[req] === null || args[req] === '') {
        return {
          success: false,
          data: null,
          error: `Missing required argument "${req}" for tool "${toolName}"`,
          executionTimeMs: 0,
        };
      }
    }

    // Timeout envelope
    const timeoutMs = tool.timeoutMs || 15000;
    const timeoutPromise = new Promise<ToolExecutionResult>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool "${toolName}" execution timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    try {
      return await Promise.race([tool.execute(args, context), timeoutPromise]);
    } catch (err: any) {
      return {
        success: false,
        data: null,
        error: `Execution failure in ${toolName}: ${err.message}`,
        executionTimeMs: timeoutMs,
      };
    }
  }
}

export const toolRegistry = new ToolRegistry();
