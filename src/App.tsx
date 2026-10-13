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
import { LoginPage } from './components/LoginPage.js';
import { api } from './api.js';
import { TaskRecord, DocumentRecord, DAGNode, AuditEvent, UserRecord } from './types.js';
import { MessageSquare, LayoutGrid, FileCode, Terminal } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
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

  // Initial load: Check if user session exists and fetch private data
  useEffect(() => {
    api.getCurrentUser()
      .then(async (user) => {
        if (user) {
          setCurrentUser(user);
          try {
            const [taskList, docs] = await Promise.all([api.getTasks(), api.getDocuments()]);
            setTasks(taskList);
            setDocuments(docs);
          } catch (e) {
            console.error('Failed to load user tasks/docs:', e);
          }
        }
      })
      .catch(console.error)
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  const handleLoginSuccess = async (user: UserRecord) => {
    setCurrentUser(user);
    setCurrentTask(null);
    setEvents([]);
    try {
      const [taskList, docs] = await Promise.all([api.getTasks(), api.getDocuments()]);
      setTasks(taskList);
      setDocuments(docs);
    } catch (e) {
      console.error('Failed to load tasks after login:', e);
    }
  };

  const handleLogout = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    await api.logout();
    setCurrentUser(null);
    setTasks([]);
    setCurrentTask(null);
    setEvents([]);
  };

  // Subscribe to SSE stream whenever currentTask ID changes
  useEffect(() => {
    if (!currentTask?.id) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = api.getAuthToken();
    const url = `/api/tasks/${currentTask.id}/events${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      if (!e.data || e.data.startsWith(':')) return;
      try {
        const evt: AuditEvent = JSON.parse(e.data);
        setEvents((prev) => {
          if (prev.some((p) => p.id === evt.id)) return prev;
          return [...prev, evt];
        });

        if (evt.type === 'clarification_requested') {
          setShowClarification(true);
        }

        // Only refresh task document on key milestones (not every stream chunk)
        if (evt.type === 'task_completed' || evt.type === 'task_failed' || evt.type === 'clarification_requested') {
          api.getTask(currentTask.id).then((t) => {
            setCurrentTask(t);
            setTasks((prev) => prev.map((item) => (item.id === t.id ? t : item)));
            if (t.status === 'waiting_clarification') {
              setShowClarification(true);
            }
          }).catch(() => {});
        }

        if (evt.type === 'task_completed' || evt.type === 'task_failed') {
          es.close();
        }
      } catch {
        // Ignore unparseable pings or heartbeat comments
      }
    };

    es.onerror = () => {
      // If task already reached terminal state, close cleanly without error logging
      if (currentTask.status === 'completed' || currentTask.status === 'failed') {
        es.close();
        return;
      }
      api.getTask(currentTask.id).then((t) => {
        setCurrentTask(t);
        setTasks((prev) => prev.map((item) => (item.id === t.id ? t : item)));
        if (t.status === 'completed' || t.status === 'failed') {
          es.close();
        }
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

  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (currentTask?.id === taskId) {
        setCurrentTask(null);
        setEvents([]);
      }
    } catch (err: any) {
      alert(`Error deleting chat: ${err.message}`);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-mono tracking-wider">Verifying secure session...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <Header
        currentTask={currentTask}
        tasks={tasks}
        currentUser={currentUser}
        onLogout={handleLogout}
        onSelectTask={loadTask}
        onDeleteTask={handleDeleteTask}
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
            currentUser={currentUser}
            onDocumentUploaded={(doc) => setDocuments((prev) => [doc, ...prev])}
            existingDocs={documents}
            recentTasks={tasks}
            onSelectTask={loadTask}
            onDeleteTask={handleDeleteTask}
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
                onDeleteTask={handleDeleteTask}
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
