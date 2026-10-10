import { config, ModelConfig } from '../config.js';
import { GeminiProvider } from './gemini.js';
import { GroqProvider } from './groq.js';
import { MockProvider } from './mock.js';
import { LLMMessage, LLMProvider, LLMRequestOptions, LLMResponse } from './types.js';

export class LLMRouter {
  private gemini: GeminiProvider;
  private groq: GroqProvider;
  private mock: MockProvider;
  private geminiExhausted = false;

  constructor() {
    this.gemini = new GeminiProvider(config.geminiApiKey, config.geminiModel);
    this.groq = new GroqProvider(config.groqApiKey, config.groqModel);
    this.mock = new MockProvider();
  }

  getProvider(name: 'gemini' | 'groq' | 'mock'): LLMProvider {
    switch (name) {
      case 'gemini':
        if (this.geminiExhausted && this.groq.isAvailable()) {
          return this.groq;
        }
        return this.gemini.isAvailable() ? this.gemini : (this.groq.isAvailable() ? this.groq : this.mock);
      case 'groq':
        return this.groq.isAvailable() ? this.groq : (this.gemini.isAvailable() ? this.gemini : this.mock);
      case 'mock':
      default:
        return this.mock;
    }
  }

  getRoleConfig(role: string): ModelConfig {
    return config.roleModels[role] || {
      provider: config.defaultProvider,
      model: config.geminiModel,
      temperature: 0.2,
    };
  }

  async callForRole(
    role: string,
    messages: LLMMessage[],
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    const roleCfg = this.getRoleConfig(role);
    const providerName = options.model?.startsWith('llama') || options.model?.startsWith('openai') || this.geminiExhausted
      ? (this.groq.isAvailable() ? 'groq' : 'mock')
      : roleCfg.provider;
    const provider = this.getProvider(providerName);

    const mergedOpts: LLMRequestOptions = {
      ...options,
      model: options.model || (provider.name === 'groq' ? config.groqModel : roleCfg.model),
      temperature: options.temperature ?? roleCfg.temperature,
      maxTokens: options.maxTokens ?? roleCfg.maxOutputTokens ?? config.maxTokens,
    };

    try {
      return await provider.generateText(messages, mergedOpts);
    } catch (err: any) {
      console.warn(`[LLMRouter] Error calling provider ${provider.name} for role ${role}:`, err.message);

      if (err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429')) {
        this.geminiExhausted = true;
      }

      // Fallback: If gemini fails, try groq. If groq fails, try gemini. If both fail, fallback to mock.
      if (provider.name === 'gemini' && this.groq.isAvailable()) {
        try {
          console.log(`[LLMRouter] Falling back to Groq for role ${role}`);
          return await this.groq.generateText(messages, {
            ...mergedOpts,
            model: config.groqModel,
          });
        } catch (groqErr: any) {
          console.warn(`[LLMRouter] Groq fallback failed for role ${role}:`, groqErr.message);
        }
      } else if (provider.name === 'groq' && this.gemini.isAvailable()) {
        try {
          console.log(`[LLMRouter] Falling back to Gemini for role ${role}`);
          return await this.gemini.generateText(messages, {
            ...mergedOpts,
            model: config.geminiModel,
          });
        } catch (geminiErr: any) {
          console.warn(`[LLMRouter] Gemini fallback failed for role ${role}:`, geminiErr.message);
        }
      }

      console.log(`[LLMRouter] Falling back to MockProvider for role ${role}`);
      return await this.mock.generateText(messages, mergedOpts);
    }
  }

  getAvailableProviders(): { id: string; name: string; available: boolean; defaultModel: string }[] {
    return [
      {
        id: 'gemini',
        name: 'Google Gemini',
        available: this.gemini.isAvailable(),
        defaultModel: config.geminiModel,
      },
      {
        id: 'groq',
        name: 'Groq Cloud',
        available: this.groq.isAvailable(),
        defaultModel: config.groqModel,
      },
      {
        id: 'mock',
        name: 'Deterministic Sandbox (Offline / Test)',
        available: true,
        defaultModel: 'sandbox-v1',
      },
    ];
  }
}

export const llmRouter = new LLMRouter();
