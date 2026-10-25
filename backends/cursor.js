// Runs one task at a time through the logged-in Cursor CLI via ACP (no API key).
import { createAcpClient } from './acp-client.js';
import { findCursorAgent } from '../lib/cursor-path.js';
import {
  acpPermissionReq,
  acpPromptResultToStatus,
  acpUpdateToStatus,
  extractTextChoice,
  scrubCursorAnswer,
} from '../lib/status-cursor.js';

function mapAllow(answer) {
  if (answer === 'always') return 'allow-always';
  if (answer === 'deny') return 'reject-once';
  return 'allow-once';
}

export function createCursorAgent({ onStatus, onSession, askPermission, findBin = findCursorAgent }) {
  let client = null;
  let clientModel = undefined; // model id pinned at ACP spawn (--model); undefined = Auto
  let sessionId = null;
  let busy = false;
  let stopped = false;
  let live = false; // only capture session/update while session/prompt is in flight
  let answerBuf = '';
  let lastPartial = {};
  let turnAbort = null; // aborted by stop() so pending askPermission / choice UI unblocks

  async function ensureClient(model) {
    const want = model || undefined;
    if (client && !client.closed && clientModel === want) return client;
    if (client) {
      client.close();
      client = null;
      sessionId = null;
    }
    const bin = findBin();
    if (!bin) throw new Error('Cursor Agent nicht gefunden. Installier die Cursor CLI und melde dich mit „agent login“ an.');

    const args = want ? ['--model', want, 'acp'] : ['acp'];
    clientModel = want;
    const next = createAcpClient({
      node: bin.node,
      index: bin.index,
      args,
      env: { ...process.env, DESKTOPCOMPANION_AGENT: '1' },
      onNotification: (method, params) => {
        if (method !== 'session/update') return;
        // session/load replays old assistant chunks — ignore anything outside the active prompt
        if (!live) return;
        const s = acpUpdateToStatus(params.update, lastPartial);
        if (!s) return;
        if (s._partial) {
          lastPartial = s;
          answerBuf = s.answer ?? answerBuf;
          const { answer, transportFail } = scrubCursorAnswer(answerBuf);
          if (transportFail) return; // don't paint Cursor's internal stream dump into the chat
          const { _partial, ...pub } = s;
          onStatus({ ...pub, answer });
          return;
        }
        onStatus(s);
      },
      onRequest: async (method, params) => {
        const signal = turnAbort?.signal;
        if (method === 'session/request_permission') {
          const req = acpPermissionReq(params);
          const { answer } = await askPermission(req, signal);
          return { outcome: { outcome: 'selected', optionId: mapAllow(answer) } };
        }
        if (method === 'cursor/ask_question') {
          const questions = (params.questions ?? []).map((q) => ({
            question: q.prompt ?? q.question ?? '',
            options: (q.options ?? []).map((o) => ({ label: o.label, description: o.description, id: o.id })),
            multiSelect: !!q.allowMultiple,
            id: q.id,
          }));
          const { answer, picks, message } = await askPermission(
            { toolName: 'AskUserQuestion', input: { questions }, title: params.title },
            signal,
          );
          if (answer === 'deny') return { outcome: { outcome: 'skipped', reason: message || 'übersprungen' } };
          const answers = questions.map((q, i) => {
            const labels = picks?.[i] ?? [];
            const ids = labels.map((label) => q.options.find((o) => o.label === label)?.id).filter(Boolean);
            return { questionId: q.id, selectedOptionIds: ids };
          });
          return { outcome: { outcome: 'answered', answers } };
        }
        if (method === 'cursor/create_plan') {
          const { answer, message } = await askPermission(
            {
              toolName: 'ExitPlanMode',
              input: { plan: params.plan ?? params.overview ?? '' },
              title: params.name || 'Plan prüfen',
            },
            signal,
          );
          if (answer === 'deny') return { outcome: { outcome: 'rejected', reason: message || 'Plan abgelehnt' } };
          return { outcome: { outcome: 'accepted' } };
        }
        // Unknown cursor/* extensions: accept so ACP never hangs waiting for a reply
        if (String(method).startsWith('cursor/')) {
          return { outcome: { outcome: 'accepted' } };
        }
        return { outcome: { outcome: 'rejected', reason: 'unsupported' } };
      },
    });
    client = next;

    try {
      await client.request('initialize', {
        protocolVersion: 1,
        clientCapabilities: {
          fs: { readTextFile: false, writeTextFile: false },
          terminal: false,
          _meta: { parameterizedModelPicker: true },
        },
        clientInfo: { name: 'desktopcompanion', version: '0.1.0' },
      });
      await client.request('authenticate', { methodId: 'cursor_login' });
      return client;
    } catch (e) {
      // Don't keep a half-dead ACP client — next start must spawn fresh
      try {
        client.close();
      } catch {}
      client = null;
      clientModel = undefined;
      sessionId = null;
      throw e;
    }
  }

  async function applyModel(c, sid, sessionResult, model) {
    if (!model) return;
    const opts = sessionResult?.configOptions ?? [];
    const modelOpt = opts.find((o) => o.category === 'model' || o.type === 'model');
    const configId = modelOpt?.id ?? modelOpt?.configId;
    if (configId) {
      try {
        await c.request('session/set_config_option', { sessionId: sid, configId, value: model });
        return;
      } catch {}
    }
    try {
      await c.request('session/set_model', { sessionId: sid, modelId: model });
    } catch {}
  }

  async function start(prompt, cwd, resume, { plan = false, model } = {}) {
    if (busy) return;
    busy = true;
    stopped = false;
    answerBuf = '';
    lastPartial = {};
    turnAbort?.abort();
    turnAbort = new AbortController();
    onStatus({ state: 'thinking', text: 'Nikki startet…' });
    try {
      const c = await ensureClient(model);
      if (stopped) {
        onStatus({ state: 'idle', text: 'Nikki stoppte.' });
        return;
      }
      let sessionMeta = null;
      if (resume) {
        try {
          sessionMeta = await c.request('session/load', { cwd, sessionId: resume, mcpServers: [] });
          sessionId = sessionMeta.sessionId ?? resume;
        } catch {
          if (stopped) {
            onStatus({ state: 'idle', text: 'Nikki stoppte.' });
            return;
          }
          sessionMeta = await c.request('session/new', { cwd, mcpServers: [] });
          sessionId = sessionMeta.sessionId;
        }
      } else {
        sessionMeta = await c.request('session/new', { cwd, mcpServers: [] });
        sessionId = sessionMeta.sessionId;
      }
      if (stopped) {
        onStatus({ state: 'idle', text: 'Nikki stoppte.' });
        return;
      }
      onSession(sessionId);
      await applyModel(c, sessionId, sessionMeta, model);
      if (stopped) {
        onStatus({ state: 'idle', text: 'Nikki stoppte.' });
        return;
      }

      const params = {
        sessionId,
        prompt: [{ type: 'text', text: prompt }],
      };
      if (plan) params.mode = 'plan';

      // ACP never exposes AskQuestion — agents write "Tee oder Kaffee?" as chat.
      // Detect Coucou-style choices, show option buttons, then resume with the pick.
      answerBuf = '';
      lastPartial = {};
      live = true;
      let result;
      try {
        result = await c.request('session/prompt', params);
      } finally {
        live = false;
      }
      if (stopped) {
        onStatus({ state: 'idle', text: 'Nikki stoppte.', answer: answerBuf });
        return;
      }

      let finalAnswer = scrubCursorAnswer(answerBuf).answer;
      answerBuf = finalAnswer;
      let finalResult = result;

      // Cap Coucou-style text choices: same summary twice or too many rounds = stop asking
      let choiceRounds = 0;
      let lastChoiceSummary = '';
      while (!stopped && choiceRounds < 5) {
        const choice = extractTextChoice(finalAnswer);
        if (!choice || choice.summary === lastChoiceSummary) break;
        lastChoiceSummary = choice.summary;
        choiceRounds += 1;
        onStatus({ state: 'needsYou', text: choice.summary, answer: finalAnswer });
        const res = await askPermission(
          { toolName: 'AskUserQuestion', input: { questions: choice.questions }, title: choice.title },
          turnAbort?.signal,
        );
        if (stopped) break;
        if (res.answer === 'deny') {
          onStatus({ state: 'done', text: 'Nikki ist fertig.', answer: finalAnswer });
          return;
        }
        const labels = (res.picks ?? []).flat().filter(Boolean);
        const follow = labels.join(', ') || res.message?.trim() || 'Weiter';
        // Commit this round into the chat before the follow-up prompt streams
        onStatus({
          state: 'working',
          text: 'Nikki macht weiter…',
          answer: '',
          turn: { assistant: finalAnswer, user: follow },
        });
        answerBuf = '';
        lastPartial = {};
        live = true;
        try {
          finalResult = await c.request('session/prompt', {
            sessionId,
            prompt: [{ type: 'text', text: follow }],
          });
        } finally {
          live = false;
        }
        if (stopped) break;
        finalAnswer = scrubCursorAnswer(answerBuf).answer;
        answerBuf = finalAnswer;
      }

      if (stopped) onStatus({ state: 'idle', text: 'Nikki stoppte.', answer: finalAnswer });
      else onStatus(acpPromptResultToStatus(finalResult, finalAnswer));
    } catch (e) {
      live = false;
      if (stopped) onStatus({ state: 'idle', text: 'Nikki stoppte.', answer: answerBuf });
      else {
        const msg = e.message || String(e);
        const soft = /WritableIterable is closed|RetriableError|ConnectError/i.test(msg);
        onStatus({
          state: 'error',
          text: soft ? 'Nikki verlor die Leitung.' : 'Nikki stolpert.',
          answer: soft
            ? 'Cursor hat die Verbindung kurz verloren. Nochmal senden sollte reichen.'
            : msg,
        });
      }
    } finally {
      live = false;
      busy = false;
    }
  }

  function stop() {
    if (!busy) return;
    stopped = true;
    turnAbort?.abort();
    if (client && sessionId) client.request('session/cancel', { sessionId }).catch(() => {});
  }

  function dispose() {
    stop();
    client?.close();
    client = null;
    clientModel = undefined;
    sessionId = null;
  }

  return { start, stop, busy: () => busy, dispose };
}
