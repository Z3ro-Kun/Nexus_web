import dotenv from 'dotenv';
dotenv.config();

export interface ModelConfig {
  provider: 'gemini' | 'groq' | 'mock';
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface SystemConfig {
  port: number;
  appUrl: string;
  geminiApiKey: string;
  geminiModel: string;
  groqApiKey: string;
  groqModel: string;
  maxTokens: number;
  defaultProvider: 'gemini' | 'groq' | 'mock';
  roleModels: Record<string, ModelConfig>;
  maxRetriesPerTask: number;
  toolTimeoutMs: number;
  storageDir: string;
}

const defaultProvider: 'gemini' | 'groq' | 'mock' = 
  process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    ? 'gemini'
    : (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'MY_GROQ_API_KEY' ? 'groq' : 'gemini');

export const config: SystemConfig = {
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  maxTokens: Number(process.env.MAX_TOKENS || 1200),
  defaultProvider,
  roleModels: {
    architect: { provider: defaultProvider, model: 'gemini-3.8-flash', temperature: 0.2, maxOutputTokens: Number(process.env.MAX_TOKENS || 1200) },
    requirements: { provider: defaultProvider, model: 'gemini-3.8-flash', temperature: 0.1, maxOutputTokens: 800 },
    planner: { provider: defaultProvider, model: 'gemini-3.8-flash', temperature: 0.2, maxOutputTokens: 1000 },
    researcher: { provider: defaultProvider, model: 'gemini-3.8-flash', temperature: 0.3, maxOutputTokens: 1000 },
    implementer: { provider: defaultProvider, model: 'gemini-3.8-flash', temperature: 0.2, maxOutputTokens: Number(process.env.MAX_TOKENS || 1200) },
    reviewer: { provider: defaultProvider, model: 'gemini-3.8-flash', temperature: 0.1, maxOutputTokens: 800 },
    verifier: { provider: defaultProvider, model: 'gemini-3.8-flash', temperature: 0.1, maxOutputTokens: 800 },
    replanner: { provider: defaultProvider, model: 'gemini-3.8-flash', temperature: 0.2, maxOutputTokens: 800 },
  },
  maxRetriesPerTask: 3,
  toolTimeoutMs: 15000,
  storageDir: './data',
};
