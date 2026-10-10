import React from 'react';
import { X, CheckCircle2, AlertCircle, Clock, ShieldCheck, Terminal, BookOpen } from 'lucide-react';
import { DAGNode } from '../types.js';

interface NodeDetailModalProps {
  node: DAGNode | null;
  onClose: () => void;
}

export const NodeDetailModal: React.FC<NodeDetailModalProps> = ({ node, onClose }) => {
  if (!node) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs mb-1">
              <span className="font-mono uppercase font-semibold text-cyan-400">
                {node.role}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 font-mono">ID: {node.id}</span>
              <span className="text-slate-500">·</span>
              <span
                className={`font-medium capitalize ${
                  node.status === 'completed'
                    ? 'text-emerald-400'
                    : node.status === 'running'
                    ? 'text-cyan-400'
                    : node.status === 'failed'
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {node.status}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white">{node.title}</h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Description */}
          <div>
            <div className="font-semibold text-slate-400 uppercase tracking-wider text-[11px] mb-1">
              Objective & Scope
            </div>
            <p className="leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              {node.description || 'No detailed description.'}
            </p>
          </div>

          {/* Acceptance Criteria */}
          <div>
            <div className="font-semibold text-slate-400 uppercase tracking-wider text-[11px] mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Acceptance Criteria</span>
            </div>
            <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              {node.acceptanceCriteria.map((crit, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                      node.status === 'completed' ? 'text-emerald-400' : 'text-slate-600'
                    }`}
                  />
                  <span>{crit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verification Tests */}
          {node.verification?.testsRun && node.verification.testsRun.length > 0 && (
            <div>
              <div className="font-semibold text-slate-400 uppercase tracking-wider text-[11px] mb-1.5 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>Deterministic Verification Tests</span>
              </div>
              <div className="space-y-2 bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                {node.verification.testsRun.map((t, idx) => (
                  <div key={idx} className="border-b border-slate-800/60 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-slate-200">{t.name}</span>
                      <span className={t.passed ? 'text-emerald-400' : 'text-rose-400'}>
                        [{t.passed ? 'PASSED' : 'FAILED'}]
                      </span>
                    </div>
                    <div className="text-slate-400 text-[10px]">{t.output}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Output Summary */}
          {node.output && (
            <div>
              <div className="font-semibold text-slate-400 uppercase tracking-wider text-[11px] mb-1">
                Execution Output Summary
              </div>
              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 leading-relaxed whitespace-pre-wrap">
                {node.output.summary}
              </div>
            </div>
          )}

          {/* Citations */}
          {node.output?.citations && node.output.citations.length > 0 && (
            <div>
              <div className="font-semibold text-slate-400 uppercase tracking-wider text-[11px] mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-teal-400" />
                <span>Retrieved Source Citations ({node.output.citations.length})</span>
              </div>
              <div className="space-y-2">
                {node.output.citations.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg text-[11px]"
                  >
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="font-medium text-slate-200">{c.sourceTitle}</span>
                      <span className="text-[10px]">{c.location || c.sourceType}</span>
                    </div>
                    <p className="text-slate-400 italic">"{c.excerpt}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Node Error / Replan Log */}
          {node.error && (
            <div className="p-3 bg-rose-950/30 border border-rose-800/60 rounded-lg text-rose-300">
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Execution Defect (Retry {node.retryCount}/3)</span>
              </div>
              <div className="font-mono text-[11px]">{node.error}</div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
