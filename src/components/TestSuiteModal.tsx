import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, AlertCircle, PlayCircle, Clock } from 'lucide-react';
import { api } from '../api.js';
import { TestSuiteReport } from '../types.js';

interface TestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestSuiteModal: React.FC<TestSuiteModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<TestSuiteReport | null>(null);
  const [running, setRunning] = useState(false);

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setRunning(true);
    try {
      const data = await api.runTestSuite();
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                Multi-Agent System Automated Verification Suite
              </h3>
              <p className="text-xs text-slate-400">
                Unit, integration, RAG, DAG parallel scheduler, and resilience tests.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <div>
              <div className="text-xs text-slate-400 mb-1">Status & Coverage</div>
              {report ? (
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-emerald-400">
                    {report.passedCount}/{report.totalTests} Passed
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400 font-mono">
                    Total Duration: {report.durationMs}ms
                  </span>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  Ready to execute system verification suite.
                </div>
              )}
            </div>

            <button
              onClick={handleRunTests}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 shadow-sm"
            >
              {running ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Running Suite...</span>
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  <span>Execute All Tests</span>
                </>
              )}
            </button>
          </div>

          {report && (
            <div className="space-y-2 font-mono text-xs">
              {report.results.map((test) => (
                <div
                  key={test.id}
                  className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
                    test.passed
                      ? 'bg-emerald-950/20 border-emerald-900/40 text-slate-200'
                      : 'bg-rose-950/20 border-rose-900/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {test.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 uppercase font-semibold">
                          [{test.category}]
                        </span>
                        <span className="font-medium text-slate-100">{test.name}</span>
                      </div>
                      {test.error && (
                        <div className="mt-1 text-[11px] text-rose-300 font-sans">
                          Error: {test.error}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                    {test.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
