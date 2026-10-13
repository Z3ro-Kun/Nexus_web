import { config, ModelConfig } from '../config.js';
import { GeminiProvider } from './gemini.js';
import { GroqProvider } from './groq.js';
import { OpenRouterProvider } from './openrouter.js';
import { MockProvider } from './mock.js';
import { LLMMessage, LLMProvider, LLMRequestOptions, LLMResponse } from './types.js';

export class LLMRouter {
  private openrouter: OpenRouterProvider;
  private gemini: GeminiProvider;
  private groq: GroqProvider;
  private mock: MockProvider;
  private openrouterExhausted = false;
  private geminiExhausted = false;

  constructor() {
    this.openrouter = new OpenRouterProvider(config.openrouterApiKey, config.openrouterModel);
    this.gemini = new GeminiProvider(config.geminiApiKey, config.geminiModel);
    this.groq = new GroqProvider(config.groqApiKey, config.groqModel);
    this.mock = new MockProvider();
  }

  getProvider(name: 'openrouter' | 'gemini' | 'groq' | 'mock'): LLMProvider {
    switch (name) {
      case 'groq':
        if (this.groq.isAvailable()) return this.groq;
        if (!this.openrouterExhausted && this.openrouter.isAvailable()) return this.openrouter;
        if (!this.geminiExhausted && this.gemini.isAvailable()) return this.gemini;
        return this.mock;

      case 'openrouter':
        if (this.groq.isAvailable()) return this.groq;
        if (!this.openrouterExhausted && this.openrouter.isAvailable()) return this.openrouter;
        if (!this.geminiExhausted && this.gemini.isAvailable()) return this.gemini;
        return this.mock;

      case 'gemini':
        if (this.groq.isAvailable()) return this.groq;
        if (!this.geminiExhausted && this.gemini.isAvailable()) return this.gemini;
        if (!this.openrouterExhausted && this.openrouter.isAvailable()) return this.openrouter;
        return this.mock;

      case 'mock':
      default:
        return this.mock;
    }
  }

  getRoleConfig(role: string): ModelConfig {
    return (
      config.roleModels[role] || {
        provider: config.defaultProvider,
        model: config.defaultProvider === 'groq' ? config.groqModel : config.openrouterModel,
        temperature: 0.2,
      }
    );
  }

  async callForRole(
    role: string,
    messages: LLMMessage[],
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    const roleCfg = this.getRoleConfig(role);
    const preferredProvider = roleCfg.provider;
    const provider = this.getProvider(preferredProvider);

    // Pick appropriate model for the active provider
    let modelName = options.model;
    if (!modelName) {
      if (provider.name === 'openrouter') {
        modelName = roleCfg.provider === 'openrouter' ? roleCfg.model : config.openrouterModel;
      } else if (provider.name === 'gemini') {
        modelName = roleCfg.provider === 'gemini' ? roleCfg.model : config.geminiModel;
      } else if (provider.name === 'groq') {
        modelName = config.groqModel;
      } else {
        modelName = 'sandbox-v1';
      }
    }

    const mergedOpts: LLMRequestOptions = {
      ...options,
      model: modelName,
      temperature: options.temperature ?? roleCfg.temperature,
      maxTokens: options.maxTokens ?? roleCfg.maxOutputTokens ?? config.maxTokens,
    };

    try {
      return await provider.generateText(messages, mergedOpts);
    } catch (err: any) {
      console.warn(`[LLMRouter] Error calling provider ${provider.name} for role ${role}:`, err.message);

      if (provider.name === 'openrouter' && (err.message?.includes('429') || err.message?.includes('403') || err.message?.includes('rate limit') || err.message?.includes('harness'))) {
        this.openrouterExhausted = true;
      }
      if (provider.name === 'gemini' && (err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429') || err.message?.includes('depleted') || err.message?.includes('402') || err.message?.includes('404'))) {
        this.geminiExhausted = true;
      }

      // Chain of fallbacks: Try other available real providers before mock
      const candidateProviders: { provider: LLMProvider; defaultModel: string }[] = [];
      if (provider.name !== 'groq' && this.groq.isAvailable()) {
        candidateProviders.push({ provider: this.groq, defaultModel: config.groqModel });
      }
      if (provider.name !== 'openrouter' && this.openrouter.isAvailable() && !this.openrouterExhausted) {
        candidateProviders.push({ provider: this.openrouter, defaultModel: config.openrouterModel });
      }
      if (provider.name !== 'gemini' && this.gemini.isAvailable() && !this.geminiExhausted) {
        candidateProviders.push({ provider: this.gemini, defaultModel: config.geminiModel });
      }

      for (const candidate of candidateProviders) {
        try {
          console.log(`[LLMRouter] Falling back to ${candidate.provider.name} for role ${role}`);
          return await candidate.provider.generateText(messages, {
            ...mergedOpts,
            model: candidate.defaultModel,
          });
        } catch (fbErr: any) {
          console.warn(`[LLMRouter] Fallback to ${candidate.provider.name} failed:`, fbErr.message);
          if (candidate.provider.name === 'openrouter') this.openrouterExhausted = true;
          if (candidate.provider.name === 'gemini') this.geminiExhausted = true;
        }
      }

      console.log(`[LLMRouter] Falling back to MockProvider for role ${role}`);
      return await this.mock.generateText(messages, mergedOpts);
    }
  }

  getAvailableProviders(): { id: string; name: string; available: boolean; defaultModel: string }[] {
    return [
      {
        id: 'openrouter',
        name: 'OpenRouter (Free Models)',
        available: this.openrouter.isAvailable(),
        defaultModel: config.openrouterModel,
      },
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
