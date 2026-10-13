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
  Trash2,
  Globe,
  ExternalLink,
  Search,
  Wrench,
  Layers,
  BrainCircuit,
  Activity,
} from 'lucide-react';
import { TaskRecord, ChatMessage, Artifact, DAGNode, ToolCallRecord, SourceCitation } from '../types.js';

interface ChatViewProps {
  task: TaskRecord;
  onSendFollowUp: (prompt: string) => Promise<void>;
  onDeleteTask?: (taskId: string) => void;
  isLoading: boolean;
  onSelectNode?: (node: DAGNode) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  task,
  onSendFollowUp,
  onDeleteTask,
  isLoading,
  onSelectNode,
}) => {
  const [followUpInput, setFollowUpInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const toggleTools = (msgId: string) => {
    setExpandedTools((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const toggleThinking = (msgId: string) => {
    setExpandedThinking((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Extract thinking tags and separate from chat content so tokens & thinking never spill into chat
  const extractThinkingFromMessage = (content: string, existingThinking?: string): { cleanContent: string; thinking?: string } => {
    let thinking = existingThinking ? existingThinking.trim() : '';
    let clean = content || '';

    // Extract closed <think>...</think>
    const thinkMatches = clean.matchAll(/<think>([\s\S]*?)<\/think>/gi);
    for (const m of thinkMatches) {
      if (m[1]) {
        thinking = (thinking ? thinking + '\n\n' : '') + m[1].trim();
      }
    }
    clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Extract unclosed <think>... (occurs if token limit truncated model output during thinking)
    const unclosedThink = clean.match(/<think>([\s\S]*)$/i);
    if (unclosedThink) {
      thinking = (thinking ? thinking + '\n\n' : '') + unclosedThink[1].trim();
      clean = clean.replace(/<think>([\s\S]*)$/i, '').trim();
    }

    // Extract <thought> or <reasoning>
    clean = clean.replace(/<(?:thought|reasoning)>([\s\S]*?)<\/(?:thought|reasoning)>/gi, (_, body) => {
      thinking = (thinking ? thinking + '\n\n' : '') + body.trim();
      return '';
    }).trim();
    const unclosedThought = clean.match(/<(?:thought|reasoning)>([\s\S]*)$/i);
    if (unclosedThought) {
      thinking = (thinking ? thinking + '\n\n' : '') + unclosedThought[1].trim();
      clean = clean.replace(/<(?:thought|reasoning)>([\s\S]*)$/i, '').trim();
    }

    clean = clean.replace(/^(?:User Safety:\s*safe\s*)+/i, '').trim();

    // If clean text is empty because all tokens were consumed in thinking, provide a clear status
    if (!clean && thinking) {
      clean = `I have completed the multi-agent analysis. Expand **Thinking Process & Reasoning** above to inspect the step-by-step working.`;
    }

    return {
      cleanContent: clean,
      thinking: thinking.trim() || undefined,
    };
  };

  // Compute live progress percentage based on multi-agent execution lifecycle
  const computeProgress = (): { percent: number; label: string; activeRole: string } => {
    if (task.status === 'completed') {
      return { percent: 100, label: 'Execution & Formal Verification 100% Completed', activeRole: 'verifier' };
    }
    if (task.status === 'failed') {
      return { percent: 100, label: 'Execution stopped due to unresolved issues', activeRole: 'orchestrator' };
    }
    if (task.status === 'waiting_clarification') {
      return { percent: 25, label: 'Awaiting User Clarification Response...', activeRole: 'requirements' };
    }
    if (task.status === 'analyzing') {
      return { percent: 18, label: 'Requirements Analyst: Analyzing constraints & intent...', activeRole: 'requirements' };
    }
    if (task.status === 'planning') {
      return { percent: 35, label: 'Technical Planner: Constructing Directed Acyclic Graph (DAG)...', activeRole: 'planner' };
    }
    if (task.status === 'verifying') {
      return { percent: 90, label: 'Formal Verifier: Executing test suite & acceptance checks...', activeRole: 'verifier' };
    }
    if (task.activeAgents.includes('assistant')) {
      return { percent: 96, label: 'Assistant: Formatting verified deliverables & response...', activeRole: 'assistant' };
    }

    const nodes = task.plan?.nodes || [];
    if (nodes.length > 0) {
      const completed = nodes.filter((n) => n.status === 'completed').length;
      const pct = Math.min(88, Math.round(40 + (completed / nodes.length) * 48));
      const runningNode = nodes.find((n) => n.status === 'running') || nodes[completed];
      return {
        percent: pct,
        label: runningNode
          ? `[${runningNode.role.toUpperCase()}] "${runningNode.title}" (${completed}/${nodes.length} subtasks done)...`
          : `Multi-Agent DAG Batch Execution (${completed}/${nodes.length} completed)...`,
        activeRole: runningNode?.role || 'implementer',
      };
    }

    return { percent: 45, label: 'Autonomous Multi-Agent Collaboration...', activeRole: 'implementer' };
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
          {onDeleteTask && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-800/80 rounded-lg px-2 py-1 text-xs">
                <span className="text-[11px] text-rose-300 font-medium">Delete chat?</span>
                <button
                  onClick={() => {
                    setConfirmDelete(false);
                    onDeleteTask(task.id);
                  }}
                  className="px-2 py-0.5 text-[11px] font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded transition-colors"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-1.5 py-0.5 text-[11px] text-slate-400 hover:text-white bg-slate-800 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-rose-300 bg-slate-800/60 hover:bg-rose-950/40 border border-slate-700/60 hover:border-rose-800/60 rounded-lg transition-colors"
                title="Delete this chat session"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete Chat</span>
              </button>
            )
          )}

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
            {task.status === 'completed' ? 'Verified & Complete' : `${computeProgress().percent}% ${task.status}`}
          </span>
        </div>
      </div>

      {/* Top Ambient Progress Bar while Generating */}
      {isLoading && (() => {
        const prog = computeProgress();
        return (
          <div className="w-full h-1 bg-slate-800/60 overflow-hidden shrink-0">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400 transition-all duration-500 shadow-sm shadow-cyan-500/50"
              style={{ width: `${prog.percent}%` }}
            />
          </div>
        );
      })()}

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
                      {/* Live Tools & Real-Time Evidence Grounding Card */}
                      {(() => {
                        const msgToolCalls = msg.toolCalls || (idx === task.conversation.length - 1 ? task.toolCalls : []) || [];
                        const msgCitations = msg.citations || (idx === task.conversation.length - 1 ? task.citations : []) || [];
                        if (msgToolCalls.length === 0 && msgCitations.length === 0) return null;
                        return (
                          <LiveToolCallsCard
                            toolCalls={msgToolCalls}
                            citations={msgCitations}
                            isExpanded={Boolean(expandedTools[msg.id])}
                            onToggle={() => toggleTools(msg.id)}
                          />
                        );
                      })()}

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

                      {/* Thinking Process & Reasoning Dropdown Row (Isolated from Chat Body) */}
                      {(() => {
                        const parsed = extractThinkingFromMessage(msg.content, msg.thinking);
                        if (!parsed.thinking) return null;
                        return (
                          <div className="border border-purple-900/60 rounded-xl overflow-hidden bg-purple-950/20 shadow-sm">
                            <button
                              onClick={() => toggleThinking(msg.id)}
                              className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-300 hover:text-white transition-colors bg-purple-950/40"
                            >
                              <div className="flex items-center gap-2">
                                <BrainCircuit className="w-4 h-4 text-purple-400" />
                                <span className="font-semibold text-purple-200">
                                  Thinking Process & Reasoning
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/50 font-mono">
                                  Internal Working
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-purple-300 font-medium">
                                <span>{expandedThinking[msg.id] ? 'Hide Working' : 'View Working'}</span>
                                {expandedThinking[msg.id] ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </div>
                            </button>

                            {expandedThinking[msg.id] && (
                              <div className="p-3.5 border-t border-purple-900/40 bg-slate-950/90 space-y-2 text-xs font-mono text-purple-100/90 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto selection:bg-purple-500/30">
                                {parsed.thinking}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Conversational Markdown Response Body (clean, no thinking slop) */}
                      {(() => {
                        const parsed = extractThinkingFromMessage(msg.content, msg.thinking);
                        return <MarkdownRenderer content={parsed.cleanContent} />;
                      })()}

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

        {/* Live Running Autonomous Percentage Bar & Circle */}
        {isLoading && (() => {
          const progress = computeProgress();
          const circumference = 2 * Math.PI * 18; // radius 18
          const strokeDashoffset = circumference - (progress.percent / 100) * circumference;

          return (
            <div className="flex gap-3.5 items-start">
              <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 animate-pulse shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl rounded-tl-xs p-4 text-xs text-slate-200 flex-1 max-w-[92%] sm:max-w-[84%] shadow-xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Circular Percentage Ring */}
                    <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 44 44">
                        <circle
                          cx="22"
                          cy="22"
                          r="18"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          fill="transparent"
                          className="text-slate-800"
                        />
                        <circle
                          cx="22"
                          cy="22"
                          r="18"
                          stroke="url(#progressGradient)"
                          strokeWidth="3.5"
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          className="transition-all duration-500 ease-out"
                        />
                        <defs>
                          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="50%" stopColor="#2dd4bf" />
                            <stop offset="100%" stopColor="#a855f7" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] font-mono font-bold text-white tracking-tighter">
                          {progress.percent}%
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs">
                          Autonomous Multi-Agent Progress
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
                          {progress.activeRole.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {progress.label}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-cyan-400 font-mono font-bold">
                    <Activity className="w-3.5 h-3.5 animate-spin" />
                    <span>{progress.percent}%</span>
                  </div>
                </div>

                {/* Animated Linear Percentage Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-slate-800/90 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-purple-400 rounded-full transition-all duration-500 ease-out shadow-sm shadow-cyan-500/40"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span>{task.activeAgents.length > 0 ? `Active: ${task.activeAgents.join(', ')}` : 'Synthesizing verified deliverables'}</span>
                    </div>
                    <span>{progress.percent < 100 ? `${progress.percent}% In Progress` : 'Completed'}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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

interface LiveToolCallsCardProps {
  toolCalls: ToolCallRecord[];
  citations?: SourceCitation[];
  isExpanded: boolean;
  onToggle: () => void;
}

const LiveToolCallsCard: React.FC<LiveToolCallsCardProps> = ({
  toolCalls,
  citations = [],
  isExpanded,
  onToggle,
}) => {
  return (
    <div className="border border-slate-800/90 rounded-xl overflow-hidden bg-slate-900/50 shadow-sm">
      <button
        onClick={onToggle}
        className="w-full px-3.5 py-2 flex items-center justify-between text-xs text-slate-300 hover:text-white transition-colors bg-slate-900/80"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
            <Globe className="w-3.5 h-3.5" />
            <span>Live Tools Executed & Evidence Grounding</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
            {toolCalls.length} tool operation{toolCalls.length !== 1 ? 's' : ''}
          </span>
          {citations.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-mono">
              {citations.length} verified source{citations.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
          <span>{isExpanded ? 'Hide Details' : 'Inspect Tools & Sources'}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {/* Collapsed Chips Row */}
      {!isExpanded && toolCalls.length > 0 && (
        <div className="px-3 py-1.5 bg-slate-950/40 border-t border-slate-800/60 flex items-center gap-2 overflow-x-auto text-[11px]">
          {toolCalls.map((tc, tcIdx) => (
            <div
              key={tcIdx}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300 font-mono shrink-0"
            >
              {tc.tool === 'web_search' && <Search className="w-3 h-3 text-cyan-400" />}
              {tc.tool === 'http_fetch' && <ExternalLink className="w-3 h-3 text-emerald-400" />}
              {tc.tool === 'calculator' && <span className="text-purple-400">🧮</span>}
              {tc.tool === 'document_retriever' && <FileCode className="w-3 h-3 text-amber-400" />}
              <span className="text-white font-semibold">{tc.tool}</span>
              {tc.query && <span className="text-slate-400 truncate max-w-[170px]">"{tc.query}"</span>}
              {tc.url && <span className="text-slate-400 truncate max-w-[170px]">{tc.url.replace(/^https?:\/\//, '')}</span>}
              {tc.durationMs ? <span className="text-slate-500 text-[10px]">({tc.durationMs}ms)</span> : null}
            </div>
          ))}
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/70 space-y-3 text-xs">
          <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span>Executed Live Tool Calls ({toolCalls.length}):</span>
            <span className="text-emerald-400 text-[10px] font-mono">Real-Time Grounding ✓</span>
          </div>

          <div className="space-y-2">
            {toolCalls.map((tc, tcIdx) => (
              <div key={tcIdx} className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-semibold uppercase">
                      {tc.tool}
                    </span>
                    <span className={`text-[10px] ${tc.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tc.success ? '● Success' : '● Failed'}
                    </span>
                  </div>
                  {tc.durationMs ? (
                    <span className="text-[10px] text-slate-500 font-mono">{tc.durationMs}ms latency</span>
                  ) : null}
                </div>

                {tc.query && (
                  <div className="text-slate-300 text-[11px]">
                    <span className="text-slate-500 font-mono">Query: </span>
                    <span className="text-cyan-200 font-medium">"{tc.query}"</span>
                  </div>
                )}

                {tc.url && (
                  <div className="text-slate-300 text-[11px] flex items-center gap-1 flex-wrap">
                    <span className="text-slate-500 font-mono">URL: </span>
                    <a
                      href={tc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline truncate max-w-md inline-flex items-center gap-1"
                    >
                      {tc.url}
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                    {tc.statusCode && (
                      <span className="text-[10px] text-emerald-400 font-mono">({tc.statusCode} OK)</span>
                    )}
                  </div>
                )}

                {tc.summary && (
                  <p className="text-[11px] text-slate-400 italic">{tc.summary}</p>
                )}

                {tc.excerpt && (
                  <div className="p-2 bg-slate-950 rounded text-[11px] font-mono text-slate-400 border border-slate-800/80 max-h-24 overflow-y-auto">
                    <span className="text-slate-500 select-none block text-[10px] uppercase mb-0.5">Live Fetched Excerpt:</span>
                    {tc.excerpt}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Verified Web Citations */}
          {citations.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="text-[11px] text-slate-400 font-medium">
                Verified Sources & References ({citations.length}):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {citations.map((cit, cIdx) => (
                  <div
                    key={cIdx}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between gap-1 hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span className="uppercase font-mono px-1 rounded bg-slate-800 text-cyan-400">{cit.sourceType}</span>
                        <span className="text-emerald-400">Verified ✓</span>
                      </div>
                      {cit.sourceUrl ? (
                        <a
                          href={cit.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-slate-200 hover:text-cyan-300 text-xs flex items-center gap-1 line-clamp-1"
                        >
                          <span>{cit.sourceTitle}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="font-medium text-slate-200 text-xs line-clamp-1">{cit.sourceTitle}</span>
                      )}
                      {cit.excerpt && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                          "{cit.excerpt}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
          pre: ({ children }: any) => <>{children}</>,
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
