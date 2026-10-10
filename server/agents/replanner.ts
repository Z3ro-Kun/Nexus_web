import { DAGNode } from '../db/store.js';
import { llmRouter } from '../llm/router.js';
import { AgentContext, AgentResult } from './types.js';

export interface ReplanResult {
  diagnosis: string;
  strategy: 'retry_node' | 'replan_subgraph' | 'escalate_human';
  nodesToReplan: string[]; // node IDs
  newNodes?: DAGNode[];
  reason: string;
}

export class ReplannerAgent {
  static async diagnoseAndReplan(
    context: AgentContext,
    failedNode: DAGNode,
    defectFindings: string[]
  ): Promise<ReplanResult> {
    const prompt = `You are a Principal Systems Replanner.
A task in the execution graph encountered an issue or failed verification:
Failed Task: "${failedNode.title}" (Role: ${failedNode.role}, ID: ${failedNode.id})
Error / Defect Findings:
${defectFindings.map((f) => `- ${f}`).join('\n') || failedNode.error || 'Unknown defect'}

Task Retries so far: ${failedNode.retryCount}/3

All Nodes in DAG:
${(context.allNodes || []).map((n) => `- [${n.id}] ${n.title} (Status: ${n.status})`).join('\n')}

Your responsibilities:
1. Diagnose root cause.
2. Determine surgical remedy:
   - If retryCount < 2 and error is transient or fixable in implementation: "retry_node"
   - If architectural assumption was wrong: "replan_subgraph"
   - If fundamentally impossible or retry limit exceeded: "escalate_human"
3. DO NOT restart completed nodes that succeeded and are unrelated. Replan ONLY affected downstream/dependent nodes.

Respond ONLY with valid JSON:
{
  "diagnosis": string,
  "strategy": "retry_node" | "replan_subgraph" | "escalate_human",
  "nodesToReplan": string[], // list of node IDs to reset to pending
  "remediationPlan": string
}`;

    const res = await llmRouter.callForRole('replanner', [{ role: 'user', content: prompt }], {
      responseFormat: 'json',
      systemInstruction: 'You are an adaptive Systems Replanner. Minimize wasted compute by surgically replanning only defective nodes.',
    });

    try {
      const cleanJson = res.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      let strategy: 'retry_node' | 'replan_subgraph' | 'escalate_human' = parsed.strategy || 'retry_node';
      if (failedNode.retryCount >= 2 && strategy === 'retry_node') {
        strategy = 'replan_subgraph';
      }
      if (failedNode.retryCount >= 3) {
        strategy = 'escalate_human';
      }

      return {
        diagnosis: parsed.diagnosis || `Defect diagnosed on node ${failedNode.id}.`,
        strategy,
        nodesToReplan: parsed.nodesToReplan || [failedNode.id],
        reason: parsed.remediationPlan || 'Targeted re-execution triggered.',
      };
    } catch {
      return {
        diagnosis: `Execution defect in ${failedNode.title}`,
        strategy: failedNode.retryCount < 2 ? 'retry_node' : 'escalate_human',
        nodesToReplan: [failedNode.id],
        reason: 'Targeted recovery attempt.',
      };
    }
  }
}
