import { Response } from 'express';
import { AuditEvent, db } from '../db/store.js';

class EventHub {
  private subscribers: Map<string, Set<Response>> = new Map();

  subscribe(taskId: string, res: Response): () => void {
    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }

    const set = this.subscribers.get(taskId)!;
    set.add(res);

    // Return unsubscribe callback
    return () => {
      set.delete(res);
      if (set.size === 0) {
        this.subscribers.delete(taskId);
      }
    };
  }

  broadcast(event: AuditEvent): void {
    db.appendEvent(event);

    const set = this.subscribers.get(event.taskId);
    if (!set || set.size === 0) return;

    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of set) {
      try {
        res.write(data);
      } catch (err) {
        set.delete(res);
      }
    }
  }

  emit(
    taskId: string,
    type: AuditEvent['type'],
    message: string,
    options: {
      agentRole?: string;
      nodeId?: string;
      payload?: any;
    } = {}
  ): void {
    const event: AuditEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      taskId,
      timestamp: Date.now(),
      type,
      agentRole: options.agentRole,
      nodeId: options.nodeId,
      message,
      payload: options.payload,
    };
    this.broadcast(event);
  }
}

export const eventHub = new EventHub();
