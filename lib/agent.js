// Backend factory: Claude / Cursor ACP / Gemini CLI. Same contract: { start, stop, busy }.
import { createClaudeAgent } from '../backends/claude.js';
import { createCursorAgent } from '../backends/cursor.js';
import { createGeminiAgent } from '../backends/gemini.js';

export function createBackend(id, opts) {
  if (id === 'cursor') return createCursorAgent(opts);
  if (id === 'gemini' || id === 'aistudio') return createGeminiAgent(opts);
  return createClaudeAgent(opts);
}
