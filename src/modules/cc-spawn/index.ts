/**
 * cc-spawn module — host-side handler for the `spawn_cc_task` delivery action.
 *
 * When the container agent calls the `spawn_cc_task` MCP tool, it writes a
 * system action to outbound.db. This module picks it up via the delivery
 * action registry, spawns `claude -p` as a bare-metal child process on the
 * host, and writes the result back into the session's inbound.db so the
 * container agent wakes and relays the outcome to Slack.
 *
 * The handler returns immediately — CC runs asynchronously. Long tasks
 * (minutes to hours) are supported without blocking the delivery loop.
 *
 * Removal: delete this directory and its import line in src/modules/index.ts.
 * The delivery loop will log "Unknown system action" for any queued
 * spawn_cc_task messages, which is safe — they'll be marked delivered and
 * dropped, not retried indefinitely.
 */
import { spawn } from 'child_process';

import { registerDeliveryAction } from '../../delivery.js';
import { log } from '../../log.js';
import { wakeContainer } from '../../container-runner.js';
import { writeSessionMessage } from '../../session-manager.js';
import { getSession } from '../../db/sessions.js';
import type { Session } from '../../types.js';
import type Database from 'better-sqlite3';

/**
 * Path to the `claude` CLI on the host. Adjust if installed to a non-standard
 * location (e.g. /opt/homebrew/bin/claude on Apple Silicon Homebrew installs).
 * `which claude` on the host will show the correct path.
 */
const CLAUDE_BIN = 'claude';

async function handleSpawnCcTask(
  content: Record<string, unknown>,
  session: Session,
  _inDb: Database.Database,
): Promise<void> {
  const taskId = content.taskId as string;
  const prompt = content.prompt as string;
  const cwd = content.cwd as string;

  if (!prompt || !cwd) {
    log.warn('spawn_cc_task missing required fields', { taskId, sessionId: session.id });
    return;
  }

  log.info('Spawning CC task', { taskId, cwd, sessionId: session.id });

  // Snapshot session ids — the session object may mutate by the time CC exits.
  const agentGroupId = session.agent_group_id;
  const sessionId = session.id;

  const chunks: Buffer[] = [];

  const child = spawn(CLAUDE_BIN, ['-p', prompt], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));

  child.on('error', (err) => {
    log.error('CC task spawn error', { taskId, err });
    deliverResult(agentGroupId, sessionId, taskId, cwd, null, `Spawn error: ${err.message}`);
  });

  child.on('close', (code) => {
    const output = Buffer.concat(chunks).toString('utf-8').trim();
    log.info('CC task complete', { taskId, exitCode: code, outputLen: output.length });
    deliverResult(agentGroupId, sessionId, taskId, cwd, code, output);
  });
}

function deliverResult(
  agentGroupId: string,
  sessionId: string,
  taskId: string,
  cwd: string,
  exitCode: number | null,
  output: string,
): void {
  // Re-look up the session — wakeContainer needs the full object.
  const session = getSession(sessionId);
  if (!session) {
    log.warn('CC task result: session no longer exists', { taskId, sessionId });
    return;
  }

  const status = exitCode === 0 ? 'completed' : `failed (exit ${exitCode ?? 'error'})`;
  const preview = output.length > 2000 ? output.slice(0, 2000) + '\n…(truncated)' : output;
  const content = JSON.stringify({
    type: 'text',
    text:
      `**CC task ${status}** (id: ${taskId})\n` +
      `Working directory: \`${cwd}\`\n\n` +
      (preview || '_(no output)_'),
  });

  try {
    writeSessionMessage(agentGroupId, sessionId, {
      id: `cc-result-${taskId}`,
      kind: 'user',
      timestamp: new Date().toISOString(),
      content,
    });
    void wakeContainer(session);
    log.info('CC task result delivered to session', { taskId, sessionId });
  } catch (err) {
    log.error('Failed to deliver CC task result', { taskId, sessionId, err });
  }
}

registerDeliveryAction('spawn_cc_task', handleSpawnCcTask);
