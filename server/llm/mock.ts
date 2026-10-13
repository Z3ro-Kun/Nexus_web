import { LLMMessage, LLMProvider, LLMRequestOptions, LLMResponse } from './types.js';

export class MockProvider implements LLMProvider {
  public name = 'mock';

  isAvailable(): boolean {
    return true;
  }

  async generateText(messages: LLMMessage[], options: LLMRequestOptions = {}): Promise<LLMResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const sysInstruction = options.systemInstruction || '';
    let responseText = '';

    // Check what agent role or prompt context is requesting
    if (options.responseFormat === 'json' || sysInstruction.includes('JSON')) {
      if (sysInstruction.includes('Requirements Analyst')) {
        const isAmbiguous =
          lastUserMessage.toLowerCase().includes('maybe') ||
          lastUserMessage.toLowerCase().includes('something like') ||
          lastUserMessage.length < 15;
        if (isAmbiguous) {
          responseText = JSON.stringify({
            status: 'needs_clarification',
            reasoning: 'The instruction is underspecified regarding the target architecture and technology stack.',
            clarificationQuestion: 'What specific database and deployment environment should be targeted for this application?',
            suggestedOptions: ['PostgreSQL with Node.js/Docker', 'SQLite embedded for desktop', 'Serverless cloud functions'],
            assumptions: ['Defaulting to TypeScript if unstated'],
          });
        } else {
          responseText = JSON.stringify({
            status: 'clear',
            reasoning: 'The user objective is actionable and has well-defined boundaries.',
            assumptions: [
              'Targeting modern TypeScript and ES modules',
              'Applying modular clean architecture with explicit test coverage',
            ],
          });
        }
      } else if (sysInstruction.includes('Planner')) {
        responseText = JSON.stringify({
          objective: 'Fulfill user requirements via structured DAG execution',
          nodes: [
            {
              id: 'task_arch_1',
              title: 'Design System Architecture & Schemas',
              description: 'Define domain interfaces, component boundaries, and data flow.',
              role: 'architect',
              dependencies: [],
              expectedOutputs: 'Architectural specification document and TypeScript interfaces.',
              acceptanceCriteria: [
                'All entity types and state transitions are explicitly typed',
                'Modular boundaries prevent circular dependencies',
              ],
            },
            {
              id: 'task_research_2',
              title: 'Retrieve Technical Evidence & References',
              description: 'Gather relevant standards, algorithmic references, and uploaded document facts.',
              role: 'researcher',
              dependencies: [],
              expectedOutputs: 'Verified technical citations and domain formulas.',
              acceptanceCriteria: [
                'Every factual claim links to a cited source or verified passage',
              ],
            },
            {
              id: 'task_impl_3',
              title: 'Implement Core Components & Logic',
              description: 'Generate production-ready code with tool integration.',
              role: 'implementer',
              dependencies: ['task_arch_1', 'task_research_2'],
              expectedOutputs: 'Runnable code files and calculations.',
              acceptanceCriteria: [
                'Source code compiles with zero syntax errors',
                'Calculations match verification assertions',
              ],
            },
            {
              id: 'task_review_4',
              title: 'Independent Review & Security Audit',
              description: 'Audit code against OWASP guidelines, error boundaries, and acceptance criteria.',
              role: 'reviewer',
              dependencies: ['task_impl_3'],
              expectedOutputs: 'Audit report with severity findings and approval verdict.',
              acceptanceCriteria: [
                'No unhandled promise rejections or injection vulnerabilities',
              ],
            },
            {
              id: 'task_verify_5',
              title: 'Execute Verification Checks & Deliverable Validation',
              description: 'Run automated assertions, check artifact integrity, and validate claims.',
              role: 'verifier',
              dependencies: ['task_review_4'],
              expectedOutputs: 'Verification report with pass/fail verdict.',
              acceptanceCriteria: [
                'All acceptance criteria proven satisfied with executable evidence',
              ],
            },
          ],
        });
      } else if (sysInstruction.includes('Implementer')) {
        const leetcodeMatch = lastUserMessage.match(/leetcode\s*(\d+)/i);
        const leetcodeNum = leetcodeMatch ? leetcodeMatch[1] : null;
        const isSql = /\bsql\b|\bquery\b|\bselect\b|\bjoin\b|\btable\b|\bdatabase\b/i.test(lastUserMessage) || Boolean(leetcodeNum);
        const isPython = /python|\.py/i.test(lastUserMessage);
        const isBubbleSort = /bubble\s*sort/i.test(lastUserMessage);
        const isTestRequest = /test|tests|unittest|pytest|assert|edge case/i.test(lastUserMessage);
        const isUpdate = /update|modify|follow-up|follow up|add|extend|optimize/i.test(lastUserMessage);

        if (leetcodeNum === '570' || (isSql && /manager|direct report/i.test(lastUserMessage))) {
          responseText = JSON.stringify({
            summary: 'Implemented LeetCode 570 Managers with at Least 5 Direct Reports in clean SQL.',
            files: [
              {
                filename: 'leetcode_570.sql',
                title: 'LeetCode 570: Managers with at Least 5 Direct Reports',
                language: 'sql',
                content: `-- LeetCode 570: Managers with at Least 5 Direct Reports
-- Write a solution to find managers with at least five direct reports.

SELECT e.name
FROM Employee e
JOIN Employee r ON e.id = r.managerId
GROUP BY e.id, e.name
HAVING COUNT(r.id) >= 5;`,
              },
            ],
          });
        } else if (leetcodeNum === '1174' || (isSql && /immediate food|customer_pref/i.test(lastUserMessage))) {
          responseText = JSON.stringify({
            summary: 'Implemented LeetCode 1174 Immediate Food Delivery II solution in clean SQL.',
            files: [
              {
                filename: 'leetcode_1174.sql',
                title: 'LeetCode 1174: Immediate Food Delivery II',
                language: 'sql',
                content: `-- LeetCode 1174: Immediate Food Delivery II
-- Find the percentage of immediate orders in the first orders of all customers, rounded to 2 decimal places.

SELECT 
    ROUND(
        SUM(CASE WHEN order_date = customer_pref_delivery_date THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 
        2
    ) AS immediate_percentage
FROM Delivery
WHERE (customer_id, order_date) IN (
    SELECT customer_id, MIN(order_date)
    FROM Delivery
    GROUP BY customer_id
);`,
              },
            ],
          });
        } else if (leetcodeNum && isSql) {
          responseText = JSON.stringify({
            summary: `Implemented LeetCode ${leetcodeNum} SQL solution.`,
            files: [
              {
                filename: `leetcode_${leetcodeNum}.sql`,
                title: `LeetCode ${leetcodeNum} Solution`,
                language: 'sql',
                content: `-- LeetCode ${leetcodeNum} SQL Solution\n\nSELECT * FROM Solution;\n`,
              },
            ],
          });
        } else if (isSql) {
          responseText = JSON.stringify({
            summary: 'Implemented clean SQL query solution.',
            files: [
              {
                filename: 'solution.sql',
                title: 'SQL Solution',
                language: 'sql',
                content: `-- SQL Query Solution\nSELECT id, name FROM records ORDER BY id ASC;\n`,
              },
            ],
          });
        } else if (isBubbleSort && isPython) {
          if (isTestRequest || isUpdate) {
            responseText = JSON.stringify({
              summary: 'Updated bubble_sort.py (v2) with comprehensive unittest suite, type annotations, and edge case coverage.',
              files: [
                {
                  filename: 'bubble_sort.py',
                  title: 'Bubble Sort Algorithm with Unit Tests',
                  language: 'python',
                  content: `import unittest

def bubble_sort(arr: list, reverse: bool = False) -> list:
    """
    Sorts a list of elements in-place using the optimized Bubble Sort algorithm.
    Includes early-exit flag for O(n) best-case performance when already sorted.
    """
    arr = arr.copy()
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            condition = (arr[j] < arr[j + 1]) if reverse else (arr[j] > arr[j + 1])
            if condition:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
    return arr


class TestBubbleSort(unittest.TestCase):
    def test_unsorted_list(self):
        self.assertEqual(bubble_sort([64, 34, 25, 12, 22, 11, 90]), [11, 12, 22, 25, 34, 64, 90])

    def test_already_sorted_list(self):
        self.assertEqual(bubble_sort([1, 2, 3, 4, 5]), [1, 2, 3, 4, 5])

    def test_descending_order(self):
        self.assertEqual(bubble_sort([1, 2, 3], reverse=True), [3, 2, 1])

    def test_empty_list(self):
        self.assertEqual(bubble_sort([]), [])


if __name__ == "__main__":
    unittest.main()
`,
                },
              ],
            });
          } else {
            responseText = JSON.stringify({
              summary: 'Implemented optimized Bubble Sort in Python with early-exit flag and docstrings.',
              files: [
                {
                  filename: 'bubble_sort.py',
                  title: 'Bubble Sort Algorithm',
                  language: 'python',
                  content: `def bubble_sort(arr: list, reverse: bool = False) -> list:
    """
    Sorts a list of elements using the Bubble Sort algorithm.
    Includes an early-exit optimization flag (O(n) best-case).
    """
    arr = arr.copy()
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            condition = (arr[j] < arr[j + 1]) if reverse else (arr[j] > arr[j + 1])
            if condition:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
    return arr


if __name__ == "__main__":
    data = [64, 34, 25, 12, 22, 11, 90]
    print("Sorted:", bubble_sort(data))
`,
                },
              ],
            });
          }
        } else if (isPython) {
          responseText = JSON.stringify({
            summary: 'Implemented Python solution.',
            files: [
              {
                filename: 'solution.py',
                title: 'Python Solution',
                language: 'python',
                content: `def solve():\n    print("Solution executed successfully")\n\nif __name__ == "__main__":\n    solve()\n`,
              },
            ],
          });
        } else {
          responseText = JSON.stringify({
            summary: 'Implemented solution in TypeScript.',
            files: [
              {
                filename: 'solution.ts',
                title: 'Solution Deliverable',
                language: 'typescript',
                content: `export function solve(): boolean {\n  return true;\n}\n`,
              },
            ],
          });
        }
      } else if (sysInstruction.includes('Reviewer')) {
        responseText = JSON.stringify({
          verdict: 'passed',
          score: 95,
          findings: [
            {
              severity: 'info',
              category: 'Performance',
              description: 'Algorithmic complexity matches criteria with bounded memory allocation.',
            },
          ],
          criteriaChecklist: [
            {
              criterion: 'Executable assertions pass without unhandled rejections',
              met: true,
              notes: 'Syntax and boundary validations proven satisfied.',
            },
          ],
          recommendations: ['Maintain strict type annotations across public boundaries.'],
        });
      } else if (sysInstruction.includes('Replanner')) {
        const nodeIdMatch = lastUserMessage.match(/\[([a-zA-Z0-9_\-]+)\]/);
        const targetNodeId = nodeIdMatch ? nodeIdMatch[1] : 'n_fail';
        responseText = JSON.stringify({
          diagnosis: 'Isolated execution defect. Subtask failed assertions without affecting upstream architecture.',
          strategy: 'retry_node',
          nodesToReplan: [targetNodeId],
          remediationPlan: `Targeted re-execution for node ${targetNodeId}`,
        });
      } else {
        responseText = JSON.stringify({
          status: 'success',
          summary: 'Simulated structured output generated successfully.',
        });
      }
    } else if (
      sysInstruction.includes('Senior Software Engineer') ||
      sysInstruction.includes('ChatGPT') ||
      sysInstruction.includes('Gemini')
    ) {
      // 1. Check if a delivered artifact is provided in the message to synthesize faithfully
      const artifactMatch = lastUserMessage.match(/File:\s*([^\s\(\)]+)\s*(?:\(([^)]+)\))?:\s*```([a-z]*)\n([\s\S]*?)```/i);
      const deliveredFilename = artifactMatch ? artifactMatch[1] : null;
      const deliveredCode = artifactMatch ? artifactMatch[4].trim() : '';

      const leetcodeMatch = lastUserMessage.match(/leetcode\s*(\d+)/i);
      const leetcodeNum = leetcodeMatch ? leetcodeMatch[1] : (deliveredFilename?.match(/leetcode_(\d+)/)?.[1] || null);

      if (leetcodeNum === '570' || deliveredFilename === 'leetcode_570.sql') {
        responseText = `### LeetCode 570: Managers with at Least 5 Direct Reports (SQL Solution)

Here is the clean SQL query solving LeetCode 570:

\`\`\`sql
SELECT e.name
FROM Employee e
JOIN Employee r ON e.id = r.managerId
GROUP BY e.id, e.name
HAVING COUNT(r.id) >= 5;
\`\`\`

#### Explanation
- **Manager Self-Join:** Connects each manager (\`e.id\`) to their direct reports (\`r.managerId\`).
- **Aggregation by Manager:** Groups by \`e.id\` and \`e.name\` to aggregate reports per individual manager.
- **Threshold Filtering:** The \`HAVING COUNT(r.id) >= 5\` condition retains only managers overseeing at least 5 reporting employees.

The complete solution is persisted as **\`leetcode_570.sql\`** in the artifact preview card below ready for direct download.`;
      } else if (leetcodeNum === '1174' || deliveredFilename === 'leetcode_1174.sql') {
        responseText = `### LeetCode 1174: Immediate Food Delivery II (SQL Solution)

Here is the clean SQL query solving LeetCode 1174:

\`\`\`sql
SELECT 
    ROUND(
        SUM(CASE WHEN order_date = customer_pref_delivery_date THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 
        2
    ) AS immediate_percentage
FROM Delivery
WHERE (customer_id, order_date) IN (
    SELECT customer_id, MIN(order_date)
    FROM Delivery
    GROUP BY customer_id
);
\`\`\`

#### Explanation
- **Earliest Orders:** Identifies each customer's first order using \`MIN(order_date)\` grouped by \`customer_id\`.
- **Immediate Calculation:** Counts orders where \`order_date = customer_pref_delivery_date\`.
- **Percentage & Rounding:** Divides by total first orders and rounds to 2 decimal places using \`ROUND(..., 2)\`.

The clean SQL query is delivered as **\`leetcode_1174.sql\`** in the preview card below.`;
      } else if (deliveredFilename && deliveredCode) {
        responseText = `### Solution: \`${deliveredFilename}\`

Here is the implementation deliverable for your request:

\`\`\`${artifactMatch?.[3] || 'text'}
${deliveredCode}
\`\`\`

#### Implementation Overview
- The logic satisfies all constraints with standard idiomatic structure and error boundary guards.
- The deliverable is saved as **\`${deliveredFilename}\`** in the artifact card below for review or download.`;
      } else {
        responseText = `### Answer Overview

Regarding your question: **"${lastUserMessage.slice(0, 120)}"**

#### Detailed Explanation
- **Core Principles:** This follows standard software engineering principles with clean architectural separation of concerns, strong type validation, and explicit boundary handling.
- **Best Practices:** Decouple interfaces, handle transient failures gracefully, and verify requirements with deterministic tests.

Feel free to ask any follow-up questions or request specific code implementations!`;
      }
    } else if (
      sysInstruction.includes('Authoritative Senior Engineer') ||
      sysInstruction.includes('Technical Specialist')
    ) {
      responseText = `### Technical Analysis

Regarding: **"${lastUserMessage.slice(0, 120)}"**

- **Concepts & Foundations:** Structured systems emphasize maintainability, low coupling, and predictable state transitions.
- **Design Guidelines:** Ensure idempotent operations and clear API contracts across boundaries.`;
    } else {
      responseText = `Completed processing step for: ${lastUserMessage.slice(0, 100)}... Execution completed with rigorous verification.`;
    }

    return {
      text: responseText,
      usage: {
        promptTokens: 120,
        completionTokens: 250,
        totalTokens: 370,
        estimatedCostUsd: 0.000045,
      },
      provider: 'mock',
      model: options.model || 'mock-engine-v1',
      finishReason: 'stop',
    };
  }
}
