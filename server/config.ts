import dotenv from 'dotenv';
dotenv.config();

export interface ModelConfig {
  provider: 'gemini' | 'openrouter' | 'groq' | 'mock';
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface SystemConfig {
  port: number;
  appUrl: string;
  geminiApiKey: string;
  geminiModel: string;
  openrouterApiKey: string;
  openrouterModel: string;
  groqApiKey: string;
  groqModel: string;
  maxTokens: number;
  defaultProvider: 'gemini' | 'openrouter' | 'groq' | 'mock';
  roleModels: Record<string, ModelConfig>;
  maxRetriesPerTask: number;
  toolTimeoutMs: number;
  storageDir: string;
}

const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim() && process.env.OPENROUTER_API_KEY !== 'MY_OPENROUTER_API_KEY');
const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
const hasGroq = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() && process.env.GROQ_API_KEY !== 'MY_GROQ_API_KEY');

const defaultProvider: 'gemini' | 'openrouter' | 'groq' | 'mock' = 
  hasGroq
    ? 'groq'
    : (hasOpenRouter ? 'openrouter' : (hasGemini ? 'gemini' : 'mock'));

const envGeminiModel = process.env.GEMINI_MODEL;
const geminiModel = envGeminiModel || 'gemini-2.5-flash';

const primaryProvider = defaultProvider;
const primaryModel = primaryProvider === 'groq' 
  ? (process.env.GROQ_MODEL || 'openai/gpt-oss-120b')
  : (primaryProvider === 'openrouter' ? (process.env.OPENROUTER_MODEL || 'openrouter/free') : geminiModel);

export const config: SystemConfig = {
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel,
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterModel: process.env.OPENROUTER_MODEL || 'openrouter/free',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  maxTokens: Number(process.env.MAX_TOKENS || 6000),
  defaultProvider,
  // Role models default to active, operational primary provider (Groq)
  roleModels: {
    architect: {
      provider: primaryProvider,
      model: primaryModel,
      temperature: 0.2,
      maxOutputTokens: Number(process.env.MAX_TOKENS || 6000),
    },
    requirements: {
      provider: primaryProvider,
      model: primaryModel,
      temperature: 0.1,
      maxOutputTokens: 2000,
    },
    planner: {
      provider: primaryProvider,
      model: primaryModel,
      temperature: 0.2,
      maxOutputTokens: 3000,
    },
    researcher: {
      provider: primaryProvider,
      model: primaryModel,
      temperature: 0.2,
      maxOutputTokens: 3500,
    },
    implementer: {
      provider: primaryProvider,
      model: primaryModel,
      temperature: 0.2,
      maxOutputTokens: Number(process.env.MAX_TOKENS || 5000),
    },
    reviewer: {
      provider: primaryProvider,
      model: primaryModel,
      temperature: 0.1,
      maxOutputTokens: 2000,
    },
    verifier: {
      provider: primaryProvider,
      model: primaryModel,
      temperature: 0.1,
      maxOutputTokens: 2000,
    },
    replanner: {
      provider: primaryProvider,
      model: primaryModel,
      temperature: 0.2,
      maxOutputTokens: 2000,
    },
  },
  maxRetriesPerTask: 3,
  toolTimeoutMs: 15000,
  storageDir: './data',
};
