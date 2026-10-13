import { LLMMessage, LLMProvider, LLMRequestOptions, LLMResponse, LLMToolCall } from './types.js';

function extractThinkingAndClean(rawContent: string, initialThinking = ''): { text: string; thinking?: string } {
  let thinking = initialThinking.trim();
  let content = rawContent || '';

  // 1. Extract closed <think>...</think>
  const thinkMatches = content.matchAll(/<think>([\s\S]*?)<\/think>/gi);
  for (const m of thinkMatches) {
    if (m[1]) {
      thinking = (thinking ? thinking + '\n\n' : '') + m[1].trim();
    }
  }
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Extract unclosed <think>... (occurs when output token limit cuts off generation)
  const unclosedThink = content.match(/<think>([\s\S]*)$/i);
  if (unclosedThink) {
    thinking = (thinking ? thinking + '\n\n' : '') + unclosedThink[1].trim();
    content = content.replace(/<think>([\s\S]*)$/i, '').trim();
  }

  // 3. Extract <thought> or <reasoning> tags
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

  // If content is empty because the model spent all tokens in thinking,
  // extract the final paragraph/conclusion from thinking as text so output does not end empty
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

export class OpenRouterProvider implements LLMProvider {
  public name = 'openrouter';
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel = 'openrouter/free') {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    this.defaultModel = defaultModel;
  }

  isAvailable(): boolean {
    return !!(this.apiKey && this.apiKey.trim().length > 0 && this.apiKey !== 'MY_OPENROUTER_API_KEY');
  }

  async generateText(messages: LLMMessage[], options: LLMRequestOptions = {}): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw new Error('OpenRouter API is not configured or OPENROUTER_API_KEY is missing');
    }

    const modelName = options.model || this.defaultModel;

    // Convert messages for OpenAI/OpenRouter format
    const formattedMessages = messages.map((m) => {
      const msgObj: any = { role: m.role, content: m.content };
      if (m.name) msgObj.name = m.name;
      if (m.toolCallId) msgObj.tool_call_id = m.toolCallId;
      if (m.toolCalls && m.toolCalls.length > 0) {
        msgObj.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
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
      max_tokens: options.maxTokens || 4000,
    };

    if (options.responseFormat === 'json') {
      payload.response_format = { type: 'json_object' };
      const hasWordJson = formattedMessages.some((m) => m.content && m.content.toLowerCase().includes('json'));
      if (!hasWordJson && formattedMessages.length > 0) {
        formattedMessages[formattedMessages.length - 1].content += ' Respond with a valid JSON object.';
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
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Autonomous Multi-Agent Development System',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        // If the requested free model is harness-gated (403), unavailable (404), or rate-limited (429), retry with openrouter/free
        if ((res.status === 403 || res.status === 404 || res.status === 429) && modelName !== 'openrouter/free') {
          console.warn(`[OpenRouter] Model ${modelName} returned ${res.status}. Falling back to dynamic router 'openrouter/free'...`);
          payload.model = 'openrouter/free';
          const retryRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
              'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
              'X-Title': 'Autonomous Multi-Agent Development System',
            },
            body: JSON.stringify(payload),
          });
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            const retryChoice = retryData.choices?.[0];
            const retryRaw = retryChoice?.message?.content || '';
            const retryReasoning = retryChoice?.message?.reasoning || retryChoice?.message?.reasoning_content || '';
            const cleaned = extractThinkingAndClean(retryRaw, retryReasoning);

            let retryText = cleaned.text;
            if (options.responseFormat === 'json') {
              retryText = retryText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            }

            return {
              text: retryText,
              thinking: cleaned.thinking,
              usage: {
                promptTokens: retryData.usage?.prompt_tokens || 100,
                completionTokens: retryData.usage?.completion_tokens || 100,
                totalTokens: (retryData.usage?.prompt_tokens || 100) + (retryData.usage?.completion_tokens || 100),
                estimatedCostUsd: 0,
              },
              provider: 'openrouter',
              model: retryData.model || 'openrouter/free',
              finishReason: retryChoice?.finish_reason,
            };
          }
        }
        throw new Error(`OpenRouter API error (${res.status}): ${errorText}`);
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

      // Free models on OpenRouter cost $0
      const isFreeModel = modelName.endsWith(':free') || modelName.includes('/free');
      const estimatedCostUsd = isFreeModel ? 0 : Number(((promptTokens * 0.0000001) + (completionTokens * 0.0000002)).toFixed(6));

      return {
        text,
        thinking: cleaned.thinking,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd,
        },
        provider: 'openrouter',
        model: modelName,
        finishReason: choice?.finish_reason,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
