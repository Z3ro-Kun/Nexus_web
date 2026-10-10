import React from 'react';
import { Clock, Cpu, DollarSign, Wrench, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';
import { TaskRecord } from '../types.js';

interface TaskDashboardProps {
  task: TaskRecord;
  onCancel: () => void;
  onOpenClarification: () => void;
}

const LIFECYCLE_STAGES = [
  { id: 'analyzing', label: 'Requirements Analysis' },
  { id: 'planning', label: 'DAG Planning' },
  { id: 'executing', label: 'Task Execution' },
  { id: 'reviewing', label: 'Independent Review' },
  { id: 'verifying', label: 'Formal Verification' },
  { id: 'completed', label: 'Completed' },
];

export const TaskDashboard: React.FC<TaskDashboardProps> = ({
  task,
  onCancel,
  onOpenClarification,
}) => {
  const isRunning = ['analyzing', 'planning', 'executing', 'reviewing', 'verifying', 'replanning'].includes(task.status);
  const isClarifying = task.status === 'waiting_clarification';

  // Compute active stage index
  let activeIndex = 0;
  if (task.status === 'analyzing') activeIndex = 0;
  else if (task.status === 'planning') activeIndex = 1;
  else if (task.status === 'executing' || task.status === 'replanning') activeIndex = 2;
  else if (task.status === 'reviewing') activeIndex = 3;
  else if (task.status === 'verifying') activeIndex = 4;
  else if (task.status === 'completed') activeIndex = 5;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
      {/* Top Header: Objective & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Task ID: {task.id}</span>
            <span aria-hidden="true">·</span>
            <span>Started {new Date(task.createdAt).toLocaleTimeString()}</span>
          </div>
          <h2 className="text-base font-semibold text-white line-clamp-1">
            {task.userPrompt}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isClarifying && (
            <button
              onClick={onOpenClarification}
              className="px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors animate-pulse"
            >
              Respond to Clarification
            </button>
          )}

          {isRunning && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-md transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Execution</span>
            </button>
          )}
        </div>
      </div>

      {/* Lifecycle Progress Bar */}
      <div className="py-4 border-b border-slate-800">
        <div className="flex items-center justify-between text-xs mb-2">
          {LIFECYCLE_STAGES.map((st, idx) => {
            const isDone = idx < activeIndex || task.status === 'completed';
            const isCurrent = idx === activeIndex && task.status !== 'completed';

            return (
              <div
                key={st.id}
                className={`flex-1 text-center font-medium ${
                  isCurrent
                    ? 'text-cyan-400'
                    : isDone
                    ? 'text-slate-300'
                    : 'text-slate-600'
                }`}
              >
                <div className="text-[11px] uppercase tracking-wider">{st.label}</div>
              </div>
            );
          })}
        </div>

        {/* Bar */}
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
          {LIFECYCLE_STAGES.map((st, idx) => {
            const isDone = idx < activeIndex || task.status === 'completed';
            const isCurrent = idx === activeIndex && task.status !== 'completed';

            return (
              <div
                key={st.id}
                className={`flex-1 transition-all duration-300 ${
                  isCurrent
                    ? 'bg-cyan-400 animate-pulse'
                    : isDone
                    ? 'bg-emerald-500'
                    : 'bg-transparent'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Clarification Alert Banner */}
      {isClarifying && (
        <div className="mt-4 p-3.5 bg-amber-950/30 border border-amber-800/60 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold text-amber-300">Clarification Needed to Continue</div>
            <p className="text-amber-200/90 mt-0.5">{task.clarification?.question}</p>
          </div>
        </div>
      )}

      {/* Live Metrics Grid */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <div className="text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Duration</span>
          </div>
          <div className="mt-1 font-semibold text-slate-200 font-mono">
            {task.metrics.durationMs > 0
              ? `${(task.metrics.durationMs / 1000).toFixed(1)}s`
              : 'Executing...'}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <div className="text-slate-500 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>Total Tokens</span>
          </div>
          <div className="mt-1 font-semibold text-slate-200 font-mono">
            {task.metrics.totalTokens.toLocaleString()}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <div className="text-slate-500 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-400" />
            <span>Cost (USD)</span>
          </div>
          <div className="mt-1 font-semibold text-slate-200 font-mono">
            ${task.metrics.estimatedCostUsd.toFixed(5)}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <div className="text-slate-500 flex items-center gap-1">
            <Wrench className="w-3 h-3 text-amber-400" />
            <span>Artifacts</span>
          </div>
          <div className="mt-1 font-semibold text-slate-200 font-mono">
            {task.artifacts?.length || 0} files
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg">
          <div className="text-slate-500 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 text-rose-400" />
            <span>Replans</span>
          </div>
          <div className="mt-1 font-semibold text-slate-200 font-mono">
            {task.metrics.replanningCycles} cycles
          </div>
        </div>
      </div>
    </div>
  );
};
