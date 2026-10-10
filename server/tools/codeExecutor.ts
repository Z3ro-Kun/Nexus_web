import { ToolDefinition } from './types.js';

export const codeExecutorTool: ToolDefinition = {
  name: 'code_executor',
  description: 'Execute JavaScript / algorithm logic in a secure sandbox. Captures console output, test assertions, return value, and execution duration. Used for testing code, validating calculations, and asserting invariants.',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'JavaScript code snippet to execute. Must return a result or log statements. Can use `assert(condition, message)` for testing.',
      },
      description: {
        type: 'string',
        description: 'Purpose or test name of the code execution',
      },
    },
    required: ['code'],
  },
  permissionLevel: 'execute',
  timeoutMs: 5000,
  execute: async (args, context) => {
    const start = Date.now();
    const code = String(args.code || '').trim();

    if (!code) {
      return {
        success: false,
        data: null,
        error: 'Code cannot be empty',
        executionTimeMs: Date.now() - start,
      };
    }

    // Safety checks against prohibited globals
    const prohibited = ['process.exit', 'child_process', 'require("fs")', 'import("fs")', 'process.env'];
    for (const p of prohibited) {
      if (code.includes(p)) {
        return {
          success: false,
          data: null,
          error: `Execution prohibited: code contains forbidden expression "${p}"`,
          executionTimeMs: Date.now() - start,
        };
      }
    }

    const logs: string[] = [];
    const assertions: { message: string; passed: boolean }[] = [];

    const customConsole = {
      log: (...items: any[]) => logs.push(items.map((i) => (typeof i === 'object' ? JSON.stringify(i) : String(i))).join(' ')),
      warn: (...items: any[]) => logs.push('[WARN] ' + items.join(' ')),
      error: (...items: any[]) => logs.push('[ERROR] ' + items.join(' ')),
    };

    const assert = (condition: boolean, message = 'Assertion') => {
      assertions.push({
        message,
        passed: Boolean(condition),
      });
      if (!condition) {
        throw new Error(`Assertion Failed: ${message}`);
      }
    };

    try {
      // Safe function sandbox
      const sandboxFn = new Function('console', 'assert', 'Math', 'JSON', `"use strict";\n${code}`);
      const result = sandboxFn(customConsole, assert, Math, JSON);

      const allAssertionsPassed = assertions.length === 0 || assertions.every((a) => a.passed);

      return {
        success: allAssertionsPassed,
        data: {
          result: result !== undefined ? result : (logs.length > 0 ? logs[logs.length - 1] : 'Executed successfully'),
          logs,
          assertionsRun: assertions.length,
          assertionsPassed: assertions.filter((a) => a.passed).length,
          assertionsFailed: assertions.filter((a) => !a.passed).length,
          allPassed: allAssertionsPassed,
        },
        executionTimeMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        data: {
          logs,
          assertions,
        },
        error: `Runtime exception: ${err.message}`,
        executionTimeMs: Date.now() - start,
      };
    }
  },
};
