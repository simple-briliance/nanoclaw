/**
 * spawn_cc_task MCP tool — requests the host to spawn a Claude Code process
 * on bare metal for a coding or dev task.
 *
 * The container cannot exec processes on the host directly. Instead, this tool
 * writes a system action to outbound.db; the host's delivery loop picks it up
 * via `registerDeliveryAction('spawn_cc_task', ...)` in src/modules/cc-spawn/
 * and spawns `claude -p` as a host-side child process.
 *
 * Pattern: identical to scheduling.ts — write a system action, return
 * immediately. The host handles the rest asynchronously.
 */
import { writeMessageOut } from '../db/messages-out.js';
import { getSessionRouting } from '../db/session-routing.js';
import { registerTools } from './server.js';
import type { McpToolDefinition } from './types.js';

function generateId(): string {
  return `cc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function err(text: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true };
}

export const spawnCcTask: McpToolDefinition = {
  tool: {
    name: 'spawn_cc_task',
    description:
      'Spawn a Claude Code agent on the host machine to execute a coding or dev task autonomously. ' +
      'Use for tasks that require cloning repos, writing code, running tests, or any work that ' +
      'needs direct filesystem and shell access outside the container. ' +
      'The task runs asynchronously — the result is delivered back to this session when complete. ' +
      'Provide a self-contained prompt: CC will not have this conversation context.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string',
          description:
            'Full task description for the CC agent. Be specific and self-contained — include ' +
            'the repo name, what to implement, any constraints, and where to write outputs. ' +
            'CC reads ~/brain/projects/<name>/ for prior context automatically.',
        },
        cwd: {
          type: 'string',
          description:
            'Absolute path on the host to run CC in (e.g. /Users/sean/dev/my-repo). ' +
            'If the repo does not exist yet, provide the parent directory and include ' +
            'a `git clone` step in the prompt.',
        },
      },
      required: ['prompt', 'cwd'],
    },
  },

  async handler(args) {
    const prompt = args.prompt as string;
    const cwd = args.cwd as string;

    if (!prompt || !cwd) return err('prompt and cwd are required');
    if (!cwd.startsWith('/')) return err('cwd must be an absolute path');

    const id = generateId();
    const r = getSessionRouting();

    writeMessageOut({
      id,
      kind: 'system',
      platform_id: r.platform_id,
      channel_type: r.channel_type,
      thread_id: r.thread_id,
      content: JSON.stringify({
        action: 'spawn_cc_task',
        taskId: id,
        prompt,
        cwd,
        platformId: r.platform_id,
        channelType: r.channel_type,
        threadId: r.thread_id,
      }),
    });

    return ok(
      `CC task queued (id: ${id}). The host will spawn Claude Code in ${cwd}. ` +
        `Result will be delivered back to this session when complete.`,
    );
  },
};

registerTools([spawnCcTask]);
