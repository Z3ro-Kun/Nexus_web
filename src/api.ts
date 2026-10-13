import { TaskRecord, DocumentRecord, Artifact, TestSuiteReport, SystemConfig, UserRecord } from './types.js';

const TOKEN_KEY = 'agent_auth_session_token';

let authToken: string | null = (typeof localStorage !== 'undefined' && localStorage.getItem(TOKEN_KEY)) || null;

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
    headers['x-session-token'] = authToken;
  }
  return headers;
}

export const api = {
  getAuthToken(): string | null {
    return authToken;
  },

  setAuthToken(token: string | null): void {
    authToken = token;
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  },

  async getCurrentUser(): Promise<UserRecord | null> {
    if (!authToken) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 401) {
          this.setAuthToken(null);
        }
        return null;
      }
      return res.json();
    } catch {
      return null;
    }
  },

  async login(username: string, password: string): Promise<UserRecord> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to authenticate');
    }
    const data = await res.json();
    this.setAuthToken(data.token);
    return data.user;
  },

  async register(username: string, password: string, displayName?: string): Promise<UserRecord> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    this.setAuthToken(data.token);
    return data.user;
  },

  async logout(): Promise<void> {
    try {
      if (authToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: getAuthHeaders(),
        });
      }
    } finally {
      this.setAuthToken(null);
    }
  },

  async getTasks(): Promise<TaskRecord[]> {
    const res = await fetch('/api/tasks', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  async getTask(id: string): Promise<TaskRecord> {
    const res = await fetch(`/api/tasks/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch task');
    return res.json();
  },

  async submitTask(prompt: string): Promise<TaskRecord> {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to cancel task');
  },

  async deleteTask(taskId: string): Promise<boolean> {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete task');
    const data = await res.json();
    return Boolean(data.success);
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
