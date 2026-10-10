import { DAGNode } from '../db/store.js';
import { llmRouter } from '../llm/router.js';
import { AgentContext } from './types.js';

export interface PlanOutput {
  objective: string;
  nodes: DAGNode[];
}

export class PlannerAgent {
  static async plan(context: AgentContext): Promise<PlanOutput> {
    if (context.isFollowUp) {
      return {
        objective: `Update deliverables for follow-up: "${context.userPrompt}"`,
        nodes: [
          {
            id: 'followup_impl_1',
            title: `Update Artifact Deliverables (${context.userPrompt.slice(0, 45)})`,
            description: 'Apply the requested updates, enhancements, or tests to the existing deliverables.',
            role: 'implementer',
            dependencies: [],
            status: 'pending',
            inputs: {},
            expectedOutputs: 'Updated source code deliverable artifact.',
            acceptanceCriteria: [
              'Existing artifact is updated with requested features or tests',
              'Code passes syntax and structural integrity assertions',
            ],
            retryCount: 0,
          },
          {
            id: 'followup_review_2',
            title: 'Independent Review of Modifications',
            description: 'Audit the updated deliverable for correctness and clean patterns.',
            role: 'reviewer',
            dependencies: ['followup_impl_1'],
            status: 'pending',
            inputs: {},
            expectedOutputs: 'Code review verification verdict.',
            acceptanceCriteria: [
              'Modifications satisfy the user follow-up prompt',
              'No regressions or syntax defects introduced',
            ],
            retryCount: 0,
          },
          {
            id: 'followup_verify_3',
            title: 'Verify Deliverable Integrity & Run Tests',
            description: 'Execute automated verification checks on the updated artifact.',
            role: 'verifier',
            dependencies: ['followup_review_2'],
            status: 'pending',
            inputs: {},
            expectedOutputs: 'Verification report and passing assertions.',
            acceptanceCriteria: [
              'All acceptance criteria proven satisfied on updated files',
            ],
            retryCount: 0,
          },
        ],
      };
    }

    const prompt = `You are an expert System Planner and Technical Lead.
Create a structured Directed Acyclic Graph (DAG) execution plan for the following user objective:
"${context.userPrompt}"

Assumptions established:
${context.assumptions.map((a) => `- ${a}`).join('\n') || '- Standard production conventions'}

Available Document Context:
${context.documentEvidence ? context.documentEvidence.slice(0, 800) : 'None'}

RULES:
1. Decompose into 4 to 6 focused tasks assigned to specialized roles:
   - "architect": Schema, component interfaces, architectural blueprints.
   - "researcher": Web facts, document extraction, domain formulas, standards.
   - "implementer": Code generation, tool calculations, runnable files.
   - "reviewer": Independent security, maintainability, and code audit.
   - "verifier": Substantive verification, test execution, acceptance criteria validation.
2. Exploit PARALLEL execution:
   - Tasks with NO dependencies run in parallel at the start (e.g. "architect" and "researcher" should run concurrently!).
3. Dependent tasks must explicitly list prerequisite node IDs in "dependencies".
4. Every node MUST have clear, measurable "acceptanceCriteria" (at least 2).

Respond ONLY with valid JSON matching:
{
  "objective": string,
  "nodes": [
    {
      "id": "node_1",
      "title": string,
      "description": string,
      "role": "architect" | "researcher" | "implementer" | "reviewer" | "verifier",
      "dependencies": string[],
      "expectedOutputs": string,
      "acceptanceCriteria": string[]
    }
  ]
}`;

    const res = await llmRouter.callForRole('planner', [{ role: 'user', content: prompt }], {
      responseFormat: 'json',
      systemInstruction: 'You are a meticulous Technical Planner. Return only valid JSON for the DAG plan.',
    });

    try {
      const cleanJson = res.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      const nodes: DAGNode[] = (parsed.nodes || []).map((n: any, idx: number) => ({
        id: n.id || `node_${idx + 1}`,
        title: n.title || `Task ${idx + 1}`,
        description: n.description || '',
        role: n.role || 'implementer',
        dependencies: Array.isArray(n.dependencies) ? n.dependencies : [],
        status: 'pending',
        inputs: {},
        expectedOutputs: n.expectedOutputs || 'Deliverable output',
        acceptanceCriteria: Array.isArray(n.acceptanceCriteria) ? n.acceptanceCriteria : ['Task meets specified requirements'],
        retryCount: 0,
      }));

      // Validate DAG to ensure no cycles and valid IDs
      this.validateDAG(nodes);

      return {
        objective: parsed.objective || context.userPrompt,
        nodes,
      };
    } catch (err) {
      console.warn('[PlannerAgent] Falling back to default DAG plan template:', err);
      return this.getDefaultPlan(context.userPrompt);
    }
  }

  private static validateDAG(nodes: DAGNode[]): void {
    const ids = new Set(nodes.map((n) => n.id));
    for (const n of nodes) {
      n.dependencies = n.dependencies.filter((d) => ids.has(d) && d !== n.id);
    }
  }

  private static getDefaultPlan(prompt: string): PlanOutput {
    return {
      objective: prompt,
      nodes: [
        {
          id: 'dag_arch_1',
          title: 'Design Architectural Specifications & Data Contracts',
          description: 'Establish domain interfaces, data models, and component boundaries.',
          role: 'architect',
          dependencies: [],
          status: 'pending',
          inputs: {},
          expectedOutputs: 'Architecture document and TypeScript type definitions.',
          acceptanceCriteria: [
            'All public interfaces and data models are strictly typed',
            'Architecture specifies error handling and separation of concerns',
          ],
          retryCount: 0,
        },
        {
          id: 'dag_research_2',
          title: 'Gather Technical References & Document Evidence',
          description: 'Extract technical standards, API contracts, and uploaded document facts.',
          role: 'researcher',
          dependencies: [],
          status: 'pending',
          inputs: {},
          expectedOutputs: 'Verified citations and reference formulas.',
          acceptanceCriteria: [
            'All technical facts link to cited document or web sources',
            'Untrusted data instructions are safely isolated',
          ],
          retryCount: 0,
        },
        {
          id: 'dag_impl_3',
          title: 'Implement Core Components & Execute Calculations',
          description: 'Write complete production source code and compute formulas.',
          role: 'implementer',
          dependencies: ['dag_arch_1', 'dag_research_2'],
          status: 'pending',
          inputs: {},
          expectedOutputs: 'Runnable code files and execution results.',
          acceptanceCriteria: [
            'Deliverables are fully implemented without stub placeholders',
            'Mathematical computations verified by calculator',
          ],
          retryCount: 0,
        },
        {
          id: 'dag_review_4',
          title: 'Perform Independent Code Review & Security Audit',
          description: 'Inspect implementation for security vulnerabilities, edge cases, and code standards.',
          role: 'reviewer',
          dependencies: ['dag_impl_3'],
          status: 'pending',
          inputs: {},
          expectedOutputs: 'Review findings with security and quality checklist.',
          acceptanceCriteria: [
            'No unhandled error cases or injection risks',
            'Code follows idiomatic language standards',
          ],
          retryCount: 0,
        },
        {
          id: 'dag_verify_5',
          title: 'Execute Verification Test Suite & Acceptance Checks',
          description: 'Execute runnable tests, evaluate criteria, and verify artifact integrity.',
          role: 'verifier',
          dependencies: ['dag_review_4'],
          status: 'pending',
          inputs: {},
          expectedOutputs: 'Formal verification report with pass/fail verdict.',
          acceptanceCriteria: [
            'All acceptance criteria proven satisfied with executable evidence',
            'Deliverables exist, have non-zero size, and pass structural validation',
          ],
          retryCount: 0,
        },
      ],
    };
  }
}
