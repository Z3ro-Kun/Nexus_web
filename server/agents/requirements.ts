import { llmRouter } from '../llm/router.js';
import { AgentContext, AgentResult } from './types.js';

export class RequirementsAnalystAgent {
  static async analyze(context: AgentContext): Promise<AgentResult> {
    const rawLower = context.userPrompt.toLowerCase().trim();

    // Informational, research, and factual inquiries should proceed directly to planning/research tools without blocking for clarification
    const isResearchOrInformational =
      /^(tell me\b|is\b|are\b|what\b|how\b|why\b|has\b|have\b|can you\b|does\b|did\b|check\b|verify\b|search\b|find\b|who\b|when\b|where\b|show me\b)/i.test(rawLower);

    if (isResearchOrInformational) {
      return {
        role: 'requirements',
        summary: `Actionable research inquiry: "${context.userPrompt.slice(0, 70)}"`,
        clarificationNeeded: false,
        data: {
          status: 'clear',
          assumptions: ['Investigating live evidence via web search, document intelligence, and technical tools'],
          reasoning: 'Informational and factual query is routed directly to the research and synthesis pipeline.',
        },
      };
    }

    if (rawLower.length < 20 || rawLower.includes('maybe') || rawLower.includes('something like') || rawLower.includes('whatever')) {
      return {
        role: 'requirements',
        summary: 'Material ambiguity detected: The instruction is underspecified regarding application type, technology stack, and core requirements.',
        clarificationNeeded: true,
        clarificationQuestion: 'What specific type of software application or service would you like to build?',
        clarificationOptions: [
          'Full-Stack Web Application (Node.js/Express, TypeScript, React)',
          'High-Performance REST/GraphQL Microservice with Token Authentication',
          'Data Processing ETL Pipeline with Invariant Validation',
        ],
        data: {
          status: 'materially_ambiguous',
          assumptions: [],
          reasoning: 'The instruction is underspecified. Clarification requested to avoid incorrect architectural assumptions.',
        },
      };
    }

    const prompt = `You are a Principal Requirements Analyst.
Evaluate the user's software development or technical request:
"${context.userPrompt}"

Available context:
- Document context available: ${Boolean(context.documentEvidence)}
${context.documentEvidence ? `Excerpts:\n${context.documentEvidence.slice(0, 1000)}` : ''}

Your duties:
1. Categorize request:
   - "clear": Proceed directly to planning.
   - "reasonable_defaults": Assumptions recorded, proceed with low risk.
   - "materially_ambiguous": Ask a targeted clarification question before proceeding.
   - "conflicting": Infeasible or conflicting, explain and propose feasible alternative.
   - "missing_inputs": Identify missing required inputs.
2. DO NOT ask unnecessary questions if reasonable industry defaults can be assumed (e.g. standard modern TypeScript, REST APIs, modular architecture).
3. Only ask clarification when the ambiguity is high-impact (e.g. completely missing core domain scope or multiple incompatible paths).

Respond ONLY in valid JSON matching this schema:
{
  "status": "clear" | "reasonable_defaults" | "materially_ambiguous" | "conflicting" | "missing_inputs",
  "reasoning": string,
  "clarificationQuestion": string | null,
  "suggestedOptions": string[] | null,
  "assumptions": string[]
}`;

    const res = await llmRouter.callForRole('requirements', [{ role: 'user', content: prompt }], {
      responseFormat: 'json',
      systemInstruction: 'You are an exacting Requirements Analyst. Return only valid JSON.',
    });

    try {
      // Parse JSON from model
      const cleanJson = res.text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      const needsClarification = parsed.status === 'materially_ambiguous' || parsed.status === 'missing_inputs';

      return {
        role: 'requirements',
        summary: parsed.reasoning || (needsClarification ? 'Ambiguity detected, user clarification required.' : 'Requirements analyzed and validated.'),
        details: `Assumptions: ${parsed.assumptions?.join('; ') || 'Standard production defaults'}`,
        clarificationNeeded: needsClarification,
        clarificationQuestion: parsed.clarificationQuestion || undefined,
        clarificationOptions: parsed.suggestedOptions || undefined,
        data: {
          status: parsed.status,
          assumptions: parsed.assumptions || [],
          reasoning: parsed.reasoning,
        },
      };
    } catch (e) {
      // Safe fallback
      return {
        role: 'requirements',
        summary: 'Requirements analyzed with standard production defaults.',
        clarificationNeeded: false,
        data: {
          status: 'clear',
          assumptions: ['Using modular architecture', 'Defaulting to TypeScript and clean API contracts'],
        },
      };
    }
  }
}
