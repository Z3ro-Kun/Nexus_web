import React, { useState } from 'react';
import { ShieldCheck, FileText, Settings, Plus, Cpu, MessageSquare, ChevronDown } from 'lucide-react';
import { TaskRecord } from '../types.js';

interface HeaderProps {
  currentTask: TaskRecord | null;
  tasks: TaskRecord[];
  onSelectTask: (taskId: string) => void;
  onNewTask: () => void;
  onOpenTests: () => void;
  onOpenConfig: () => void;
  onOpenDocs: () => void;
  docsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTask,
  tasks,
  onSelectTask,
  onNewTask,
  onOpenTests,
  onOpenConfig,
  onOpenDocs,
  docsCount,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const isRunning = currentTask && ['analyzing', 'planning', 'executing', 'reviewing', 'verifying', 'replanning'].includes(currentTask.status);

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-40 px-4 lg:px-8 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={onNewTask}
          title="Go to New Task page"
        >
          <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-white text-sm lg:text-base">
                Autonomous Multi-Agent System
              </span>
              <span className="text-[11px] text-cyan-400 font-mono">v2.5</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Chat & Artifacts</span>
              <span aria-hidden="true">·</span>
              <span>Autonomous Agents</span>
              <span aria-hidden="true">·</span>
              <span>Downloadable Code</span>
            </div>
          </div>
        </div>

        {isRunning && (
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-800 text-xs text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-medium">Active: {currentTask.status}</span>
            {currentTask.activeAgents.length > 0 && (
              <span className="text-slate-500">({currentTask.activeAgents.join(', ')})</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 relative">
        {/* Recent Chats Dropdown */}
        {tasks.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowHistory((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Recent Chats</span>
              <span className="text-slate-400 font-mono text-[11px]">({tasks.length})</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {showHistory && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-2.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Conversation History</span>
                  <button
                    onClick={onNewTask}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    + New Chat
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
                  {tasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onSelectTask(t.id);
                        setShowHistory(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex flex-col gap-0.5 ${
                        currentTask?.id === t.id
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="truncate">{t.title}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(t.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {t.artifacts?.length || 0} artifacts
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onOpenDocs}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors"
          title="Document Intelligence Knowledge Base"
        >
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Documents</span>
          {docsCount > 0 && <span className="text-slate-400 font-mono text-[11px]">({docsCount})</span>}
        </button>

        <button
          onClick={onOpenTests}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/60 rounded-md transition-colors"
          title="Run Automated Test Suite"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Tests</span>
        </button>

        <button
          onClick={onOpenConfig}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-md transition-colors"
          title="System Architecture & Model Config"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onNewTask}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>
    </header>
  );
};
