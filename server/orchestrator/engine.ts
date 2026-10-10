import { db, DAGNode, TaskRecord, ChatMessage } from '../db/store.js';
import { RequirementsAnalystAgent } from '../agents/requirements.js';
import { PlannerAgent } from '../agents/planner.js';
import { ArchitectAgent } from '../agents/architect.js';
import { ResearcherAgent } from '../agents/researcher.js';
import { ImplementerAgent } from '../agents/implementer.js';
import { ReviewerAgent } from '../agents/reviewer.js';
import { VerifierAgent } from '../agents/verifier.js';
import { ReplannerAgent } from '../agents/replanner.js';
import { AgentContext } from '../agents/types.js';
import { DocumentRetriever } from '../rag/retriever.js';
import { DAGScheduler } from './dag.js';
import { eventHub } from './events.js';
import { llmRouter } from '../llm/router.js';
import { config } from '../config.js';

export class OrchestrationEngine {
  /**
   * Start a new autonomous task lifecycle
   */
  static async submitTask(userPrompt: string): Promise<TaskRecord> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      sender: 'user',
      content: userPrompt,
      timestamp: Date.now(),
    };

    const task: TaskRecord = {
      id: taskId,
      title: userPrompt.slice(0, 60) + (userPrompt.length > 60 ? '...' : ''),
      userPrompt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'analyzing',
      conversation: [userMsg],
      assumptions: [],
      activeAgents: ['requirements'],
      artifacts: [],
      metrics: {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        estimatedCostUsd: 0,
        durationMs: 0,
        toolsInvokedCount: 0,
        replanningCycles: 0,
      },
    };

    db.saveTask(task);
    eventHub.emit(taskId, 'agent_start', `Task submitted: "${task.title}"`, { agentRole: 'orchestrator' });

    // Begin async lifecycle without blocking HTTP response
    this.executeLifecycle(taskId).catch((err) => {
      console.error(`[OrchestrationEngine] Fatal error in task ${taskId}:`, err);
      const t = db.getTask(taskId);
      if (t) {
        t.status = 'failed';
        db.saveTask(t);
        eventHub.emit(taskId, 'task_failed', `Orchestrator failure: ${err.message}`, { agentRole: 'orchestrator' });
      }
    });

    return task;
  }

  /**
   * Submit a follow-up request inside an existing task conversation
   */
  static async submitFollowUp(taskId: string, followUpPrompt: string): Promise<TaskRecord> {
    const task = db.getTask(taskId);
    if (!task) throw new Error('Task not found');

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      sender: 'user',
      content: followUpPrompt,
      timestamp: Date.now(),
    };

    if (!task.conversation) task.conversation = [];
    task.conversation.push(userMsg);
    task.status = 'planning';
    task.activeAgents = ['planner', 'implementer'];
    db.saveTask(task);

    eventHub.emit(taskId, 'agent_start', `Follow-up received: "${followUpPrompt}"`, {
      agentRole: 'orchestrator',
      payload: { prompt: followUpPrompt },
    });

    // Run execution with preserved context
    this.planAndExecute(taskId, Date.now(), true, followUpPrompt).catch((err) => {
      console.error(`[OrchestrationEngine] Error in follow-up execution ${taskId}:`, err);
      const t = db.getTask(taskId);
      if (t) {
        t.status = 'failed';
        db.saveTask(t);
        eventHub.emit(taskId, 'task_failed', `Follow-up error: ${err.message}`, { agentRole: 'orchestrator' });
      }
    });

    return task;
  }

  /**
   * Resume task when user supplies clarification
   */
  static async answerClarification(taskId: string, answer: string): Promise<TaskRecord> {
    const task = db.getTask(taskId);
    if (!task) throw new Error('Task not found');
    if (task.status !== 'waiting_clarification') {
      throw new Error(`Task is not waiting for clarification (status: ${task.status})`);
    }

    if (task.clarification) {
      task.clarification.answered = true;
      task.clarification.answer = answer;
    }
    task.userPrompt += `\n[User Clarification]: ${answer}`;
    task.status = 'planning';
    db.saveTask(task);

    eventHub.emit(taskId, 'clarification_answered', `User clarification received: "${answer}"`, {
      agentRole: 'orchestrator',
      payload: { answer },
    });

    // Resume execution
    this.planAndExecute(taskId).catch((err) => {
      console.error(`[OrchestrationEngine] Error resuming task ${taskId}:`, err);
    });

    return task;
  }

  /**
   * Main lifecycle coordinator
   */
  private static async executeLifecycle(taskId: string): Promise<void> {
    const task = db.getTask(taskId);
    if (!task) return;

    const startTime = Date.now();

    // 1. Ingest document context if available
    const docEvidence = DocumentRetriever.retrieveEvidence(task.userPrompt, { topK: 3 });

    // 2. Stage 1: Requirements Analysis & Ambiguity Triage
    eventHub.emit(taskId, 'agent_start', 'Analyzing user requirements and detecting potential ambiguities...', {
      agentRole: 'requirements',
    });

    const reqResult = await RequirementsAnalystAgent.analyze({
      taskId,
      userPrompt: task.userPrompt,
      assumptions: task.assumptions,
      documentEvidence: docEvidence.foundEvidence ? docEvidence.contextText : undefined,
    });

    task.assumptions = reqResult.data?.assumptions || [];
    eventHub.emit(taskId, 'agent_output', reqResult.summary, {
      agentRole: 'requirements',
      payload: reqResult.data,
    });

    // Check if clarification is needed
    if (reqResult.clarificationNeeded && reqResult.clarificationQuestion) {
      task.status = 'waiting_clarification';
      task.clarification = {
        question: reqResult.clarificationQuestion,
        options: reqResult.clarificationOptions,
        answered: false,
      };
      db.saveTask(task);

      eventHub.emit(taskId, 'clarification_requested', reqResult.clarificationQuestion, {
        agentRole: 'requirements',
        payload: {
          question: reqResult.clarificationQuestion,
          options: reqResult.clarificationOptions,
        },
      });
      // Pause until user responds via answerClarification
      return;
    }

    // Proceed to planning
    await this.planAndExecute(taskId, startTime);
  }

  private static async planAndExecute(taskId: string, startTime = Date.now(), isFollowUp = false, followUpPrompt?: string): Promise<void> {
    const task = db.getTask(taskId);
    if (!task) return;

    // 3. Stage 2: Planning & DAG Decomposition
    task.status = 'planning';
    task.activeAgents = ['planner'];
    db.saveTask(task);

    eventHub.emit(taskId, 'agent_start', isFollowUp ? 'Formulating follow-up update plan...' : 'Constructing Directed Acyclic Graph (DAG) task plan...', {
      agentRole: 'planner',
    });

    const planOutput = await PlannerAgent.plan({
      taskId,
      userPrompt: isFollowUp && followUpPrompt ? followUpPrompt : task.userPrompt,
      assumptions: task.assumptions,
      conversationHistory: task.conversation,
      artifacts: db.getArtifactsForTask(taskId),
      isFollowUp,
      latestFollowUp: followUpPrompt,
    });

    task.plan = {
      id: `plan_${taskId}_v${(task.plan?.version || 0) + 1}`,
      taskId,
      objective: planOutput.objective,
      version: (task.plan?.version || 0) + 1,
      nodes: planOutput.nodes,
      createdAt: Date.now(),
    };
    task.status = 'executing';
    db.saveTask(task);

    eventHub.emit(
      taskId,
      'agent_output',
      `DAG Plan generated with ${planOutput.nodes.length} task(s).`,
      {
        agentRole: 'planner',
        payload: { nodes: planOutput.nodes },
      }
    );

    // 4. Stage 3: DAG Execution Loop (Parallel Batching)
    await this.runDAGLoop(taskId);

    // 5. Final verification & completion check
    const refreshed = db.getTask(taskId);
    if (!refreshed || !refreshed.plan) return;

    refreshed.metrics.durationMs = Date.now() - startTime;
    const allPassed = DAGScheduler.isAllCompleted(refreshed.plan.nodes);

    if (allPassed) {
      refreshed.status = 'completed';
      refreshed.activeAgents = [];
      const currentArtifacts = db.getArtifactsForTask(taskId);
      refreshed.artifacts = currentArtifacts;

      // Synthesize rich, readable, conversational response
      const chatResponse = await this.synthesizeConversationalResponse(refreshed);
      refreshed.finalResponse = chatResponse;

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        sender: 'assistant',
        content: chatResponse,
        timestamp: Date.now(),
        artifacts: currentArtifacts,
        agentSummary: `Orchestrated ${refreshed.plan.nodes.length} specialized agents (${refreshed.plan.nodes.map((n) => n.role).join(', ')}) with formal verification.`,
      };

      if (!refreshed.conversation) refreshed.conversation = [];
      refreshed.conversation.push(assistantMsg);
      db.saveTask(refreshed);

      eventHub.emit(
        taskId,
        'agent_output',
        chatResponse,
        { agentRole: 'assistant', payload: { response: chatResponse } }
      );

      eventHub.emit(
        taskId,
        'task_completed',
        `Autonomous execution completed successfully. Deliverables verified.`,
        { agentRole: 'orchestrator' }
      );
    } else {
      refreshed.status = 'failed';
      refreshed.activeAgents = [];
      const failMsg: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        sender: 'assistant',
        content: `I encountered an issue completing some tasks. Some acceptance criteria could not be verified automatically.`,
        timestamp: Date.now(),
      };
      refreshed.conversation.push(failMsg);
      db.saveTask(refreshed);
      eventHub.emit(taskId, 'task_failed', 'Execution ended with unresolved defects.', {
        agentRole: 'orchestrator',
      });
    }
  }

  /**
   * Run the DAG graph to completion with parallel branch execution
   */
  private static async runDAGLoop(taskId: string): Promise<void> {
    let loopSafetyLimit = 25;

    while (loopSafetyLimit > 0) {
      loopSafetyLimit--;
      const task = db.getTask(taskId);
      if (!task || !task.plan) break;

      const nodes = task.plan.nodes;

      // Check if all nodes completed
      if (DAGScheduler.isAllCompleted(nodes)) {
        break;
      }

      // Check which nodes are ready for execution (all dependencies completed)
      const readyNodes = DAGScheduler.getReadyNodes(nodes);

      if (readyNodes.length === 0) {
        if (DAGScheduler.hasRunningNodes(nodes)) {
          // Wait briefly for running tasks
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }

        // Deadlock or unresolvable failure
        if (DAGScheduler.hasFailedNodes(nodes)) {
          console.warn('[Orchestrator] DAG halted due to unrecoverable node failures.');
          break;
        }
        break;
      }

      // Execute all ready nodes in parallel!
      task.activeAgents = readyNodes.map((n) => n.role);
      db.saveTask(task);

      eventHub.emit(
        taskId,
        'agent_thought',
        `Scheduling ${readyNodes.length} task(s) for concurrent execution: [${readyNodes.map((n) => n.title).join(', ')}]`,
        { agentRole: 'orchestrator' }
      );

      // Execute batch concurrently
      await Promise.all(readyNodes.map((node) => this.executeNode(taskId, node.id)));
    }
  }

  /**
   * Execute a single DAG node, handle role dispatch, review & verification, and replanning
   */
  private static async executeNode(taskId: string, nodeId: string): Promise<void> {
    const task = db.getTask(taskId);
    if (!task || !task.plan) return;

    const node = task.plan.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    node.status = 'running';
    node.startedAt = Date.now();
    db.saveTask(task);

    eventHub.emit(taskId, 'agent_start', `Starting "${node.title}" (${node.role})`, {
      agentRole: node.role,
      nodeId: node.id,
    });

    const completedOutputs: Record<string, any> = {};
    for (const n of task.plan.nodes) {
      if (n.status === 'completed' && n.output) {
        completedOutputs[n.id] = n.output;
      }
    }

    const context: AgentContext = {
      taskId,
      userPrompt: task.userPrompt,
      assumptions: task.assumptions,
      currentNode: node,
      allNodes: task.plan.nodes,
      completedNodeOutputs: completedOutputs,
      artifacts: db.getArtifactsForTask(taskId),
      conversationHistory: task.conversation,
    };

    try {
      let result: any;

      switch (node.role) {
        case 'architect':
          result = await ArchitectAgent.execute(context);
          break;
        case 'researcher':
          result = await ResearcherAgent.execute(context);
          break;
        case 'implementer':
          result = await ImplementerAgent.execute(context);
          break;
        case 'reviewer':
          result = await ReviewerAgent.execute(context);
          break;
        case 'verifier':
          result = await VerifierAgent.execute(context);
          break;
        default:
          result = await ImplementerAgent.execute(context);
      }

      // Check verification verdict
      if (node.role === 'verifier' && result.verdict === 'failed') {
        throw new Error(`Deliverable verification failed: ${result.summary}`);
      }

      node.status = 'completed';
      node.completedAt = Date.now();
      node.output = {
        summary: result.summary,
        details: result.details,
        citations: result.citations,
        toolCalls: result.toolCallsMade,
      };

      if (node.role === 'verifier') {
        node.verification = {
          verified: result.verdict === 'passed',
          verdict: result.verdict,
          findings: result.data?.findings || [],
          testsRun: result.data?.testsRun,
        };
      }

      db.saveTask(task);

      eventHub.emit(taskId, 'agent_output', result.summary, {
        agentRole: node.role,
        nodeId: node.id,
        payload: result.data,
      });
    } catch (err: any) {
      console.warn(`[Orchestrator] Task node ${node.id} failed:`, err.message);
      node.retryCount++;
      node.error = err.message;

      eventHub.emit(taskId, 'agent_thought', `Task failure detected on "${node.title}": ${err.message}`, {
        agentRole: 'orchestrator',
        nodeId: node.id,
      });

      // Invoke Replanner
      await this.handleNodeFailure(taskId, node);
    }
  }

  /**
   * Surgical Failure Recovery & Replanning
   */
  private static async handleNodeFailure(taskId: string, failedNode: DAGNode): Promise<void> {
    const task = db.getTask(taskId);
    if (!task || !task.plan) return;

    task.status = 'replanning';
    task.metrics.replanningCycles++;
    db.saveTask(task);

    eventHub.emit(taskId, 'replan_triggered', `Diagnosing defect and formulating recovery plan...`, {
      agentRole: 'replanner',
      nodeId: failedNode.id,
    });

    const replan = await ReplannerAgent.diagnoseAndReplan(
      {
        taskId,
        userPrompt: task.userPrompt,
        assumptions: task.assumptions,
        allNodes: task.plan.nodes,
      },
      failedNode,
      [failedNode.error || 'Execution defect']
    );

    eventHub.emit(taskId, 'agent_output', `Diagnosis: ${replan.diagnosis}. Strategy: ${replan.strategy}`, {
      agentRole: 'replanner',
      payload: replan,
    });

    if (replan.strategy === 'escalate_human') {
      failedNode.status = 'failed';
      task.status = 'failed';
      db.saveTask(task);
      eventHub.emit(
        taskId,
        'task_failed',
        `Replanner reached retry threshold for task "${failedNode.title}". Human intervention required.`,
        { agentRole: 'replanner' }
      );
      return;
    }

    // Surgical reset: reset only specified nodes back to 'pending'
    for (const nId of replan.nodesToReplan) {
      const target = task.plan.nodes.find((n) => n.id === nId);
      if (target) {
        target.status = 'pending';
        target.error = undefined;
      }
    }

    task.status = 'executing';
    db.saveTask(task);
  }

  /**
   * Synthesize a natural, readable conversational response (like ChatGPT/Gemini)
   */
  private static async synthesizeConversationalResponse(task: TaskRecord): Promise<string> {
    const artifacts = task.artifacts || [];
    const primaryArtifact = artifacts.find((a) => a.fileType === 'code' || a.fileType === 'python') || artifacts[0];

    const prompt = `You are an expert AI Software Engineer Assistant.
The user asked:
"${task.userPrompt}"

Conversation History:
${(task.conversation || []).map((m) => `${m.sender.toUpperCase()}: ${m.content}`).join('\n\n')}

Delivered Artifact:
${artifacts.map((a) => `File: ${a.filename} (${a.language}):\n\`\`\`${a.language || ''}\n${a.content}\n\`\`\``).join('\n\n')}

INSTRUCTIONS:
1. Provide a direct, concise response that directly gives what the user asked for without bloat or long-winded essays.
2. If the user asked for SQL code, briefly explain the core SQL logic in 2-4 sentences and note that the complete clean SQL file is available in the preview card below for download.
3. Do NOT provide redundant wrappers (e.g. do NOT wrap SQL in Python or shell scripts), unsolicited boilerplate, or repetitive commentary.
4. Format in clean, readable Markdown (headings, bullet points, clean snippets). Keep the explanation brief and directly on-point.`;

    try {
      const res = await llmRouter.callForRole('implementer', [{ role: 'user', content: prompt }], {
        maxTokens: config.maxTokens,
        systemInstruction: 'You are a concise, direct Senior Software Engineer. Give direct answers without unnecessary bloat, wrappers, or rambling.',
      });
      if (res.text && res.text.trim()) {
        return res.text;
      }
    } catch (e) {
      console.warn('[SynthesizeChat] Falling back to default format:', e);
    }

    if (primaryArtifact) {
      return `### Solution: \`${primaryArtifact.filename}\`

Here is the deliverable for your request:

\`\`\`${primaryArtifact.language || ''}
${primaryArtifact.content}
\`\`\`

You can preview the source code above or click **Download .${primaryArtifact.filename.split('.').pop()}** in the artifact card below.`;
    }

    return `I have completed your request: **"${task.userPrompt}"**. The deliverable is ready below.`;
  }

  /**
   * Cancel an ongoing task
   */
  static cancelTask(taskId: string): void {
    const task = db.getTask(taskId);
    if (!task) return;
    task.status = 'failed';
    task.activeAgents = [];
    db.saveTask(task);
    eventHub.emit(taskId, 'task_failed', 'Task was cancelled by user.', { agentRole: 'orchestrator' });
  }
}
