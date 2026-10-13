import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { LLMMessage, LLMProvider, LLMRequestOptions, LLMResponse, LLMToolCall } from './types.js';

export class GeminiProvider implements LLMProvider {
  public name = 'gemini';
  private ai: GoogleGenAI | null = null;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel = 'gemini-3.6-flash') {
    const key = apiKey || process.env.GEMINI_API_KEY || '';
    this.defaultModel = defaultModel;
    if (key && key !== 'MY_GEMINI_API_KEY') {
      try {
        this.ai = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
      } catch (err) {
        console.warn('[GeminiProvider] Initialization warning:', err);
      }
    }
  }

  isAvailable(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!(this.ai && key && key !== 'MY_GEMINI_API_KEY');
  }

  async generateText(messages: LLMMessage[], options: LLMRequestOptions = {}): Promise<LLMResponse> {
    if (!this.ai || !this.isAvailable()) {
      throw new Error('Gemini API is not configured or GEMINI_API_KEY is not set');
    }

    let modelName = options.model || this.defaultModel;
    if (modelName === 'gemini-3.8-flash') {
      modelName = 'gemini-3.6-flash';
    }

    // Convert LLM messages to contents
    let systemInstruction = options.systemInstruction || '';
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction += (systemInstruction ? '\n' : '') + msg.content;
      } else if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        const parts: any[] = [];
        if (msg.content) parts.push({ text: msg.content });
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            parts.push({
              functionCall: {
                name: tc.name,
                args: tc.arguments,
              },
            });
          }
        }
        contents.push({ role: 'model', parts });
      } else if (msg.role === 'tool') {
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: msg.name || 'tool_response',
                response: { output: msg.content },
              },
            },
          ],
        });
      }
    }

    // Build configuration
    const config: any = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (typeof options.temperature === 'number') {
      config.temperature = options.temperature;
    }
    if (options.responseFormat === 'json') {
      config.responseMimeType = 'application/json';
    }

    // Tools
    if (options.tools && options.tools.length > 0) {
      const functionDeclarations: FunctionDeclaration[] = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: Type.OBJECT,
          properties: t.parameters.properties || {},
          required: t.parameters.required || [],
        },
      }));
      config.tools = [{ functionDeclarations }];
    }

    // Timeout wrapper - 15s to allow fast fallback on 503 / network spike
    const timeoutMs = options.timeoutMs || 15000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    const callPromise = this.ai.models.generateContent({
      model: modelName,
      contents: contents.length > 0 ? contents : [{ parts: [{ text: 'Hello' }] }],
      config,
    });

    const response = await Promise.race([callPromise, timeoutPromise]);
    const textOutput = response.text || '';

    // Extract tool calls if any
    const toolCalls: LLMToolCall[] = [];
    const fcList = response.functionCalls;
    if (fcList && Array.isArray(fcList)) {
      for (let i = 0; i < fcList.length; i++) {
        const fc = fcList[i];
        toolCalls.push({
          id: `call_${Date.now()}_${i}`,
          name: fc.name || 'unnamed_tool',
          arguments: (fc.args as Record<string, any>) || {},
        });
      }
    }

    // Extract token usage or fallback estimate
    const usageMetadata = (response as any).usageMetadata;
    const promptTokens = usageMetadata?.promptTokenCount || Math.ceil(JSON.stringify(messages).length / 4);
    const completionTokens = usageMetadata?.candidatesTokenCount || Math.ceil(textOutput.length / 4);
    const totalTokens = promptTokens + completionTokens;

    // Estimate cost based on standard Gemini 2.5/3.8 Flash rates ($0.075 / 1M prompt, $0.30 / 1M completion)
    const estimatedCostUsd = (promptTokens * 0.000000075) + (completionTokens * 0.0000003);

    return {
      text: textOutput,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
      },
      provider: 'gemini',
      model: modelName,
      finishReason: (response as any).candidates?.[0]?.finishReason,
    };
  }
}
