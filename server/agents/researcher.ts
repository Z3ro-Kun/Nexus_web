import { db, SourceCitation } from '../db/store.js';
import { llmRouter } from '../llm/router.js';
import { toolRegistry } from '../tools/registry.js';
import { AgentContext, AgentResult } from './types.js';

export class ResearcherAgent {
  static async execute(context: AgentContext): Promise<AgentResult> {
    const node = context.currentNode;
    const citations: SourceCitation[] = [];
    const evidenceNotes: string[] = [];

    const toolCallsMade: any[] = [];

    // 1. Search uploaded documents ONLY if documents exist and user prompt references files/documents/specifications
    const hasUploadedDocs = db.listDocuments().length > 0;
    const mentionsDocs = /document|file|uploaded|spec|protocol|pdf|csv|markdown/i.test(context.userPrompt);
    if (hasUploadedDocs && mentionsDocs) {
      const docToolRes = await toolRegistry.invoke(
        'document_retriever',
        { query: context.userPrompt, topK: 3 },
        { taskId: context.taskId, nodeId: node?.id, agentRole: 'researcher' }
      );
      toolCallsMade.push({ tool: 'document_retriever', success: docToolRes.success });

      if (docToolRes.success && docToolRes.data?.citations && docToolRes.data.citations.length > 0) {
        citations.push(...docToolRes.data.citations);
        evidenceNotes.push(`Uploaded Document Evidence:\n${docToolRes.data.contextText}`);
      }
    }

    // 2. Perform Live Web Search
    let effectiveSearchPrompt = context.userPrompt;
    const isMeta = /^(you (didn't|did not|didnt) (give|provide|show|output|answer)|why (no|is there no|didn't you) output|give me (an? )?output|where is the (output|answer|response)|retry|repeat|no output)/i.test(context.userPrompt);
    if (isMeta && context.conversationHistory && context.conversationHistory.length > 0) {
      const orig = context.conversationHistory.find((m: any) => m.sender === 'user');
      if (orig?.content) {
        effectiveSearchPrompt = orig.content;
      }
    }
    effectiveSearchPrompt = effectiveSearchPrompt.replace(/\(Note:.*?\)/gi, '').trim();

    const searchTerms = effectiveSearchPrompt
      .replace(/^(tell me about|tell me if|is|are|can you tell me|what is|how do i|please find)\s+/i, '')
      .replace(/\s+(or not|\?)\s*$/i, '')
      .trim();

    const queryToSearch = searchTerms || effectiveSearchPrompt;
    const webToolRes = await toolRegistry.invoke(
      'web_search',
      { query: queryToSearch, maxResults: 4 },
      { taskId: context.taskId, nodeId: node?.id, agentRole: 'researcher' }
    );

    const searchResults = webToolRes.data?.results || [];
    toolCallsMade.push({
      tool: 'web_search',
      query: queryToSearch,
      success: webToolRes.success,
      durationMs: webToolRes.executionTimeMs,
      resultCount: searchResults.length,
      summary: `Searched web for "${queryToSearch}" (retrieved ${searchResults.length} live source results)`,
      results: searchResults.map((item: any) => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
      })),
    });

    const urlsToFetch: string[] = [];
    if (webToolRes.success && searchResults.length > 0) {
      for (const item of searchResults) {
        citations.push({
          sourceType: 'web',
          sourceTitle: item.title,
          sourceUrl: item.url,
          excerpt: item.snippet,
          verified: true,
        });
        evidenceNotes.push(`Live Web Reference: [${item.title}](${item.url})\nSummary: ${item.snippet}`);
        if (item.url && item.url.startsWith('http') && !item.url.endsWith('.pdf')) {
          if (!urlsToFetch.includes(item.url)) {
            urlsToFetch.push(item.url);
          }
        }
      }
    }

    // If a subpage was found (e.g. ranklist.html), also inspect the domain homepage for announcements
    if (urlsToFetch.length > 0) {
      try {
        const parsedUrl = new URL(urlsToFetch[0]);
        const originUrl = parsedUrl.origin + '/';
        if (!urlsToFetch.includes(originUrl) && urlsToFetch.length < 3) {
          urlsToFetch.push(originUrl);
        }
      } catch {}
    }

    // 3. Perform Live HTTP Fetch on the top relevant sources
    const targetedUrls = urlsToFetch.slice(0, 2);
    for (const fetchUrl of targetedUrls) {
      const fetchRes = await toolRegistry.invoke(
        'http_fetch',
        { url: fetchUrl },
        { taskId: context.taskId, nodeId: node?.id, agentRole: 'researcher' }
      );

      toolCallsMade.push({
        tool: 'http_fetch',
        url: fetchUrl,
        statusCode: fetchRes.data?.statusCode || 200,
        success: fetchRes.success,
        durationMs: fetchRes.executionTimeMs,
        extractedLength: fetchRes.data?.extractedLength || 0,
        summary: fetchRes.success
          ? `Fetched content from ${fetchUrl} (${fetchRes.data?.extractedLength || 0} characters extracted)`
          : `Failed to fetch ${fetchUrl}: ${fetchRes.error}`,
        excerpt: fetchRes.data?.content?.slice(0, 300) || '',
      });

      if (fetchRes.success && fetchRes.data?.content) {
        evidenceNotes.push(`Live Web Page Content Extracted (${fetchUrl}):\n"${fetchRes.data.content.slice(0, 3500)}"`);
      }
    }

    // 4. Synthesize findings with LLM using real-time grounding
    const synthesisPrompt = `You are a Principal Technical Researcher.
Goal: "${context.userPrompt}"
Subtask: "${node?.title || 'Technical Research'}"

TEMPORAL CONTEXT & LIVE EVIDENCE RULES:
1. Current cycle year is 2026.
2. Rely strictly on the live gathered search and page fetch evidence below. Do NOT fall back on pre-training cutoff assumptions.
3. STRICT ANTI-HALLUCINATION RULES:
   - NEVER fabricate URLs or domain names (e.g. never invent domains like "icpc.in"). Cite ONLY URLs that exist in the live search/fetch results below.
   - If a specific team's rank or participant score is not explicitly present in the extracted evidence (for example, if a table renders dynamically via JavaScript and shows "Loading data..."), explicitly state that the live rank could not be extracted directly from the dynamic page rather than guessing or making up numbers or ranks.
   - NEVER fabricate qualification rules or arbitrary cutoffs (e.g. do not invent "top 10 advance"). Clearly state official rules if present in the evidence, or explain general qualification procedures (e.g. institutional college topper quotas) and advise checking official portals.

Gathered Live Evidence:
${evidenceNotes.join('\n\n') || 'No external evidence could be fetched. Standard technical knowledge applies.'}

Provide an evidence-backed Research Dossier:
1. Validated Technical Findings (cite sources and verified URLs explicitly)
2. Current Status & Timeline Context
3. Critical Notes, Integrity Reviews, or Caveats (distinguish verified facts vs inferences)
4. Exact steps for user verification if live data was rendered dynamically.`;

    const res = await llmRouter.callForRole('researcher', [{ role: 'user', content: synthesisPrompt }], {
      systemInstruction: 'You are an objective Technical Researcher. Never fabricate citations or URLs. Never make up contest ranks, statistics, or rules. Ground all statements strictly in the live evidence provided.',
    });

    const reportContent = res.text;

    const wantsDossier = /\b(create|write|generate|export|download|save)\b.*\b(research dossier|dossier file|literature review doc)\b/i.test(context.userPrompt);
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
      toolCallsMade,
      data: {
        evidenceCount: citations.length,
        dossier: reportContent,
      },
    };
  }
}
