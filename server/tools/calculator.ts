import { ToolDefinition } from './types.js';

export const calculatorTool: ToolDefinition = {
  name: 'calculator',
  description: 'Perform arithmetic and mathematical calculations with precision. Evaluates mathematical expressions and returns structured numerical results.',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (e.g. "125 * 0.18 + 450", "sqrt(144) + pow(2, 8)", "sum([10, 20, 30])")',
      },
      description: {
        type: 'string',
        description: 'Optional short label or purpose of the calculation',
      },
    },
    required: ['expression'],
  },
  permissionLevel: 'execute',
  timeoutMs: 3000,
  execute: async (args, context) => {
    const start = Date.now();
    const rawExpr = String(args.expression || '').trim();

    if (!rawExpr) {
      return {
        success: false,
        data: null,
        error: 'Expression argument cannot be empty',
        executionTimeMs: Date.now() - start,
      };
    }

    try {
      // Safe mathematical evaluation sandbox
      // Disallow any keywords like require, process, window, global, eval, Function, import, prototype
      if (/[a-zA-Z_$]/.test(rawExpr)) {
        const allowedWords = new Set([
          'sqrt', 'pow', 'abs', 'round', 'floor', 'ceil', 'min', 'max',
          'sin', 'cos', 'tan', 'log', 'exp', 'pi', 'PI', 'e', 'E',
          'sum', 'mean', 'avg', 'stdev', 'Infinity', 'NaN'
        ]);
        const words = rawExpr.match(/[a-zA-Z_$]+/g) || [];
        for (const w of words) {
          if (!allowedWords.has(w)) {
            throw new Error(`Unauthorized identifier in expression: "${w}". Only standard mathematical functions are permitted.`);
          }
        }
      }

      // Provide math helper scope
      const sandbox: Record<string, any> = {
        sqrt: Math.sqrt,
        pow: Math.pow,
        abs: Math.abs,
        round: Math.round,
        floor: Math.floor,
        ceil: Math.ceil,
        min: Math.min,
        max: Math.max,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        log: Math.log,
        exp: Math.exp,
        pi: Math.PI,
        PI: Math.PI,
        e: Math.E,
        E: Math.E,
        sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
        mean: (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length,
        avg: (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length,
        stdev: (arr: number[]) => {
          const m = arr.reduce((a, b) => a + b, 0) / arr.length;
          const v = arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length;
          return Math.sqrt(v);
        },
      };

      // Evaluate safely
      const keys = Object.keys(sandbox);
      const values = Object.values(sandbox);
      const evaluator = new Function(...keys, `"use strict"; return (${rawExpr});`);
      const result = evaluator(...values);

      if (typeof result !== 'number') {
        throw new Error(`Calculation did not return a scalar number, received: ${typeof result}`);
      }

      if (!isFinite(result)) {
        return {
          success: false,
          data: null,
          error: `Result is not finite (divided by zero or infinity encountered): ${result}`,
          executionTimeMs: Date.now() - start,
        };
      }

      return {
        success: true,
        data: {
          expression: rawExpr,
          result: Number(result.toFixed(8)),
          raw: result,
          formatted: result.toLocaleString('en-US', { maximumFractionDigits: 6 }),
          description: args.description || 'Mathematical Calculation',
        },
        executionTimeMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        data: null,
        error: `Calculation error: ${err.message}`,
        executionTimeMs: Date.now() - start,
      };
    }
  },
};
