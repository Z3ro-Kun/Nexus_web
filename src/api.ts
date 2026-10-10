import { TaskRecord, DocumentRecord, Artifact, TestSuiteReport, SystemConfig } from './types.js';

export const api = {
  async getTasks(): Promise<TaskRecord[]> {
    const res = await fetch('/api/tasks');
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  async getTask(id: string): Promise<TaskRecord> {
    const res = await fetch(`/api/tasks/${id}`);
    if (!res.ok) throw new Error('Failed to fetch task');
    return res.json();
  },

  async submitTask(prompt: string): Promise<TaskRecord> {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit task');
    }
    return res.json();
  },

  async submitFollowUp(taskId: string, prompt: string): Promise<TaskRecord> {
    const res = await fetch(`/api/tasks/${taskId}/follow-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit follow-up');
    }
    return res.json();
  },

  async answerClarification(taskId: string, answer: string): Promise<TaskRecord> {
    const res = await fetch(`/api/tasks/${taskId}/clarify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to answer clarification');
    }
    return res.json();
  },

  async cancelTask(taskId: string): Promise<void> {
    const res = await fetch(`/api/tasks/${taskId}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to cancel task');
  },

  async uploadDocument(file: File): Promise<{ success: boolean; document: DocumentRecord }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const res = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              contentBase64: base64,
              mimeType: file.type || 'text/plain',
            }),
          });
          if (!res.ok) throw new Error('Failed to upload document');
          const data = await res.json();
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async getDocuments(): Promise<DocumentRecord[]> {
    const res = await fetch('/api/documents');
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  async deleteDocument(id: string): Promise<void> {
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete document');
  },

  async getArtifact(id: string): Promise<Artifact> {
    const res = await fetch(`/api/artifacts/${id}`);
    if (!res.ok) throw new Error('Failed to fetch artifact');
    return res.json();
  },

  async runTestSuite(): Promise<TestSuiteReport> {
    const res = await fetch('/api/tests/run', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to run test suite');
    return res.json();
  },

  async getSystemConfig(): Promise<SystemConfig> {
    const res = await fetch('/api/system/config');
    if (!res.ok) throw new Error('Failed to fetch system config');
    return res.json();
  },
};
