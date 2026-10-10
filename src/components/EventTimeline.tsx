import React, { useEffect, useRef } from 'react';
import { Terminal, Cpu, Wrench, ShieldAlert, CheckCircle, RefreshCw, MessageSquare } from 'lucide-react';
import { AuditEvent } from '../types.js';

interface EventTimelineProps {
  events: AuditEvent[];
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[400px]">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Live Agent Execution Stream
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          {events.length} events logged
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-mono text-xs"
      >
        {events.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
            Connecting to agent event stream...
          </div>
        ) : (
          events.map((evt) => {
            let Icon = Cpu;
            let iconColor = 'text-cyan-400';
            let roleBg = 'bg-slate-800 text-slate-300';

            if (evt.type === 'tool_invoke' || evt.type === 'tool_result') {
              Icon = Wrench;
              iconColor = 'text-amber-400';
            } else if (evt.type === 'replan_triggered') {
              Icon = RefreshCw;
              iconColor = 'text-rose-400';
            } else if (evt.type === 'verification_check') {
              Icon = CheckCircle;
              iconColor = 'text-emerald-400';
            } else if (evt.type === 'clarification_requested') {
              Icon = MessageSquare;
              iconColor = 'text-amber-400';
            }

            return (
              <div
                key={evt.id}
                className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-lg flex items-start gap-2.5 hover:border-slate-700/80 transition-colors"
              >
                <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-0.5">
                    {evt.agentRole && (
                      <span className={`px-1.5 py-0.5 rounded uppercase font-semibold ${roleBg}`}>
                        {evt.agentRole}
                      </span>
                    )}
                    <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                    {evt.nodeId && <span className="text-slate-600">[{evt.nodeId}]</span>}
                  </div>
                  <div className="text-slate-300 leading-relaxed break-words font-sans text-xs">
                    {evt.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
