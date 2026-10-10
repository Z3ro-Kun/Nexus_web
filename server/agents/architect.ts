import { llmRouter } from '../llm/router.js';
import { toolRegistry } from '../tools/registry.js';
import { AgentContext, AgentResult } from './types.js';

export class ArchitectAgent {
  static async execute(context: AgentContext): Promise<AgentResult> {
    const node = context.currentNode;
    const prompt = `You are a Principal Software Architect.
Task Objective: "${context.userPrompt}"
Specific Subtask: "${node?.title || 'System Architecture Design'}"
Description: "${node?.description || ''}"
Acceptance Criteria:
${(node?.acceptanceCriteria || []).map((c) => `- ${c}`).join('\n')}

Design a comprehensive, production-grade architecture specification:
1. System Topology & Component Boundaries
2. Domain Entities & Type Definitions (TypeScript)
3. Interface Contracts, State Transitions, and Invariants
4. Error Handling Strategy & Fault Tolerance

Write clean, concrete specifications without hand-waving. Include actual TypeScript interfaces and diagrams (in ASCII or Mermaid).`;

    const res = await llmRouter.callForRole('architect', [{ role: 'user', content: prompt }], {
      systemInstruction: 'You are an authoritative Software Architect. Deliver pristine, production-ready architectural specs.',
    });

    const content = res.text;
    const summary = `Architectural blueprint and domain contracts designed for ${context.userPrompt.slice(0, 60)}...`;

    const wantsDoc = /architect|system design|specification|rfc|blueprint|design doc/i.test(context.userPrompt);
    let created: string[] = [];

    if (wantsDoc) {
      const toolRes = await toolRegistry.invoke(
        'create_artifact',
        {
          filename: 'architecture_specification.md',
          title: 'System Architecture & Interface Specification',
          fileType: 'markdown',
          language: 'markdown',
          content,
        },
        {
          taskId: context.taskId,
          nodeId: node?.id,
          agentRole: 'architect',
        }
      );
      if (toolRes.success) created.push('architecture_specification.md');
    }

    return {
      role: 'architect',
      summary,
      details: content,
      artifactsCreated: created,
      data: {
        architectureDoc: content,
      },
    };
  }
}
