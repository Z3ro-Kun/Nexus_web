import { DAGNode } from '../db/store.js';
import { llmRouter } from '../llm/router.js';
import { AgentContext, isArtifactNeeded } from './types.js';

export interface PlanOutput {
  objective: string;
  nodes: DAGNode[];
}

export class PlannerAgent {
  static async plan(context: AgentContext): Promise<PlanOutput> {
    const wantsArtifact = isArtifactNeeded(context.userPrompt);

    if (context.isFollowUp) {
      const userMsgs = (context.conversationHistory || []).filter((m: any) => m.sender === 'user');
      const originalUserMsg = userMsgs[0]?.content || context.userPrompt;
      const isMetaFeedback = /^(you (didn't|did not|didnt) (give|provide|show|output|answer)|why (no|is there no|didn't you) output|give me (an? )?output|where is the (output|answer|response)|retry|repeat|no output)/i.test(context.userPrompt);
      const effectiveTopic = isMetaFeedback ? originalUserMsg : context.userPrompt;

      if (!wantsArtifact) {
        return {
          objective: isMetaFeedback
            ? `Address inquiry and provide complete response for: "${effectiveTopic}"`
            : `Address user follow-up inquiry: "${context.userPrompt}"`,
          nodes: [
            {
              id: 'followup_research_1',
              title: `Investigate Evidence & Details (${effectiveTopic.slice(0, 40)})`,
              description: 'Retrieve technical context, live standings evidence, or verified references.',
              role: 'researcher',
              dependencies: [],
              status: 'pending',
              inputs: {},
              expectedOutputs: 'Verified evidence notes and reference findings.',
              acceptanceCriteria: [
                'Collects verified facts and documentation without hallucination',
                'Identifies real-world sources and context',
              ],
              retryCount: 0,
            },
            {
              id: 'followup_impl_2',
              title: `Synthesize Factual Follow-Up Response (${effectiveTopic.slice(0, 40)})`,
              description: 'Compose a direct, comprehensive, and authoritative response addressing the user prompt.',
              role: 'implementer',
              dependencies: ['followup_research_1'],
              status: 'pending',
              inputs: {},
              expectedOutputs: 'Direct technical answer answering user follow-up.',
              acceptanceCriteria: [
                'Directly and accurately answers the user follow-up question',
                'Clearly distinguishes verified facts from unverified inferences',
              ],
              retryCount: 0,
            },
            {
              id: 'followup_review_3',
              title: 'Independent Review of Explanation & Accuracy',
              description: 'Audit the synthesized response for factual accuracy, safety, and clarity.',
              role: 'reviewer',
              dependencies: ['followup_impl_2'],
              status: 'pending',
              inputs: {},
              expectedOutputs: 'Review verification verdict.',
              acceptanceCriteria: [
                'Response is free of hallucinations or fabricated URLs/ranks',
                'Accurately reflects official regulations and verified evidence',
              ],
              retryCount: 0,
            },
            {
              id: 'followup_verify_4',
              title: 'Verify Response Completeness & Reliability',
              description: 'Validate that the follow-up request is fully answered with high integrity.',
              role: 'verifier',
              dependencies: ['followup_review_3'],
              status: 'pending',
              inputs: {},
              expectedOutputs: 'Formal verification verdict.',
              acceptanceCriteria: [
                'User follow-up is thoroughly and truthfully addressed',
                'No unverified claims or broken promises',
              ],
              retryCount: 0,
            },
          ],
        };
      }

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

PLANNING CONSTRAINT:
${wantsArtifact ? 'The user is requesting a tangible code deliverable/file. Plan tasks to design, implement, review, and formally verify the requested deliverable.' : 'The user asked an informational, conceptual, or conversational question. Do NOT plan file deliverable generation or file artifact creation tasks. Decompose into technical evidence research, comprehensive explanation synthesis, factual review, and completeness verification.'}

RULES:
1. Decompose into 3 to 5 focused tasks assigned to specialized roles:
   - "researcher": Web facts, standards, references, background concepts.
   - "implementer": ${wantsArtifact ? 'Code generation, runnable files, and tool calculations.' : 'Synthesis of comprehensive, well-structured explanation and technical answer.'}
   - "reviewer": Technical correctness and conceptual accuracy audit.
   - "verifier": Completeness validation and acceptance criteria check.
2. Exploit PARALLEL execution where prerequisites allow.
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
    const wantsArtifact = isArtifactNeeded(prompt);

    if (!wantsArtifact) {
      return {
        objective: prompt,
        nodes: [
          {
            id: 'dag_research_1',
            title: 'Gather Technical References & Evidence',
            description: 'Extract technical standards, concepts, and factual background for the question.',
            role: 'researcher',
            dependencies: [],
            status: 'pending',
            inputs: {},
            expectedOutputs: 'Verified technical facts and references.',
            acceptanceCriteria: [
              'Technical background and core concepts are factually verified',
              'Relevant standards or examples are cited',
            ],
            retryCount: 0,
          },
          {
            id: 'dag_synth_2',
            title: 'Synthesize Comprehensive Technical Explanation',
            description: 'Formulate an authoritative, structured explanation with code examples if helpful.',
            role: 'implementer',
            dependencies: ['dag_research_1'],
            status: 'pending',
            inputs: {},
            expectedOutputs: 'Detailed technical explanation and structured answer.',
            acceptanceCriteria: [
              'Directly answers the user question with zero irrelevant placeholders',
              'Formatted in clear Markdown with concrete explanations',
            ],
            retryCount: 0,
          },
          {
            id: 'dag_review_3',
            title: 'Review Explanation for Accuracy and Clarity',
            description: 'Audit the synthesized explanation for conceptual correctness and readability.',
            role: 'reviewer',
            dependencies: ['dag_synth_2'],
            status: 'pending',
            inputs: {},
            expectedOutputs: 'Review audit findings.',
            acceptanceCriteria: [
              'Explanation is free of misleading or hallucinated claims',
              'Adheres to modern software engineering best practices',
            ],
            retryCount: 0,
          },
          {
            id: 'dag_verify_4',
            title: 'Verify Response Completeness',
            description: 'Validate that all aspects of the user query are answered satisfactorily.',
            role: 'verifier',
            dependencies: ['dag_review_3'],
            status: 'pending',
            inputs: {},
            expectedOutputs: 'Verification report.',
            acceptanceCriteria: [
              'User query fully addressed without missing core aspects',
              'Zero unfulfilled claims or dangling promises',
            ],
            retryCount: 0,
          },
        ],
      };
    }

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
