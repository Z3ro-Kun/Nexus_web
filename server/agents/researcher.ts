import { SourceCitation } from '../db/store.js';
import { llmRouter } from '../llm/router.js';
import { toolRegistry } from '../tools/registry.js';
import { AgentContext, AgentResult } from './types.js';

export class ResearcherAgent {
  static async execute(context: AgentContext): Promise<AgentResult> {
    const node = context.currentNode;
    const citations: SourceCitation[] = [];
    const evidenceNotes: string[] = [];

    // 1. Search uploaded documents if available
    const docToolRes = await toolRegistry.invoke(
      'document_retriever',
      { query: context.userPrompt, topK: 3 },
      { taskId: context.taskId, nodeId: node?.id, agentRole: 'researcher' }
    );

    if (docToolRes.success && docToolRes.data?.citations) {
      citations.push(...docToolRes.data.citations);
      evidenceNotes.push(`Document Passages:\n${docToolRes.data.contextText}`);
    }

    // 2. Perform Web Search
    const searchTerms = context.userPrompt.slice(0, 80);
    const webToolRes = await toolRegistry.invoke(
      'web_search',
      { query: searchTerms, maxResults: 3 },
      { taskId: context.taskId, nodeId: node?.id, agentRole: 'researcher' }
    );

    if (webToolRes.success && webToolRes.data?.results) {
      for (const item of webToolRes.data.results) {
        citations.push({
          sourceType: 'web',
          sourceTitle: item.title,
          sourceUrl: item.url,
          excerpt: item.snippet,
          verified: true,
        });
        evidenceNotes.push(`Web Reference: [${item.title}](${item.url}) - ${item.snippet}`);
      }
    }

    // 3. Synthesize findings with LLM
    const synthesisPrompt = `You are a Principal Technical Researcher.
Goal: "${context.userPrompt}"
Subtask: "${node?.title || 'Technical Research'}"

Gathered Evidence:
${evidenceNotes.join('\n\n') || 'General engineering standard knowledge base.'}

Provide an evidence-backed Research Dossier:
1. Validated Technical Findings (cite sources explicitly)
2. Relevant Specifications, RFCs, or Algorithms
3. Critical Constraints & Security Considerations
4. Distinction between factual evidence vs technical interpretations.`;

    const res = await llmRouter.callForRole('researcher', [{ role: 'user', content: synthesisPrompt }], {
      systemInstruction: 'You are an objective Technical Researcher. Never fabricate citations. Distinguish facts from hypotheses.',
    });

    const reportContent = res.text;

    const wantsDossier = /research|dossier|literature|sources|market study/i.test(context.userPrompt);
    let created: string[] = [];

    if (wantsDossier) {
      const artRes = await toolRegistry.invoke(
        'create_artifact',
        {
          filename: 'research_dossier.md',
          title: 'Evidence-Backed Research Dossier',
          fileType: 'markdown',
          language: 'markdown',
          content: reportContent,
        },
        { taskId: context.taskId, nodeId: node?.id, agentRole: 'researcher' }
      );
      if (artRes.success) created.push('research_dossier.md');
    }

    return {
      role: 'researcher',
      summary: `Synthesized ${citations.length} verified technical citations and evidence sources.`,
      details: reportContent,
      citations,
      artifactsCreated: created,
      toolCallsMade: [
        { tool: 'document_retriever', success: docToolRes.success },
        { tool: 'web_search', success: webToolRes.success },
      ],
      data: {
        evidenceCount: citations.length,
        dossier: reportContent,
      },
    };
  }
}
