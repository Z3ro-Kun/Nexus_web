import React from 'react';
import { CheckCircle2, Clock, PlayCircle, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { DAGNode } from '../types.js';

interface DAGGraphViewProps {
  nodes: DAGNode[];
  onSelectNode: (node: DAGNode) => void;
  selectedNodeId?: string;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  architect: { bg: 'bg-indigo-950/40', text: 'text-indigo-400', border: 'border-indigo-800/60' },
  planner: { bg: 'bg-cyan-950/40', text: 'text-cyan-400', border: 'border-cyan-800/60' },
  requirements: { bg: 'bg-blue-950/40', text: 'text-blue-400', border: 'border-blue-800/60' },
  researcher: { bg: 'bg-teal-950/40', text: 'text-teal-400', border: 'border-teal-800/60' },
  implementer: { bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-800/60' },
  reviewer: { bg: 'bg-purple-950/40', text: 'text-purple-400', border: 'border-purple-800/60' },
  verifier: { bg: 'bg-amber-950/40', text: 'text-amber-400', border: 'border-amber-800/60' },
  replanner: { bg: 'bg-rose-950/40', text: 'text-rose-400', border: 'border-rose-800/60' },
};

export const DAGGraphView: React.FC<DAGGraphViewProps> = ({
  nodes,
  onSelectNode,
  selectedNodeId,
}) => {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800/60">
        Waiting for Planner agent to generate DAG task dependency graph...
      </div>
    );
  }

  // Calculate dependency levels (topological ranks)
  const nodeLevelMap = new Map<string, number>();

  const computeLevel = (nodeId: string, visited = new Set<string>()): number => {
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.dependencies.length === 0) return 0;

    let maxDep = 0;
    for (const depId of node.dependencies) {
      maxDep = Math.max(maxDep, computeLevel(depId, new Set(visited)) + 1);
    }
    return maxDep;
  };

  for (const n of nodes) {
    nodeLevelMap.set(n.id, computeLevel(n.id));
  }

  // Group nodes by level to show parallel execution tiers
  const maxLevel = Math.max(...Array.from(nodeLevelMap.values()), 0);
  const tiers: DAGNode[][] = [];
  for (let l = 0; l <= maxLevel; l++) {
    tiers.push(nodes.filter((n) => nodeLevelMap.get(n.id) === l));
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>Execution Plan: Directed Acyclic Graph (DAG)</span>
            <span className="text-xs text-slate-500 font-normal">
              · {nodes.length} tasks · Parallel dependency scheduling
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /> Running
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-600" /> Pending
          </span>
        </div>
      </div>

      {/* Visual Tiers (Parallel Batches) */}
      <div className="flex items-stretch gap-6 min-w-[700px] py-2">
        {tiers.map((tierNodes, tierIdx) => (
          <div key={tierIdx} className="flex-1 flex flex-col justify-center gap-3 relative">
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <span>Batch {tierIdx + 1}</span>
              {tierNodes.length > 1 && (
                <span className="text-cyan-400 font-medium">(Parallel)</span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {tierNodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const roleStyle = ROLE_COLORS[node.role] || ROLE_COLORS.implementer;

                return (
                  <button
                    key={node.id}
                    onClick={() => onSelectNode(node)}
                    className={`text-left p-3.5 rounded-lg border transition-all relative ${roleStyle.bg} ${
                      isSelected
                        ? 'border-cyan-400 ring-1 ring-cyan-400/50 shadow-lg bg-slate-800'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/90'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={`font-mono font-medium ${roleStyle.text}`}>
                        {node.role.toUpperCase()}
                      </span>

                      {/* Status Icon */}
                      {node.status === 'completed' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {node.status === 'running' && (
                        <PlayCircle className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                      )}
                      {node.status === 'failed' && (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      {node.status === 'replanned' && (
                        <RefreshCw className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      {node.status === 'pending' && (
                        <Clock className="w-4 h-4 text-slate-600 shrink-0" />
                      )}
                    </div>

                    <h4 className="text-xs font-semibold text-slate-200 line-clamp-1 mb-1">
                      {node.title}
                    </h4>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {node.description}
                    </p>

                    {node.dependencies.length > 0 && (
                      <div className="mt-2 text-[10px] text-slate-500 font-mono">
                        Prereqs: {node.dependencies.join(', ')}
                      </div>
                    )}

                    {node.retryCount > 0 && (
                      <div className="mt-1 text-[10px] text-amber-400">
                        Retries: {node.retryCount}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
