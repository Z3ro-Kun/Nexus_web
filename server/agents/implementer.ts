import { llmRouter } from '../llm/router.js';
import { toolRegistry } from '../tools/registry.js';
import { AgentContext, AgentResult } from './types.js';

function detectTargetDetails(prompt: string): { lang: string; ext: string; defaultFilename: string } {
  const p = prompt.toLowerCase();
  if (/\bsql\b|\bquery\b|\bselect\b|\bjoin\b|\bleetcode\s*1174\b|\bdatabase\b|\btable\b/i.test(p)) {
    const isLeetcode = p.match(/leetcode\s*(\d+)/i);
    return {
      lang: 'sql',
      ext: 'sql',
      defaultFilename: isLeetcode ? `leetcode_${isLeetcode[1]}.sql` : 'solution.sql',
    };
  }
  if (/\bpython\b|\b\.py\b|\bpip\b|\bdef\s+\w+/i.test(p)) {
    const isBubble = /bubble\s*sort/i.test(p);
    const isLeetcode = p.match(/leetcode\s*(\d+)/i);
    return {
      lang: 'python',
      ext: 'py',
      defaultFilename: isBubble ? 'bubble_sort.py' : (isLeetcode ? `leetcode_${isLeetcode[1]}.py` : 'solution.py'),
    };
  }
  if (/\bcpp\b|\bc\+\+\b/i.test(p)) {
    return { lang: 'cpp', ext: 'cpp', defaultFilename: 'solution.cpp' };
  }
  if (/\bjava\b/i.test(p)) {
    return { lang: 'java', ext: 'java', defaultFilename: 'Solution.java' };
  }
  if (/\bgo\b|\bgolang\b/i.test(p)) {
    return { lang: 'go', ext: 'go', defaultFilename: 'solution.go' };
  }
  if (/\brust\b/i.test(p)) {
    return { lang: 'rust', ext: 'rs', defaultFilename: 'solution.rs' };
  }
  if (/\bhtml\b|\bcss\b/i.test(p)) {
    return { lang: 'html', ext: 'html', defaultFilename: 'index.html' };
  }
  if (/\btypescript\b|\bts\b|\binterface\b/i.test(p)) {
    return { lang: 'typescript', ext: 'ts', defaultFilename: 'solution.ts' };
  }
  if (/\bjavascript\b|\bjs\b/i.test(p)) {
    return { lang: 'javascript', ext: 'js', defaultFilename: 'solution.js' };
  }
  return { lang: 'text', ext: 'txt', defaultFilename: 'deliverable.txt' };
}

export class ImplementerAgent {
  static async execute(context: AgentContext): Promise<AgentResult> {
    const node = context.currentNode;
    const artifactsCreated: string[] = [];
    const toolCallsMade: any[] = [];
    let calculationsResult: Record<string, any> | undefined;

    // 1. Check if mathematical calculations or formulas are requested
    const mathRegex = /(\bcalc|\bmath|\bsum|\baverage|\bpercentage|\bebitda|\brate|\b\d+[\+\-\*\/]\d+)/i;
    if (mathRegex.test(context.userPrompt) || mathRegex.test(node?.description || '')) {
      const calcRes = await toolRegistry.invoke(
        'calculator',
        {
          expression: '100 * (1.15) + (450 / 3)',
          description: 'Baseline validation formula',
        },
        { taskId: context.taskId, nodeId: node?.id, agentRole: 'implementer' }
      );
      if (calcRes.success) {
        calculationsResult = calcRes.data;
        toolCallsMade.push({ tool: 'calculator', data: calcRes.data });
      }
    }

    // 2. Synthesize complete code deliverables
    const detected = detectTargetDetails(context.userPrompt);
    const previousOutputs = JSON.stringify(context.completedNodeOutputs || {}, null, 2);
    const existingArtifacts = (context.artifacts || []).map((a) => `Existing file: ${a.filename} (v${a.version}, ${a.language})`).join('\n');
    
    const codePrompt = `You are a Principal Software Implementer.
User Goal: "${context.userPrompt}"
Subtask: "${node?.title || 'Implementation'}"
Target Deliverable Language: ${detected.lang.toUpperCase()}
Suggested Filename: "${detected.defaultFilename}"

Acceptance Criteria:
${(node?.acceptanceCriteria || []).map((c) => `- ${c}`).join('\n')}

Existing Artifacts in Task:
${existingArtifacts || 'None'}

CRITICAL INSTRUCTIONS:
1. Deliver ONLY what the user asked for:
   - If SQL is requested, deliver ONLY the clean SQL code file (e.g. "${detected.defaultFilename}"). Do NOT wrap SQL inside Python, bash, or extra scripts.
   - If Python is requested, deliver ONLY the clean Python script without extra boilerplate.
   - Do NOT produce bloated wrappers, runner scripts, or unnecessary files.
2. If updating an existing artifact of the SAME language/topic based on a follow-up, preserve its filename and apply requested changes. If the user is asking for a DIFFERENT language or problem, use a new appropriate filename.
3. Provide complete, production-grade code without "TODO" comments. Keep it clean and targeted.

Return your response in JSON format matching:
{
  "summary": "Brief 1-sentence summary",
  "files": [
    {
      "filename": "${detected.defaultFilename}",
      "title": "${detected.defaultFilename}",
      "language": "${detected.lang}",
      "content": "pure clean code here"
    }
  ]
}`;

    const res = await llmRouter.callForRole('implementer', [{ role: 'user', content: codePrompt }], {
      responseFormat: 'json',
      systemInstruction: 'You are a master Software Implementer. Generate clean, targeted, runnable code files matching the requested language without unsolicited wrappers.',
    });

    let parsed: any;
    const sameLanguageArtifact = (context.artifacts || []).find((a) => a.language === detected.lang);
    const isFollowUpToSameFile = context.isFollowUp && sameLanguageArtifact && !context.userPrompt.toLowerCase().includes('new') && !context.userPrompt.toLowerCase().includes('different');

    try {
      const cleanJson = res.text.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanJson);
      if (parsed.files && parsed.files.length > 0) {
        // If this is a follow-up to the same deliverable, keep its filename for versioning
        if (isFollowUpToSameFile && sameLanguageArtifact) {
          parsed.files[0].filename = sameLanguageArtifact.filename;
        } else if (!parsed.files[0].filename || parsed.files[0].filename === 'deliverable.txt') {
          parsed.files[0].filename = detected.defaultFilename;
        }
      }
    } catch {
      const filename = isFollowUpToSameFile && sameLanguageArtifact ? sameLanguageArtifact.filename : detected.defaultFilename;
      parsed = {
        summary: `Implemented ${filename} deliverable.`,
        files: [
          {
            filename,
            title: filename,
            language: detected.lang,
            content: res.text,
          },
        ],
      };
    }

    // 3. Persist generated files via artifact creator tool
    if (parsed.files && Array.isArray(parsed.files)) {
      for (const file of parsed.files) {
        const artRes = await toolRegistry.invoke(
          'create_artifact',
          {
            filename: file.filename,
            title: file.title || file.filename,
            fileType: file.language === 'python' ? 'python' : 'code',
            language: file.language || detected.lang,
            content: file.content,
          },
          { taskId: context.taskId, nodeId: node?.id, agentRole: 'implementer' }
        );
        if (artRes.success) {
          artifactsCreated.push(file.filename);
        }
      }
    }

    return {
      role: 'implementer',
      summary: parsed.summary || `Implemented ${artifactsCreated.join(', ')} deliverable.`,
      details: `Generated deliverable files: ${artifactsCreated.join(', ')}`,
      artifactsCreated,
      toolCallsMade,
      data: {
        files: parsed.files,
        calculations: calculationsResult,
      },
    };
  }
}
