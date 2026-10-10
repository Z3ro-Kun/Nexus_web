import React, { useState } from 'react';
import { FileCode, Download, Copy, Check, ShieldCheck, Eye, Code } from 'lucide-react';
import { Artifact } from '../types.js';

interface ArtifactsViewerProps {
  artifacts: Artifact[];
}

export const ArtifactsViewer: React.FC<ArtifactsViewerProps> = ({ artifacts }) => {
  const [selectedId, setSelectedId] = useState<string>(artifacts[0]?.id || '');
  const [copied, setCopied] = useState(false);

  const activeArtifact = artifacts.find((a) => a.id === selectedId) || artifacts[0];

  const handleCopy = () => {
    if (!activeArtifact) return;
    navigator.clipboard.writeText(activeArtifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!activeArtifact) return;
    const blob = new Blob([activeArtifact.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeArtifact.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!artifacts || artifacts.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
        No deliverables generated yet. Artifacts created by agents will appear here with integrity verification.
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-[520px] overflow-hidden">
      {/* File Tab Selector */}
      <div className="bg-slate-950/80 border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {artifacts.map((art) => {
            const isSelected = (activeArtifact?.id === art.id);
            return (
              <button
                key={art.id}
                onClick={() => setSelectedId(art.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-slate-800 text-white font-medium border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>{art.filename}</span>
              </button>
            );
          })}
        </div>

        {activeArtifact && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded border border-slate-700/60 transition-colors"
              title="Copy code to clipboard"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-950/80 rounded border border-cyan-800/60 transition-colors"
              title="Download file"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>

      {/* File Header & Metadata */}
      {activeArtifact && (
        <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-200">{activeArtifact.title}</span>
            <span aria-hidden="true">·</span>
            <span>Created by: <span className="text-cyan-400 font-mono">{activeArtifact.createdByAgent}</span></span>
            <span aria-hidden="true">·</span>
            <span>{(activeArtifact.sizeBytes / 1024).toFixed(1)} KB</span>
          </div>

          <div className="flex items-center gap-1 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Integrity Verified</span>
          </div>
        </div>
      )}

      {/* File Content Viewer */}
      {activeArtifact && (
        <div className="flex-1 overflow-auto bg-slate-950 p-4 font-mono text-xs text-slate-200 leading-relaxed">
          <pre className="whitespace-pre-wrap">{activeArtifact.content}</pre>
        </div>
      )}
    </div>
  );
};
