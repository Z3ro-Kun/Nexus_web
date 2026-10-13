import { LLMMessage, LLMProvider, LLMRequestOptions, LLMResponse, LLMToolCall } from './types.js';

function extractThinkingAndClean(rawContent: string, initialThinking = ''): { text: string; thinking?: string } {
  let thinking = initialThinking.trim();
  let content = rawContent || '';

  const thinkMatches = content.matchAll(/<think>([\s\S]*?)<\/think>/gi);
  for (const m of thinkMatches) {
    if (m[1]) {
      thinking = (thinking ? thinking + '\n\n' : '') + m[1].trim();
    }
  }
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const unclosedThink = content.match(/<think>([\s\S]*)$/i);
  if (unclosedThink) {
    thinking = (thinking ? thinking + '\n\n' : '') + unclosedThink[1].trim();
    content = content.replace(/<think>([\s\S]*)$/i, '').trim();
  }

  content = content.replace(/<(?:thought|reasoning)>([\s\S]*?)<\/(?:thought|reasoning)>/gi, (_, body) => {
    thinking = (thinking ? thinking + '\n\n' : '') + body.trim();
    return '';
  }).trim();
  const unclosedThought = content.match(/<(?:thought|reasoning)>([\s\S]*)$/i);
  if (unclosedThought) {
    thinking = (thinking ? thinking + '\n\n' : '') + unclosedThought[1].trim();
    content = content.replace(/<(?:thought|reasoning)>([\s\S]*)$/i, '').trim();
  }

  content = content.replace(/^(?:User Safety:\s*safe\s*)+/i, '').trim();

  let text = content;
  if (!text && thinking) {
    const paragraphs = thinking.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    text = paragraphs[paragraphs.length - 1] || thinking;
  }

  return {
    text: text.trim(),
    thinking: thinking.trim() || undefined,
  };
}

export class GroqProvider implements LLMProvider {
  public name = 'groq';
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel = 'llama-3.3-70b-versatile') {
    this.apiKey = apiKey || process.env.GROQ_API_KEY || '';
    this.defaultModel = defaultModel;
  }

  isAvailable(): boolean {
    return !!(this.apiKey && this.apiKey !== 'MY_GROQ_API_KEY');
  }

  async generateText(messages: LLMMessage[], options: LLMRequestOptions = {}): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw new Error('Groq API is not configured or GROQ_API_KEY is missing');
    }

    const modelName = options.model || this.defaultModel;

    // Convert messages for OpenAI format
    const formattedMessages = messages.map((m) => {
      const msgObj: any = { role: m.role, content: m.content };
      if (m.name) msgObj.name = m.name;
      if (m.toolCallId) msgObj.tool_call_id = m.toolCallId;
      if (m.toolCalls) {
        msgObj.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));
      }
      return msgObj;
    });

    if (options.systemInstruction) {
      formattedMessages.unshift({
        role: 'system',
        content: options.systemInstruction,
      });
    }

    const payload: any = {
      model: modelName,
      messages: formattedMessages,
      temperature: options.temperature ?? 0.2,
    };

    if (options.responseFormat === 'json') {
      payload.response_format = { type: 'json_object' };
      const hasWordJson = formattedMessages.some((m) => m.content && m.content.toLowerCase().includes('json'));
      if (!hasWordJson && formattedMessages.length > 0) {
        formattedMessages[0].content += ' Respond in valid JSON format.';
      }
    }

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 45000);

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Groq API error (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const rawContent = choice?.message?.content || '';
      const initialReasoning = choice?.message?.reasoning || choice?.message?.reasoning_content || '';
      const cleaned = extractThinkingAndClean(rawContent, initialReasoning);

      let text = cleaned.text;
      if (options.responseFormat === 'json') {
        text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      }

      const toolCalls: LLMToolCall[] = [];
      if (choice?.message?.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            parsedArgs = { raw: tc.function.arguments };
          }
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: parsedArgs,
          });
        }
      }

      const promptTokens = data.usage?.prompt_tokens || Math.ceil(JSON.stringify(messages).length / 4);
      const completionTokens = data.usage?.completion_tokens || Math.ceil(text.length / 4);
      const totalTokens = promptTokens + completionTokens;
      const estimatedCostUsd = (promptTokens * 0.00000059) + (completionTokens * 0.00000079);

      return {
        text,
        thinking: cleaned.thinking,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
        },
        provider: 'groq',
        model: modelName,
        finishReason: choice?.finish_reason,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
