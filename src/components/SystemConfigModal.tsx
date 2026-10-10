import React, { useEffect, useState } from 'react';
import { X, Settings, Cpu, Wrench, Shield, CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { SystemConfig } from '../types.js';

interface SystemConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemConfigModal: React.FC<SystemConfigModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<SystemConfig | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getSystemConfig().then(setConfig).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">System Architecture & Model Engine</h3>
              <p className="text-xs text-slate-400">Provider-independent adapter layer and modular tool permissions</p>
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
        <div className="p-5 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* LLM Providers */}
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-200 uppercase tracking-wider text-[11px] mb-3">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Configured LLM Providers</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {config?.providers.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-100">{p.name}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          p.available ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {p.available ? 'ACTIVE' : 'STANDBY'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-1">
                      Default: {p.defaultModel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Role Models */}
          <div>
            <div className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] mb-3">
              Agent Role Model Assignments
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {config?.roleModels &&
                Object.entries(config.roleModels).map(([role, cfg]: [string, any]) => (
                  <div
                    key={role}
                    className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg text-[11px]"
                  >
                    <div className="font-semibold text-cyan-400 uppercase tracking-tight mb-0.5">
                      {role}
                    </div>
                    <div className="text-slate-300 capitalize">{cfg.provider}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">{cfg.model}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Registered Tools */}
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-200 uppercase tracking-wider text-[11px] mb-3">
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>Modular Tool Registry & Permissions</span>
            </div>
            <div className="space-y-2">
              {config?.tools.map((t) => (
                <div
                  key={t.name}
                  className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-slate-100">{t.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-amber-400 uppercase">
                        {t.permissionLevel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{t.description}</p>
                  </div>
                  <Shield className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
