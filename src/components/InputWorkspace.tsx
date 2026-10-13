import React, { useState, useRef } from 'react';
import { Send, Upload, FileCode, CheckCircle2, AlertCircle, X, Sparkles, Layers, MessageSquare, Trash2, ArrowRight } from 'lucide-react';
import { api } from '../api.js';
import { DocumentRecord, TaskRecord, UserRecord } from '../types.js';

interface InputWorkspaceProps {
  onSubmit: (prompt: string) => Promise<void>;
  isLoading: boolean;
  currentUser?: UserRecord | null;
  onDocumentUploaded: (doc: DocumentRecord) => void;
  existingDocs: DocumentRecord[];
  recentTasks?: TaskRecord[];
  onSelectTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
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
  currentUser,
  onDocumentUploaded,
  existingDocs,
  recentTasks,
  onSelectTask,
  onDeleteTask,
}) => {
  const [prompt, setPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Autonomous Multi-Agent Development System
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-2xl mx-auto">
          Coordinating Architect, Planner, Researcher, Implementer, Reviewer, and Verifier agents with DAG dependency scheduling and substantive evidence verification.
        </p>
      </div>

      {/* Session Isolation Banner */}
      {currentUser && (
        <div className="mb-5 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-950 uppercase shrink-0"
              style={{ backgroundColor: currentUser.avatarColor || '#06b6d4' }}
            >
              {currentUser.username[0]}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-300">
                Logged in as: <strong className="text-white font-semibold">{currentUser.displayName}</strong>
                <span className="text-slate-500 font-mono ml-1.5">(@{currentUser.username})</span>
              </span>
              <span className="text-[10px] text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded-full font-mono">
                Private & Isolated Workspace
              </span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
            {recentTasks?.length || 0} chats in memory
          </div>
        </div>
      )}

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

      {/* Recent Chats / Conversations Section */}
      {recentTasks && recentTasks.length > 0 && (
        <div className="mt-10 pt-6 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span>Recent Conversations ({recentTasks.length})</span>
            </div>
            <span className="text-[11px] text-slate-500">Quickly reopen or delete past tasks</span>
          </div>

          <div className="space-y-2">
            {recentTasks.map((t) => (
              <div
                key={t.id}
                className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 rounded-xl flex items-center justify-between gap-3 group transition-all"
              >
                <div
                  onClick={() => onSelectTask && onSelectTask(t.id)}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors truncate">
                      {t.title}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${
                        t.status === 'completed'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                          : t.status === 'failed'
                          ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                          : 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 animate-pulse'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                    <span>
                      {new Date(t.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{t.artifacts?.length || 0} deliverable{t.artifacts?.length !== 1 ? 's' : ''}</span>
                    {t.toolCalls && t.toolCalls.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-cyan-400 font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {t.toolCalls.length} tool call{t.toolCalls.length !== 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onSelectTask && onSelectTask(t.id)}
                    className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3 text-cyan-400" />
                  </button>

                  {onDeleteTask && (
                    deleteConfirmId === t.id ? (
                      <div className="flex items-center gap-1 bg-rose-950/90 border border-rose-800/90 rounded-lg p-1">
                        <button
                          onClick={() => {
                            setDeleteConfirmId(null);
                            onDeleteTask(t.id);
                          }}
                          className="px-2 py-0.5 text-[11px] font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-1.5 py-0.5 text-[11px] text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(t.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Delete chat session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
