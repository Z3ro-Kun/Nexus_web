import React, { useState } from 'react';
import { HelpCircle, Send, X } from 'lucide-react';
import { TaskRecord } from '../types.js';

interface ClarificationDialogProps {
  task: TaskRecord | null;
  onAnswer: (answer: string) => Promise<void>;
  onClose: () => void;
}

export const ClarificationDialog: React.FC<ClarificationDialogProps> = ({
  task,
  onAnswer,
  onClose,
}) => {
  const [customAnswer, setCustomAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!task || !task.clarification || task.status !== 'waiting_clarification') {
    return null;
  }

  const handleSelectOption = async (option: string) => {
    setSubmitting(true);
    try {
      await onAnswer(option);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAnswer.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAnswer(customAnswer.trim());
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-600/60 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 bg-amber-950/40 border-b border-amber-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-300">
            <HelpCircle className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-sm">Requirements Clarification Required</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-xs text-slate-400">
            The Requirements Analyst detected material ambiguity or missing parameters in your objective:
          </div>

          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-sm font-medium text-slate-100 leading-relaxed">
            "{task.clarification.question}"
          </div>

          {/* Suggested Quick Options */}
          {task.clarification.options && task.clarification.options.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Suggested Directions:
              </div>
              <div className="space-y-2">
                {task.clarification.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(opt)}
                    disabled={submitting}
                    className="w-full text-left p-3 text-xs bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/60 rounded-lg text-slate-200 transition-all font-medium"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Answer Input */}
          <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-slate-800">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Or provide specific instructions:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customAnswer}
                onChange={(e) => setCustomAnswer(e.target.value)}
                placeholder="Type clarification..."
                disabled={submitting}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={!customAnswer.trim() || submitting}
                className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" />
                <span>Resume</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
