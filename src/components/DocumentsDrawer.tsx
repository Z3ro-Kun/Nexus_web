import React, { useRef, useState } from 'react';
import { X, Upload, FileText, Trash2, CheckCircle2, Layers } from 'lucide-react';
import { api } from '../api.js';
import { DocumentRecord } from '../types.js';

interface DocumentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentRecord[];
  onDocumentAdded: (doc: DocumentRecord) => void;
  onDocumentDeleted: (id: string) => void;
}

export const DocumentsDrawer: React.FC<DocumentsDrawerProps> = ({
  isOpen,
  onClose,
  documents,
  onDocumentAdded,
  onDocumentDeleted,
}) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await api.uploadDocument(file);
        if (res.success) {
          onDocumentAdded(res.document);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteDocument(id);
      onDocumentDeleted(id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Document Intelligence Store</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json"
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-colors"
          >
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>{uploading ? 'Processing & Indexing Chunks...' : 'Upload Knowledge Document'}</span>
          </button>
          <div className="mt-2 text-[11px] text-center text-slate-500">
            Supported formats: PDF, DOCX, TXT, Markdown, CSV, JSON
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {documents.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-500">
              No documents in knowledge base. Upload documents to empower Researcher agent with RAG evidence passages.
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 truncate">{doc.filename}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {doc.metadata?.format?.toUpperCase() || 'DOCUMENT'} · {(doc.fileSize / 1024).toFixed(1)} KB · {doc.chunkCount} indexed chunks
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                    title="Remove from index"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
