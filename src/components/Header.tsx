import React, { useState } from 'react';
import { ShieldCheck, FileText, Settings, Plus, Cpu, MessageSquare, ChevronDown, Trash2, User, LogOut, Check, Lock, Sparkles } from 'lucide-react';
import { TaskRecord, UserRecord } from '../types.js';

interface HeaderProps {
  currentTask: TaskRecord | null;
  tasks: TaskRecord[];
  currentUser: UserRecord | null;
  onLogout: () => void;
  onSelectTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onNewTask: () => void;
  onOpenTests: () => void;
  onOpenConfig: () => void;
  onOpenDocs: () => void;
  docsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTask,
  tasks,
  currentUser,
  onLogout,
  onSelectTask,
  onDeleteTask,
  onNewTask,
  onOpenTests,
  onOpenConfig,
  onOpenDocs,
  docsCount,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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
        {/* User Session Switcher (Isolated Private Sessions) */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu((prev) => !prev)}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors"
            title="User Session & Data Isolation"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-950 uppercase shrink-0"
              style={{ backgroundColor: currentUser?.avatarColor || '#06b6d4' }}
            >
              {currentUser?.username?.[0] || 'A'}
            </div>
            <div className="flex flex-col text-left leading-tight hidden sm:block">
              <span className="font-semibold text-white truncate max-w-[100px]">
                {currentUser?.displayName || currentUser?.username || 'User A'}
              </span>
              <span className="text-[9px] text-cyan-400 font-mono">Private Session</span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-slate-800 bg-slate-950/80">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-slate-950 uppercase shrink-0 ring-2 ring-cyan-500/30"
                    style={{ backgroundColor: currentUser?.avatarColor || '#06b6d4' }}
                  >
                    {currentUser?.username?.[0] || 'U'}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-semibold text-white text-sm truncate">
                      {currentUser?.displayName || currentUser?.username || 'User Profile'}
                    </div>
                    <div className="text-xs text-cyan-400 font-mono">
                      @{currentUser?.username || 'user'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border-b border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>User Account ID:</span>
                  <span className="font-mono text-slate-300 text-[11px] truncate max-w-[140px]">
                    {currentUser?.id}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Session Security:</span>
                  <span className="flex items-center gap-1 text-teal-400 text-[11px] font-medium">
                    <Check className="w-3 h-3" />
                    <span>Isolated & Encrypted</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Chats in Private Memory:</span>
                  <span className="font-mono text-slate-300 text-[11px]">
                    {tasks.length} task session{tasks.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950/60">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out of Account</span>
                </button>
              </div>
            </div>
          )}
        </div>

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
                    <div
                      key={t.id}
                      className={`w-full group p-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                        currentTask?.id === t.id
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <button
                        onClick={() => {
                          onSelectTask(t.id);
                          setShowHistory(false);
                        }}
                        className="flex-1 text-left min-w-0 flex flex-col gap-0.5"
                      >
                        <span className="truncate">{t.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(t.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {t.artifacts?.length || 0} artifacts
                        </span>
                      </button>
                      {deleteConfirmId === t.id ? (
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setDeleteConfirmId(null);
                              onDeleteTask(t.id);
                            }}
                            className="px-1.5 py-0.5 text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-medium rounded transition-colors"
                            title="Confirm delete chat"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-1 py-0.5 text-[10px] text-slate-400 hover:text-white"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(t.id);
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors shrink-0 opacity-70 group-hover:opacity-100"
                          title="Delete this chat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
