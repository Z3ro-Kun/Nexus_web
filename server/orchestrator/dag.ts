import { DAGNode } from '../db/store.js';

export class DAGScheduler {
  /**
   * Find all nodes that are currently 'pending' and whose dependencies
   * have all reached 'completed' status.
   * These can all be safely executed concurrently in parallel!
   */
  static getReadyNodes(nodes: DAGNode[]): DAGNode[] {
    const completedNodeIds = new Set(
      nodes.filter((n) => n.status === 'completed').map((n) => n.id)
    );

    return nodes.filter((n) => {
      if (n.status !== 'pending') return false;
      // All dependencies must be in completed status
      return n.dependencies.every((depId) => completedNodeIds.has(depId));
    });
  }

  /**
   * Check if any node is currently in 'running' status.
   */
  static hasRunningNodes(nodes: DAGNode[]): boolean {
    return nodes.some((n) => n.status === 'running');
  }

  /**
   * Check if all nodes in the DAG are finished ('completed' or 'skipped').
   */
  static isAllCompleted(nodes: DAGNode[]): boolean {
    return nodes.length > 0 && nodes.every((n) => n.status === 'completed' || n.status === 'skipped');
  }

  /**
   * Check if any node has failed.
   */
  static hasFailedNodes(nodes: DAGNode[]): boolean {
    return nodes.some((n) => n.status === 'failed');
  }

  /**
   * Check for circular dependencies in the DAG.
   */
  static hasCycles(nodes: DAGNode[]): boolean {
    const adj = new Map<string, string[]>();
    for (const n of nodes) {
      adj.set(n.id, [...n.dependencies]);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = adj.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // Cycle detected
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const n of nodes) {
      if (!visited.has(n.id)) {
        if (dfs(n.id)) return true;
      }
    }

    return false;
  }
}
