import React, { useState, useRef } from 'react';
import { Send, Upload, FileCode, CheckCircle2, AlertCircle, X, Sparkles, Layers } from 'lucide-react';
import { api } from '../api.js';
import { DocumentRecord } from '../types.js';

interface InputWorkspaceProps {
  onSubmit: (prompt: string) => Promise<void>;
  isLoading: boolean;
  onDocumentUploaded: (doc: DocumentRecord) => void;
  existingDocs: DocumentRecord[];
}

const PRESETS = [
  {
    title: 'Python Bubble Sort Algorithm with Self-Tests',
    prompt:
      'Write a Python program of bubble sort with early-exit optimization, docstrings, type annotations, and a runnable self-test verification suite.',
    tag: 'Python Deliverable Artifact',
  },
  {
    title: 'OAuth2 Token Rotation Microservice',
    prompt:
      'Design, implement, and independently verify a secure OAuth2 microservice with cryptographic token rotation, HMAC SHA256 signing, replay attack detection, and an automated verification test suite.',
    tag: 'Full-Stack & Security',
  },
  {
    title: 'Financial Analysis & EBITDA Margin Calculation',
    prompt:
      'Analyze the corporate financial statement data, perform accurate mathematical calculations of EBITDA margin, operating leverage, and debt-to-equity ratio using the calculator tool, and generate an executive report.',
    tag: 'Math & Document Analysis',
  },
  {
    title: 'High-Throughput ETL Pipeline with Invariant Checks',
    prompt:
      'Architect a distributed data ingestion pipeline for streaming telemetry with deduplication, dead-letter queuing, and formal invariant validation that rejects corrupted payloads.',
    tag: 'System Architecture',
  },
];

export const InputWorkspace: React.FC<InputWorkspaceProps> = ({
  onSubmit,
  isLoading,
  onDocumentUploaded,
  existingDocs,
}) => {
  const [prompt, setPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    await onSubmit(prompt.trim());
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await api.uploadDocument(file);
        if (res.success) {
          onDocumentUploaded(res.document);
        }
      }
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Autonomous Multi-Agent Development System
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-2xl mx-auto">
          Coordinating Architect, Planner, Researcher, Implementer, Reviewer, and Verifier agents with DAG dependency scheduling and substantive evidence verification.
        </p>
      </div>

      {/* Main Input Form */}
      <form onSubmit={handleFormSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your software engineering goal, algorithm, or document analysis task..."
            rows={4}
            disabled={isLoading}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 resize-y"
          />
        </div>

        {/* Document Ingestion & Attachment Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-md transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>{uploading ? 'Processing Document...' : 'Attach Documents (PDF, DOCX, CSV, JSON, MD)'}</span>
            </button>
            <span className="text-xs text-slate-500 hidden md:inline">
              Indexed into vector & keyword RAG
            </span>
          </div>

          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:hover:bg-cyan-400 rounded-lg transition-all shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Orchestrating Agents...' : 'Execute Autonomous Plan'}</span>
          </button>
        </div>

        {uploadError && (
          <div className="mt-3 flex items-center gap-2 text-xs text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Existing Attached Documents List */}
        {existingDocs.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800/60">
            <div className="text-xs text-slate-400 mb-2 font-medium">Knowledge Base Context ({existingDocs.length} files available to Researcher):</div>
            <div className="flex flex-wrap gap-2">
              {existingDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 px-2.5 py-1 text-xs bg-slate-800/80 border border-slate-700/60 rounded text-slate-300"
                >
                  <FileCode className="w-3 h-3 text-cyan-400" />
                  <span className="truncate max-w-[180px]">{doc.filename}</span>
                  <span className="text-[11px] text-slate-500">({doc.chunkCount} chunks)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>

      {/* Preset Tasks */}
      <div className="mt-8">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Or Choose a Production-Ready Blueprint</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(preset.prompt)}
              disabled={isLoading}
              className="text-left p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl transition-all group"
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>{preset.tag}</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400 font-medium">
                  Load &rarr;
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-200 group-hover:text-white mb-1.5">
                {preset.title}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {preset.prompt}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
