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
        const isAmbiguous = lastUserMessage.toLowerCase().includes('maybe') || 
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
        const isSql = /\bsql\b|\bquery\b|\bselect\b|\bjoin\b|\bleetcode\s*1174\b|\bimmediate food\b/i.test(lastUserMessage);
        const isPython = /python|\.py/i.test(lastUserMessage);
        const isBubbleSort = /bubble\s*sort/i.test(lastUserMessage);
        const isTestRequest = /test|tests|unittest|pytest|assert|edge case/i.test(lastUserMessage);
        const isUpdate = /update|modify|follow-up|follow up|add|extend|optimize/i.test(lastUserMessage);

        if (isSql) {
          responseText = JSON.stringify({
            summary: "Implemented LeetCode 1174 Immediate Food Delivery II solution in clean SQL.",
            files: [
              {
                filename: "leetcode_1174.sql",
                title: "LeetCode 1174: Immediate Food Delivery II",
                language: "sql",
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
);`
              }
            ]
          });
        } else if (isBubbleSort && isPython) {
          if (isTestRequest || isUpdate) {
            responseText = JSON.stringify({
              summary: "Updated bubble_sort.py (v2) with comprehensive unittest suite, type annotations, and edge case coverage.",
              files: [
                {
                  filename: "bubble_sort.py",
                  title: "Bubble Sort Algorithm with Unit Tests",
                  language: "python",
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
`
                }
              ]
            });
          } else {
            responseText = JSON.stringify({
              summary: "Implemented optimized Bubble Sort in Python with early-exit flag and docstrings.",
              files: [
                {
                  filename: "bubble_sort.py",
                  title: "Bubble Sort Algorithm",
                  language: "python",
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
`
                }
              ]
            });
          }
        } else if (isPython) {
          responseText = JSON.stringify({
            summary: "Implemented Python solution.",
            files: [
              {
                filename: "solution.py",
                title: "Python Solution",
                language: "python",
                content: `def solve():\n    print("Solution executed successfully")\n\nif __name__ == "__main__":\n    solve()\n`
              }
            ]
          });
        } else {
          responseText = JSON.stringify({
            summary: "Implemented solution in TypeScript.",
            files: [
              {
                filename: "solution.ts",
                title: "Solution Deliverable",
                language: "typescript",
                content: `export function solve(): boolean {\n  return true;\n}\n`
              }
            ]
          });
        }
      } else if (sysInstruction.includes('Verifier')) {
        responseText = JSON.stringify({
          verdict: 'passed',
          confidence: 0.98,
          findings: [
            'All acceptance criteria verified against delivered artifacts.',
            'Deterministic test suite executed cleanly with 100% pass rate.',
            'No fabricated evidence or unverified assertions detected.',
          ],
          testsRun: [
            { name: 'Artifact Integrity Check', passed: true, output: 'Files exist and non-empty' },
            { name: 'Schema Invariant Test', passed: true, output: 'All types match specifications' },
          ],
        });
      } else if (sysInstruction.includes('Replanner')) {
        const nodeIdMatch = lastUserMessage.match(/\[([a-zA-Z0-9_-]+)\]/) || lastUserMessage.match(/node[:\s]+([a-zA-Z0-9_-]+)/i);
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
    } else if (sysInstruction.includes('Senior Software Engineer') || sysInstruction.includes('ChatGPT') || sysInstruction.includes('Gemini')) {
      const isSql = /\bsql\b|\bquery\b|\bselect\b|\bjoin\b|\bleetcode\s*1174\b|\bimmediate food\b/i.test(lastUserMessage);
      const isBubbleSort = /bubble\s*sort/i.test(lastUserMessage) || lastUserMessage.includes('bubble_sort.py');
      const isTestOrFollowUp = /test|tests|unittest|update|follow-up|follow up/i.test(lastUserMessage);

      if (isSql) {
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
      } else if (isBubbleSort) {
        if (isTestOrFollowUp) {
          responseText = `### Updated \`bubble_sort.py\` with Comprehensive Unit Tests

I have updated the **\`bubble_sort.py\`** deliverable (Version 2) to include an automated **\`unittest\`** suite covering all standard conditions and edge cases.

#### What Was Added
1. **Automated Test Suite (\`TestBubbleSort\`):**
   - **Standard Array:** Verifies ascending sorting of unordered integers.
   - **Already Sorted:** Confirms the early-exit optimization triggers in $O(n)$ time.
   - **Reverse Sorted:** Evaluates worst-case performance $O(n^2)$.
   - **Descending Flag:** Tests the \`reverse=True\` optional parameter.
   - **Duplicates & Negatives:** Ensures stability with duplicate values and negative numbers.
   - **Empty & Single-Element Lists:** Edge-case boundary assertions.

2. **Run Instructions:**
   You can run the tests directly in your terminal:
   \`\`\`bash
   python bubble_sort.py
   \`\`\`

The updated **\`bubble_sort.py\`** artifact is ready below for preview or direct download!`;
        } else {
          responseText = `### Python Bubble Sort Algorithm Implementation

Here is the complete, production-ready Python implementation of the **Bubble Sort** algorithm.

#### How It Works
Bubble Sort compares adjacent elements and swaps them if they are in the wrong order. This pass is repeated until the list is sorted.

- **Early-Exit Optimization:** Uses a boolean \`swapped\` flag. If no swaps occur during an entire pass, the algorithm terminates immediately.
- **Time Complexity:**
  - **Best Case:** $\\mathcal{O}(n)$ when the array is already sorted.
  - **Average & Worst Case:** $\\mathcal{O}(n^2)$ when elements are randomly ordered or reversed.
- **Space Complexity:** $\\mathcal{O}(1)$ auxiliary space because elements are sorted in-place.

\`\`\`python
# Quick usage snippet:
sample = [64, 34, 25, 12, 22, 11, 90]
sorted_list = bubble_sort(sample)
print(sorted_list)  # [11, 12, 22, 25, 34, 64, 90]
\`\`\`

You can preview the full source code in the **Deliverable Preview** card below or click **Download** to save \`bubble_sort.py\` directly to your device. Feel free to ask any follow-up questions to customize or optimize this solution!`;
        }
      } else {
        responseText = `### Solution Overview

I have planned, implemented, and verified the requested solution for:
**"${lastUserMessage.slice(0, 100)}"**

#### Highlights & Implementation Details
- **Architecture & Modularity:** Implemented using clean modular patterns with complete error handling.
- **Verification:** Validated with automated assertions and static checks.
- **Downloadable Deliverable:** The complete source code deliverable is available in the preview card below ready for direct download.

You can ask any follow-up questions or request modifications to the code!`;
      }
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
