import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header.js';
import { InputWorkspace } from './components/InputWorkspace.js';
import { ChatView } from './components/ChatView.js';
import { DAGGraphView } from './components/DAGGraphView.js';
import { NodeDetailModal } from './components/NodeDetailModal.js';
import { EventTimeline } from './components/EventTimeline.js';
import { ArtifactsViewer } from './components/ArtifactsViewer.js';
import { ClarificationDialog } from './components/ClarificationDialog.js';
import { TestSuiteModal } from './components/TestSuiteModal.js';
import { DocumentsDrawer } from './components/DocumentsDrawer.js';
import { SystemConfigModal } from './components/SystemConfigModal.js';
import { api } from './api.js';
import { TaskRecord, DocumentRecord, DAGNode, AuditEvent } from './types.js';
import { MessageSquare, LayoutGrid, FileCode, Terminal } from 'lucide-react';

export default function App() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  // Initial landing page is clean New Task workspace (currentTask = null)
  const [currentTask, setCurrentTask] = useState<TaskRecord | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals & Panels
  const [selectedNode, setSelectedNode] = useState<DAGNode | null>(null);
  const [showClarification, setShowClarification] = useState(false);
  const [showTestSuite, setShowTestSuite] = useState(false);
  const [showDocsDrawer, setShowDocsDrawer] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'dag' | 'artifacts' | 'timeline'>('chat');

  const eventSourceRef = useRef<EventSource | null>(null);

  // Initial load: Fetch document library & past sessions list (do not auto-load past session)
  useEffect(() => {
    api.getDocuments().then(setDocuments).catch(console.error);
    api.getTasks().then((taskList) => {
      setTasks(taskList);
      // Keep landing page on New Task view as requested
    }).catch(console.error);
  }, []);

  // Subscribe to SSE stream whenever currentTask ID changes
  useEffect(() => {
    if (!currentTask?.id) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/tasks/${currentTask.id}/events`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const evt: AuditEvent = JSON.parse(e.data);
        setEvents((prev) => {
          if (prev.some((p) => p.id === evt.id)) return prev;
          return [...prev, evt];
        });

        // If clarification event or task state changes, refresh task
        if (evt.type === 'clarification_requested') {
          setShowClarification(true);
        }

        api.getTask(currentTask.id).then((t) => {
          setCurrentTask(t);
          setTasks((prev) => prev.map((item) => (item.id === t.id ? t : item)));
          if (t.status === 'waiting_clarification') {
            setShowClarification(true);
          }
        }).catch(console.error);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    es.onerror = () => {
      // Fallback polling
      api.getTask(currentTask.id).then((t) => {
        setCurrentTask(t);
        setTasks((prev) => prev.map((item) => (item.id === t.id ? t : item)));
      }).catch(() => {});
    };

    return () => {
      es.close();
    };
  }, [currentTask?.id]);

  const loadTask = async (taskId: string) => {
    try {
      const task = await api.getTask(taskId);
      setCurrentTask(task);
      setEvents(task.events || []);
      setActiveTab('chat');
      if (task.status === 'waiting_clarification') {
        setShowClarification(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartTask = async (prompt: string) => {
    setLoading(true);
    try {
      const task = await api.submitTask(prompt);
      setCurrentTask(task);
      setEvents([]);
      setTasks((prev) => [task, ...prev]);
      setActiveTab('chat');
    } catch (err: any) {
      alert(`Error submitting task: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFollowUp = async (prompt: string) => {
    if (!currentTask) return;
    setLoading(true);
    try {
      const updated = await api.submitFollowUp(currentTask.id, prompt);
      setCurrentTask(updated);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: any) {
      alert(`Follow-up failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerClarification = async (answer: string) => {
    if (!currentTask) return;
    try {
      const updated = await api.answerClarification(currentTask.id, answer);
      setCurrentTask(updated);
      setShowClarification(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <Header
        currentTask={currentTask}
        tasks={tasks}
        onSelectTask={loadTask}
        onNewTask={() => setCurrentTask(null)}
        onOpenTests={() => setShowTestSuite(true)}
        onOpenConfig={() => setShowConfig(true)}
        onOpenDocs={() => setShowDocsDrawer(true)}
        docsCount={documents.length}
      />

      <main className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full">
        {/* Landing Page: Clean New Task Workspace */}
        {!currentTask ? (
          <InputWorkspace
            onSubmit={handleStartTask}
            isLoading={loading}
            onDocumentUploaded={(doc) => setDocuments((prev) => [doc, ...prev])}
            existingDocs={documents}
          />
        ) : (
          <div className="space-y-4">
            {/* Tab Navigation Controls */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'chat'
                      ? 'bg-cyan-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat & Deliverables</span>
                </button>

                <button
                  onClick={() => setActiveTab('dag')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'dag'
                      ? 'bg-cyan-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Multi-Agent DAG</span>
                </button>

                <button
                  onClick={() => setActiveTab('artifacts')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'artifacts'
                      ? 'bg-cyan-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>All Artifacts ({currentTask.artifacts?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'timeline'
                      ? 'bg-cyan-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Live Stream ({events.length})</span>
                </button>
              </div>

              <button
                onClick={() => setCurrentTask(null)}
                className="text-xs text-slate-400 hover:text-white transition-colors font-medium hidden sm:block"
              >
                + Start New Task
              </button>
            </div>

            {/* Primary Tab View: Conversational Chat & Downloadable Artifacts */}
            {activeTab === 'chat' && (
              <ChatView
                task={currentTask}
                onSendFollowUp={handleSendFollowUp}
                isLoading={loading || ['analyzing', 'planning', 'executing', 'reviewing', 'verifying', 'replanning'].includes(currentTask.status)}
                onSelectNode={(node) => setSelectedNode(node)}
              />
            )}

            {/* View: Multi-Agent DAG Execution Graph */}
            {activeTab === 'dag' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <DAGGraphView
                  nodes={currentTask.plan?.nodes || []}
                  onSelectNode={(n) => setSelectedNode(n)}
                  selectedNodeId={selectedNode?.id}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <EventTimeline events={events} />
                  <ArtifactsViewer artifacts={currentTask.artifacts || []} />
                </div>
              </div>
            )}

            {/* View: All Generated Artifacts */}
            {activeTab === 'artifacts' && (
              <div className="animate-in fade-in duration-150">
                <ArtifactsViewer artifacts={currentTask.artifacts || []} />
              </div>
            )}

            {/* View: Real-Time Event Logs */}
            {activeTab === 'timeline' && (
              <div className="animate-in fade-in duration-150">
                <EventTimeline events={events} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals & Dialogs */}
      <NodeDetailModal
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />

      <ClarificationDialog
        task={currentTask}
        onAnswer={handleAnswerClarification}
        onClose={() => setShowClarification(false)}
      />

      <TestSuiteModal
        isOpen={showTestSuite}
        onClose={() => setShowTestSuite(false)}
      />

      <DocumentsDrawer
        isOpen={showDocsDrawer}
        onClose={() => setShowDocsDrawer(false)}
        documents={documents}
        onDocumentAdded={(doc) => setDocuments((prev) => [doc, ...prev])}
        onDocumentDeleted={(id) => setDocuments((prev) => prev.filter((d) => d.id !== id))}
      />

      <SystemConfigModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
      />
    </div>
  );
}
