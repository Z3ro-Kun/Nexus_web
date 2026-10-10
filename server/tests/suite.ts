import { calculatorTool } from '../tools/calculator.js';
import { codeExecutorTool } from '../tools/codeExecutor.js';
import { toolRegistry } from '../tools/registry.js';
import { DocumentParser } from '../rag/parser.js';
import { DocumentChunker } from '../rag/chunker.js';
import { DocumentIndexer } from '../rag/indexer.js';
import { DocumentRetriever } from '../rag/retriever.js';
import { DAGScheduler } from '../orchestrator/dag.js';
import { DAGNode } from '../db/store.js';
import { llmRouter } from '../llm/router.js';
import { ReplannerAgent } from '../agents/replanner.js';
import { VerifierAgent } from '../agents/verifier.js';

export interface TestCaseResult {
  id: string;
  category: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: string;
}

export interface TestSuiteReport {
  timestamp: number;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  durationMs: number;
  results: TestCaseResult[];
}

export class SystemTestSuite {
  static async runAll(): Promise<TestSuiteReport> {
    const startTime = Date.now();
    const results: TestCaseResult[] = [];

    // Helper runner
    const runTest = async (
      id: string,
      category: string,
      name: string,
      fn: () => Promise<void>
    ) => {
      const t0 = Date.now();
      try {
        await fn();
        results.push({
          id,
          category,
          name,
          passed: true,
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        results.push({
          id,
          category,
          name,
          passed: false,
          durationMs: Date.now() - t0,
          error: err.message || String(err),
        });
      }
    };

    // 1. Tool Framework: Calculator
    await runTest('tool_calc_1', 'Tools', 'Calculator evaluates standard arithmetic', async () => {
      const res = await calculatorTool.execute(
        { expression: '12.5 * 4 + 50' },
        { taskId: 'test', agentRole: 'test' }
      );
      if (!res.success || res.data?.result !== 100) {
        throw new Error(`Expected 100, got: ${JSON.stringify(res.data)}`);
      }
    });

    await runTest('tool_calc_2', 'Tools', 'Calculator prevents code injection / globals', async () => {
      const res = await calculatorTool.execute(
        { expression: 'process.exit(1)' },
        { taskId: 'test', agentRole: 'test' }
      );
      if (res.success) {
        throw new Error('Calculator should reject unauthorized identifiers');
      }
    });

    // 2. Tool Framework: Code Executor Sandbox
    await runTest('tool_exec_1', 'Tools', 'Code executor validates assertions and logs', async () => {
      const res = await codeExecutorTool.execute(
        {
          code: `
            const a = 15;
            const b = 25;
            assert(a + b === 40, "Sum assertion");
            console.log("Success");
            return a * b;
          `,
        },
        { taskId: 'test', agentRole: 'test' }
      );
      if (!res.success || res.data?.result !== 375) {
        throw new Error(`Execution failed: ${res.error}`);
      }
    });

    // 3. Document Ingestion: Formats Parsing
    await runTest('doc_parse_json', 'RAG', 'JSON document parser extracts structured keys', async () => {
      const sampleJson = JSON.stringify({
        architecture: 'Microservices',
        endpoints: ['/api/v1/auth', '/api/v1/tasks'],
        sla: 0.999,
      });
      const parsed = DocumentParser.parse('spec.json', sampleJson, 'application/json');
      if (parsed.format !== 'json' || parsed.sections.length === 0) {
        throw new Error('Failed to parse JSON document');
      }
    });

    await runTest('doc_parse_csv', 'RAG', 'CSV parser splits rows with headers', async () => {
      const sampleCsv = 'Metric,Value,Unit\nLatency,45,ms\nThroughput,1200,rps\n';
      const parsed = DocumentParser.parse('metrics.csv', sampleCsv, 'text/csv');
      if (parsed.format !== 'csv' || parsed.metadata.rowCount !== 2) {
        throw new Error(`CSV parsing mismatch: row count is ${parsed.metadata.rowCount}`);
      }
    });

    await runTest('doc_parse_md', 'RAG', 'Markdown parser groups by headings', async () => {
      const md = '# Section 1\nContent 1\n# Section 2\nContent 2\n';
      const parsed = DocumentParser.parse('doc.md', md, 'text/markdown');
      if (parsed.format !== 'markdown' || parsed.sections.length < 2) {
        throw new Error('Markdown heading parsing failed');
      }
    });

    // 4. Document Indexing & Keyword/Semantic Search
    await runTest('rag_index_search', 'RAG', 'Indexer indexes chunks and finds matching excerpts', async () => {
      const indexer = new DocumentIndexer();
      const chunks = DocumentChunker.chunk('doc_1', {
        title: 'Authentication RFC',
        format: 'txt',
        rawText: 'Token rotation uses cryptographic HMAC SHA256 signatures with 15 minute lifespan.',
        metadata: { byteSize: 85, charCount: 85 },
        sections: [
          {
            location: 'Section 1',
            content: 'Token rotation uses cryptographic HMAC SHA256 signatures with 15 minute lifespan.',
          },
        ],
      });
      indexer.addChunks(chunks);
      const matches = indexer.search('HMAC SHA256');
      if (matches.length === 0 || !matches[0].chunk.text.includes('HMAC')) {
        throw new Error('Search failed to retrieve relevant passage');
      }
    });

    // 5. DAG Scheduler: Parallel Dependency Resolution
    await runTest('dag_parallel', 'Orchestrator', 'DAG Scheduler unblocks parallel root nodes', async () => {
      const mockNodes: DAGNode[] = [
        {
          id: 'n1',
          title: 'Root 1',
          description: '',
          role: 'architect',
          dependencies: [],
          status: 'pending',
          inputs: {},
          expectedOutputs: '',
          acceptanceCriteria: [],
          retryCount: 0,
        },
        {
          id: 'n2',
          title: 'Root 2',
          description: '',
          role: 'researcher',
          dependencies: [],
          status: 'pending',
          inputs: {},
          expectedOutputs: '',
          acceptanceCriteria: [],
          retryCount: 0,
        },
        {
          id: 'n3',
          title: 'Child 3',
          description: '',
          role: 'implementer',
          dependencies: ['n1', 'n2'],
          status: 'pending',
          inputs: {},
          expectedOutputs: '',
          acceptanceCriteria: [],
          retryCount: 0,
        },
      ];

      // Both n1 and n2 must be ready for parallel execution
      const ready = DAGScheduler.getReadyNodes(mockNodes);
      if (ready.length !== 2) {
        throw new Error(`Expected 2 parallel root nodes, got ${ready.length}`);
      }

      // After n1 completes, n3 must still wait for n2
      mockNodes[0].status = 'completed';
      const readyAfter1 = DAGScheduler.getReadyNodes(mockNodes);
      if (readyAfter1.some((n) => n.id === 'n3')) {
        throw new Error('Child n3 must not start until both n1 and n2 are completed');
      }

      // After n2 completes, n3 is unblocked
      mockNodes[1].status = 'completed';
      const readyAfterBoth = DAGScheduler.getReadyNodes(mockNodes);
      if (!readyAfterBoth.some((n) => n.id === 'n3')) {
        throw new Error('Child n3 should now be ready');
      }
    });

    await runTest('dag_cycle', 'Orchestrator', 'DAG Cycle Detector catches circular dependencies', async () => {
      const cyclicNodes: DAGNode[] = [
        {
          id: 'a',
          title: 'A',
          description: '',
          role: 'implementer',
          dependencies: ['b'],
          status: 'pending',
          inputs: {},
          expectedOutputs: '',
          acceptanceCriteria: [],
          retryCount: 0,
        },
        {
          id: 'b',
          title: 'B',
          description: '',
          role: 'implementer',
          dependencies: ['a'],
          status: 'pending',
          inputs: {},
          expectedOutputs: '',
          acceptanceCriteria: [],
          retryCount: 0,
        },
      ];
      const hasCycles = DAGScheduler.hasCycles(cyclicNodes);
      if (!hasCycles) {
        throw new Error('Failed to detect circular dependency');
      }
    });

    // 6. Provider Adapter: Mock Provider Fallback
    await runTest('llm_adapter_mock', 'LLM Provider', 'Mock Provider returns structured responses', async () => {
      const res = await llmRouter.callForRole('planner', [{ role: 'user', content: 'Design pipeline' }], {
        responseFormat: 'json',
      });
      if (!res.text) {
        throw new Error('Mock provider did not return output');
      }
    });

    // 7. Replanner: Surgical Recovery Strategy
    await runTest('agent_replan', 'Agents', 'Replanner diagnoses defect and restricts replanned nodes', async () => {
      const failedNode: DAGNode = {
        id: 'n_fail',
        title: 'Failing Subtask',
        description: '',
        role: 'implementer',
        dependencies: [],
        status: 'failed',
        inputs: {},
        expectedOutputs: '',
        acceptanceCriteria: [],
        retryCount: 1,
        error: 'Syntax error in generated script',
      };
      const res = await ReplannerAgent.diagnoseAndReplan(
        { taskId: 'test', userPrompt: 'Test task', assumptions: [] },
        failedNode,
        ['Syntax error on line 42']
      );
      if (!res.strategy || !res.nodesToReplan.includes('n_fail')) {
        throw new Error('Replanner failed to identify targeted node to replan');
      }
    });

    return {
      timestamp: Date.now(),
      totalTests: results.length,
      passedCount: results.filter((r) => r.passed).length,
      failedCount: results.filter((r) => !r.passed).length,
      durationMs: Date.now() - startTime,
      results,
    };
  }
}
