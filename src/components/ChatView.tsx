import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Download,
  Copy,
  Check,
  Code2,
  FileCode,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  FileCheck,
  Terminal,
} from 'lucide-react';
import { TaskRecord, ChatMessage, Artifact, DAGNode } from '../types.js';

interface ChatViewProps {
  task: TaskRecord;
  onSendFollowUp: (prompt: string) => Promise<void>;
  isLoading: boolean;
  onSelectNode?: (node: DAGNode) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  task,
  onSendFollowUp,
  isLoading,
  onSelectNode,
}) => {
  const [followUpInput, setFollowUpInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [task.conversation?.length, task.status, isLoading]);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadArtifact = (artifact: Artifact) => {
    let mime = 'text/plain;charset=utf-8';
    if (artifact.filename.endsWith('.py')) mime = 'text/x-python;charset=utf-8';
    else if (artifact.filename.endsWith('.ts') || artifact.filename.endsWith('.tsx')) mime = 'text/typescript;charset=utf-8';
    else if (artifact.filename.endsWith('.js') || artifact.filename.endsWith('.jsx')) mime = 'text/javascript;charset=utf-8';
    else if (artifact.filename.endsWith('.json')) mime = 'application/json;charset=utf-8';
    else if (artifact.filename.endsWith('.md')) mime = 'text/markdown;charset=utf-8';

    const blob = new Blob([artifact.content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpInput.trim() || isLoading) return;
    const prompt = followUpInput.trim();
    setFollowUpInput('');
    await onSendFollowUp(prompt);
  };

  const handleSuggestionClick = (text: string) => {
    setFollowUpInput(text);
  };

  const toggleReasoning = (msgId: string) => {
    setExpandedReasoning((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Filter out internal reports, keep code and tangible deliverables
  const filterDeliverableArtifacts = (artifacts: Artifact[] = []) => {
    return artifacts.filter((art) => {
      const isInternalReport =
        art.filename.endsWith('_audit.md') ||
        art.filename.endsWith('_report.md') ||
        art.filename.endsWith('_dossier.md') ||
        art.filename.endsWith('_specification.md');
      return !isInternalReport;
    });
  };

  const allDeliverables = filterDeliverableArtifacts(task.artifacts || []);

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[calc(100vh-140px)] min-h-[620px] max-w-5xl mx-auto w-full">
      {/* Chat Session Top Bar */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">{task.title}</h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="capitalize">{task.status === 'completed' ? 'Verified' : task.status}</span>
              <span aria-hidden="true">·</span>
              <span>
                {allDeliverables.length} deliverable{allDeliverables.length !== 1 ? 's' : ''}
              </span>
              {task.metrics?.durationMs > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{(task.metrics.durationMs / 1000).toFixed(1)}s</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-full ${
              task.status === 'completed'
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/70'
                : task.status === 'failed'
                ? 'bg-rose-950/70 text-rose-300 border border-rose-800/70'
                : 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/70 animate-pulse'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                task.status === 'completed'
                  ? 'bg-emerald-400'
                  : task.status === 'failed'
                  ? 'bg-rose-400'
                  : 'bg-cyan-400'
              }`}
            />
            {task.status === 'completed' ? 'Verified & Complete' : task.status}
          </span>
        </div>
      </div>

      {/* Main Chat Stream Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {(task.conversation || []).map((msg, idx) => {
          const isUser = msg.sender === 'user';
          // Filter deliverables for this message or latest deliverables
          const rawArtifacts = msg.artifacts || (idx === task.conversation.length - 1 ? allDeliverables : []);
          const msgArtifacts = filterDeliverableArtifacts(rawArtifacts);

          return (
            <div key={msg.id || idx} className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {/* Assistant Icon */}
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[92%] sm:max-w-[84%] flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Chat Bubble */}
                <div
                  className={`rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-md ${
                    isUser
                      ? 'bg-cyan-500 text-slate-950 font-medium rounded-tr-xs'
                      : 'bg-slate-950/90 border border-slate-800/90 text-slate-100 rounded-tl-xs w-full'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Compact Collapsible Workflow Accordion */}
                      {task.plan && (
                        <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-900/40">
                          <button
                            onClick={() => toggleReasoning(msg.id)}
                            className="w-full px-3.5 py-2 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors bg-slate-900/60"
                          >
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="font-medium text-slate-300">
                                {msg.agentSummary || 'Multi-Agent Autonomous Execution & Verification'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <span>{expandedReasoning[msg.id] ? 'Hide Workflow' : 'View Workflow'}</span>
                              {expandedReasoning[msg.id] ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </div>
                          </button>

                          {expandedReasoning[msg.id] && (
                            <div className="p-3 border-t border-slate-800 bg-slate-950/50 space-y-2 text-xs">
                              <div className="text-[11px] text-slate-400 font-mono">
                                Executed Agents & Tasks ({task.plan.nodes.length} nodes):
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {task.plan.nodes.map((n) => (
                                  <div
                                    key={n.id}
                                    onClick={() => onSelectNode && onSelectNode(n)}
                                    className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className="text-[10px] uppercase font-mono px-1 rounded bg-slate-800 text-cyan-400">
                                        {n.role}
                                      </span>
                                      <span className="text-slate-300 truncate text-[11px]">{n.title}</span>
                                    </div>
                                    <span
                                      className={`text-[10px] font-mono capitalize ${
                                        n.status === 'completed' ? 'text-emerald-400' : 'text-slate-500'
                                      }`}
                                    >
                                      {n.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Conversational Markdown Response Body (ChatGPT / Gemini style) */}
                      <MarkdownRenderer content={msg.content} />

                      {/* Deliverable Artifact Preview Cards (Preview Field + Download Button) */}
                      {msgArtifacts.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                              <FileCheck className="w-4 h-4 text-cyan-400" />
                              <span>Deliverable Artifact ({msgArtifacts.length})</span>
                            </span>
                            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Ready for Download</span>
                            </span>
                          </div>

                          <div className="space-y-3">
                            {msgArtifacts.map((art) => (
                              <ArtifactDeliverableCard
                                key={art.id}
                                artifact={art}
                                onDownload={handleDownloadArtifact}
                                onCopy={handleCopyCode}
                                isCopied={copiedId === art.id}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-500 font-mono px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-300 shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Live Running Status Animation */}
        {isLoading && (
          <div className="flex gap-3.5 items-start">
            <div className="w-8 h-8 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl rounded-tl-xs px-5 py-4 text-xs text-slate-300 flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>
                {task.activeAgents.length > 0
                  ? `Agents collaborating: ${task.activeAgents.join(', ')}...`
                  : 'Synthesizing response and validating deliverable artifacts...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips Bar */}
      <div className="px-5 py-2.5 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-medium text-slate-400 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Follow-up ideas:</span>
        </span>
        <button
          onClick={() => handleSuggestionClick('Can you add comprehensive unit tests to the program?')}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 whitespace-nowrap transition-colors"
        >
          + Add unit tests
        </button>
        <button
          onClick={() => handleSuggestionClick('Can you add an option to sort in descending order?')}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 whitespace-nowrap transition-colors"
        >
          + Add descending sort option
        </button>
        <button
          onClick={() => handleSuggestionClick('Can you optimize performance and explain time/space complexity?')}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 whitespace-nowrap transition-colors"
        >
          + Optimize complexity
        </button>
        <button
          onClick={() => handleSuggestionClick('Can you add type hints, docstrings, and error handling?')}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 whitespace-nowrap transition-colors"
        >
          + Add docstrings & types
        </button>
      </div>

      {/* Follow-Up Chat Input Bar */}
      <form onSubmit={handleSubmit} className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-3">
        <input
          type="text"
          value={followUpInput}
          onChange={(e) => setFollowUpInput(e.target.value)}
          placeholder="Ask a follow-up or request modifications to the artifact (e.g., 'Add unit tests')..."
          disabled={isLoading}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50"
        />
        <button
          type="submit"
          disabled={!followUpInput.trim() || isLoading}
          className="px-5 py-3 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:hover:bg-cyan-400 text-slate-950 font-semibold rounded-xl text-xs transition-colors flex items-center gap-2 shadow-sm shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
};

interface ArtifactDeliverableCardProps {
  artifact: Artifact;
  onDownload: (artifact: Artifact) => void;
  onCopy: (content: string, id: string) => void;
  isCopied: boolean;
}

const ArtifactDeliverableCard: React.FC<ArtifactDeliverableCardProps> = ({
  artifact,
  onDownload,
  onCopy,
  isCopied,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const ext = artifact.filename.split('.').pop()?.toLowerCase() || '';
  const isPython = ext === 'py' || artifact.language === 'python';
  const isTs = ext === 'ts' || ext === 'tsx' || artifact.language === 'typescript';

  const badgeColor = isPython
    ? 'bg-amber-400/15 text-amber-300 border-amber-500/30'
    : isTs
    ? 'bg-blue-400/15 text-blue-300 border-blue-500/30'
    : 'bg-cyan-400/15 text-cyan-300 border-cyan-500/30';

  const langTag = isPython ? 'Python' : isTs ? 'TypeScript' : (artifact.language || ext.toUpperCase());

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-lg transition-all">
      {/* Artifact Header Card */}
      <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400 shrink-0">
            <FileCode className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-100 truncate">{artifact.filename}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${badgeColor}`}>
                {langTag}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                v{artifact.version || 1}
                {(artifact.version || 1) > 1 ? ' (Updated)' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>{(artifact.sizeBytes / 1024).toFixed(1)} KB</span>
              <span aria-hidden="true">·</span>
              <span>{artifact.content.split('\n').length} lines</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Verified by Verifier
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Copy, Download, Toggle Preview */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onCopy(artifact.content, artifact.id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors"
            title="Copy source code"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            onClick={() => onDownload(artifact)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-sm"
            title={`Download ${artifact.filename}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .{ext}</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors"
            title={isExpanded ? 'Collapse preview' : 'Expand preview'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Code Preview Field */}
      {isExpanded && (
        <div className="bg-slate-950 border-t border-slate-900 overflow-x-auto max-h-80 overflow-y-auto p-4 font-mono text-xs text-slate-200 leading-relaxed">
          <pre className="whitespace-pre-wrap">{artifact.content}</pre>
        </div>
      )}
    </div>
  );
};

// Formats Markdown text into rich, clean typography with code highlighting
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  return (
    <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed space-y-2 font-sans">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const lang = match ? match[1] : '';
            return !inline ? (
              <div className="my-2.5 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md">
                {lang && (
                  <div className="px-3.5 py-1 bg-slate-900 border-b border-slate-800 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                    {lang}
                  </div>
                )}
                <pre className="p-3.5 font-mono text-xs overflow-x-auto text-cyan-200 leading-relaxed whitespace-pre-wrap">
                  <code>{children}</code>
                </pre>
              </div>
            ) : (
              <code className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-xs" {...props}>
                {children}
              </code>
            );
          },
          h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold text-white mt-3.5 mb-1.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-slate-100 mt-3 mb-1">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold text-cyan-300 mt-2.5 mb-1">{children}</h4>,
          p: ({ children }) => <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-2">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs sm:text-sm pl-1 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 text-slate-300 text-xs sm:text-sm pl-1 mb-2">{children}</ol>,
          li: ({ children }) => <li className="text-slate-300 leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-cyan-500 pl-3 italic text-slate-400 my-2">{children}</blockquote>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
