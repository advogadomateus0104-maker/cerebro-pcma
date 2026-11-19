/*
 * Camada de API do site.
 *
 * No site original, as rotas /api/* rodavam num Cloudflare Worker com banco D1.
 * Aqui, as mesmas rotas são atendidas no navegador e falam com o Supabase
 * através de funções SQL (RPC). Os componentes continuam chamando
 * fetch('/api/...') exatamente como antes, então o código das telas é o original.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { MARANHAO_REVISION, getMaranhaoExamInfo } from './data/maranhao';
import { loadReview, normalizeExamId } from './data/exams';
import type { RankingEntry } from './data/types';

const nativeFetch = window.fetch.bind(window);

class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Banco fora do ar (rede, pausa do Supabase, erro 5xx). O site continua funcionando no modo local. */
class OfflineError extends Error {}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  // Tempo-limite: se o servidor não responder em 10 s, a tela não fica presa em "carregando".
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
  response = await nativeFetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    signal: controller.signal,
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      // Chaves antigas (JWT "anon") também vão no Authorization; as novas (sb_publishable_) só no apikey.
      ...(SUPABASE_ANON_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  } catch {
    window.clearTimeout(timeout);
    throw new OfflineError('Servidor indisponível.');
  }
  let text = '';
  try { text = await response.text(); } catch { throw new OfflineError('Servidor indisponível.'); } finally { window.clearTimeout(timeout); }
  if (response.status >= 500) throw new OfflineError('Servidor indisponível.');
  let payload: { message?: string } | null = null;
  try { payload = text ? JSON.parse(text) : null; } catch { throw new OfflineError('Resposta inválida do servidor.'); }
  if (!response.ok) {
    const message: string = payload?.message ?? 'Falha de comunicação com o servidor.';
    // Funções SQL sinalizam o status HTTP original no prefixo "409:" / "403:".
    const match = /^(\d{3}):\s*(.*)$/s.exec(message);
    if (match) throw new ApiError(match[2], Number(match[1]));
    throw new ApiError(message, response.status >= 500 ? 500 : 400);
  }
  return payload as T;
}

/* ---------- modo local: histórico, cache do ranking e fila de envio ---------- */
type LocalAttempt = {
  examId: string; attemptKey: string; candidateName: string; score: number; total: number;
  elapsedSeconds: number; finishedAt: string; answers: Record<string, string>;
  /** true = já está no ranking; false = aguardando envio; 'rejected' = servidor recusou (não reenviar). */
  synced: boolean | 'rejected';
};
const HISTORY_KEY = 'cerebro-historico-v1';
const RANKING_CACHE = 'cerebro-ranking-cache-v1-';

function safeGet<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function safeSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* armazenamento cheio ou bloqueado */ }
}
function readHistory(): LocalAttempt[] { return safeGet<LocalAttempt[]>(HISTORY_KEY, []); }
function saveAttempt(entry: LocalAttempt) {
  const history = readHistory().filter((item) => !(item.examId === entry.examId && item.attemptKey === entry.attemptKey));
  history.push(entry);
  safeSet(HISTORY_KEY, history);
}
const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();
function sanitizeAnswers(value: unknown) {
  const answers: Record<string, string> = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [question, answer] of Object.entries(value)) {
      if (/^([1-9]|[1-9][0-9]|100)$/.test(question) && typeof answer === 'string' && /^[a-e]$/i.test(answer)) answers[question] = answer.toLowerCase();
    }
  }
  return answers;
}

/** Copia para o histórico as provas já entregues que estavam guardadas no navegador. */
function importStoredResults() {
  const history = readHistory();
  const known = new Set(history.map((item) => `${item.examId}|${item.attemptKey}`));
  let changed = false;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index) ?? '';
    const match = /^cerebro-pcpr-exam-(.+?)(?:-(?:ma\d{8}|\d{8}))?$/.exec(key);
    if (!match) continue;
    const data = safeGet<{ phase?: string; attemptKey?: string; result?: { candidateName: string; score: number; total: number; elapsedSeconds: number; finishedAt: string; answers?: Record<string, string> } } | null>(key, null);
    const examId = normalizeExamId(match[1]);
    if (!examId || data?.phase !== 'finished' || !data.result || !data.attemptKey) continue;
    if (known.has(`${examId}|${data.attemptKey}`)) continue;
    const r = data.result;
    history.push({ examId, attemptKey: data.attemptKey, candidateName: r.candidateName, score: r.score, total: r.total,
      elapsedSeconds: r.elapsedSeconds, finishedAt: r.finishedAt, answers: r.answers ?? {}, synced: true });
    changed = true;
  }
  if (changed) safeSet(HISTORY_KEY, history);
}

/** Envia ao ranking as provas corrigidas no aparelho enquanto o banco estava fora. */
let syncing = false;
async function syncPending() {
  if (syncing) return;
  const pending = readHistory().filter((item) => item.synced === false).sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  if (!pending.length) return;
  syncing = true;
  let sent = false;
  try {
    for (const item of pending) {
      try {
        await rpc('finish_attempt', { p_exam: item.examId, p_attempt_key: item.attemptKey, p_name: item.candidateName,
          p_elapsed: item.elapsedSeconds, p_answers: item.answers });
        saveAttempt({ ...item, synced: true });
        sent = true;
      } catch (cause) {
        if (cause instanceof OfflineError) break;
        saveAttempt({ ...item, synced: 'rejected' });
      }
    }
  } finally {
    syncing = false;
    if (sent) window.dispatchEvent(new Event('cerebro-progress-updated'));
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/* ---------- /api/rankings (igual a app/api/rankings/route.ts) ---------- */
type RankingRow = { candidate_name: string; score: number; total: number; elapsed_seconds: number; finished_at: string };

async function getRanking(examId: string, limit = 100): Promise<RankingEntry[]> {
  const rows = await rpc<RankingRow[]>('get_ranking', { p_exam: examId, p_limit: limit });
  return rows.map((row, index) => ({
    position: index + 1,
    candidateName: row.candidate_name,
    score: row.score,
    total: row.total,
    elapsedSeconds: row.elapsed_seconds,
    finishedAt: row.finished_at,
  }));
}

async function rankingsRoute(url: URL) {
  const examId = normalizeExamId(url.searchParams.get('exam') ?? '');
  if (!examId) return json({ error: 'Simulado inválido.' }, 400);
  try {
    const ranking = await getRanking(examId);
    safeSet(RANKING_CACHE + examId, ranking);
    return json({ examId, ranking });
  } catch (cause) {
    if (!(cause instanceof OfflineError)) throw cause;
    // Banco fora: mostra o último ranking carregado + as provas feitas neste aparelho que ainda não foram enviadas.
    const cached = safeGet<RankingEntry[]>(RANKING_CACHE + examId, []);
    const local = readHistory().filter((item) => item.examId === examId && item.synced === false).map((item) => ({
      position: 0, candidateName: item.candidateName, score: item.score, total: item.total,
      elapsedSeconds: item.elapsedSeconds, finishedAt: item.finishedAt,
    }));
    const ranking = [...cached, ...local]
      .sort((a, b) => b.score - a.score || a.elapsedSeconds - b.elapsedSeconds || a.finishedAt.localeCompare(b.finishedAt))
      .slice(0, 100).map((entry, index) => ({ ...entry, position: index + 1 }));
    if (!ranking.length) throw new ApiError('Ranking temporariamente indisponível. Suas provas continuam sendo salvas neste aparelho.', 503);
    return json({ examId, ranking, offline: true });
  }
}

/* ---------- /api/progress (igual a app/api/progress/route.ts) ---------- */
const weekdayIndex: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const saoPauloDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
});
function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
function weekStartKey(date: Date) {
  const parts = Object.fromEntries(saoPauloDate.formatToParts(date).map((part) => [part.type, part.value]));
  const localDate = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  localDate.setUTCDate(localDate.getUTCDate() - (weekdayIndex[parts.weekday] ?? 0));
  return dateKey(localDate);
}
function weekEndKey(start: string) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return dateKey(date);
}
async function progressRoute(url: URL) {
  const rawName = url.searchParams.get('candidate') ?? '';
  const candidateName = rawName.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (candidateName.length < 2) return json({ error: 'Candidato inválido.' }, 400);
  // O servidor devolve a contagem de respostas válidas (mesma regra de countAnswers).
  let attempts: Array<{ candidate_name: string; answered: number; finished_at: string }>;
  try {
    attempts = await rpc<Array<{ candidate_name: string; answered: number; finished_at: string }>>(
      'candidate_attempts', { p_name: candidateName });
    // Inclui as provas deste aparelho que ainda aguardam envio ao ranking.
    for (const item of readHistory()) {
      if (item.synced === false && sameName(item.candidateName, candidateName)) {
        attempts.push({ candidate_name: item.candidateName, answered: Object.keys(sanitizeAnswers(item.answers)).length, finished_at: item.finishedAt });
      }
    }
  } catch (cause) {
    if (!(cause instanceof OfflineError)) throw cause;
    attempts = readHistory().filter((item) => sameName(item.candidateName, candidateName)).map((item) => ({
      candidate_name: item.candidateName, answered: Object.keys(sanitizeAnswers(item.answers)).length, finished_at: item.finishedAt,
    }));
  }
  const currentWeekStart = weekStartKey(new Date());
  const weeks = new Map<string, { startDate: string; endDate: string; questions: number; attempts: number }>();
  weeks.set(currentWeekStart, { startDate: currentWeekStart, endDate: weekEndKey(currentWeekStart), questions: 0, attempts: 0 });
  for (const attempt of attempts) {
    const startDate = weekStartKey(new Date(attempt.finished_at));
    const week = weeks.get(startDate) ?? { startDate, endDate: weekEndKey(startDate), questions: 0, attempts: 0 };
    week.questions += attempt.answered;
    week.attempts += 1;
    weeks.set(startDate, week);
  }
  return json({
    candidateName: attempts[0]?.candidate_name ?? candidateName,
    currentWeekStart,
    weeks: [...weeks.values()].sort((left, right) => right.startDate.localeCompare(left.startDate)),
  });
}

/* ---------- /api/maranhao/eligibility ---------- */
async function eligibilityRoute(url: URL) {
  const exam = url.searchParams.get('exam') ?? '';
  const name = (url.searchParams.get('name') ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const info = getMaranhaoExamInfo(exam);
  if (!info || name.length < 2) return json({ error: 'Informe seu nome para verificar a sequência.' }, 400);
  const n = info.number;
  let allowed = !info.previousId;
  if (info.previousId) {
    const previousId = info.previousId;
    const doneHere = readHistory().some((item) => item.examId === previousId && sameName(item.candidateName, name) && item.synced !== 'rejected');
    try {
      allowed = doneHere || await rpc<boolean>('has_completed', { p_name: name, p_exam: previousId });
    } catch (cause) {
      if (!(cause instanceof OfflineError)) throw cause;
      allowed = true; // banco fora: não impede o estudo
    }
  }
  return json({ allowed, error: allowed ? null : `Conclua primeiro o Simulado ${n - 1} usando este mesmo nome.` });
}

/* ---------- /api/attempts/finish ---------- */
type StoredAttempt = {
  exam_id: string; candidate_name: string; score: number; total: number;
  elapsed_seconds: number; answers_json: string; finished_at: string; position: number | null;
};

async function finishRoute(init?: RequestInit) {
  let payload: { examId?: unknown; attemptKey?: unknown; candidateName?: unknown; elapsedSeconds?: unknown; answers?: unknown };
  try { payload = JSON.parse(String(init?.body ?? '')); } catch { return json({ error: 'Dados da prova inválidos.' }, 400); }
  const examId = normalizeExamId(typeof payload.examId === 'string' ? payload.examId : '');
  if (!examId) return json({ error: 'Não foi possível validar esta entrega.' }, 400);
  const attemptKey = typeof payload.attemptKey === 'string' ? payload.attemptKey : '';
  const candidateName = (typeof payload.candidateName === 'string' ? payload.candidateName : '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const elapsed = Number.isFinite(Number(payload.elapsedSeconds)) ? Math.floor(Number(payload.elapsedSeconds)) : null;
  let stored: StoredAttempt;
  try {
    stored = await rpc<StoredAttempt>('finish_attempt', {
      p_exam: examId,
      p_attempt_key: attemptKey,
      p_name: candidateName,
      p_elapsed: elapsed,
      p_answers: payload.answers ?? {},
    });
  } catch (cause) {
    if (!(cause instanceof OfflineError)) throw cause;
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(attemptKey) || candidateName.length < 2) throw new ApiError('Não foi possível validar esta entrega.');
    // Banco fora: corrige pelo gabarito, guarda no aparelho e envia ao ranking depois.
    const review = await loadReview(examId);
    const answers = sanitizeAnswers(payload.answers);
    const score = review.filter((item) => answers[String(item.n)] === item.g.toLowerCase()).length;
    const entry: LocalAttempt = { examId, attemptKey, candidateName, score, total: review.length,
      elapsedSeconds: Math.max(0, Math.min(18000, elapsed ?? 18000)), finishedAt: new Date().toISOString(), answers, synced: false };
    saveAttempt(entry);
    return json({ examId, candidateName, score, total: entry.total, elapsedSeconds: entry.elapsedSeconds,
      finishedAt: entry.finishedAt, position: null, answers, review, offline: true });
  }
  const review = await loadReview(examId);
  let answers: Record<string, string> = {};
  try { answers = JSON.parse(stored.answers_json); } catch { answers = {}; }
  saveAttempt({ examId, attemptKey, candidateName: stored.candidate_name, score: stored.score, total: stored.total,
    elapsedSeconds: stored.elapsed_seconds, finishedAt: stored.finished_at, answers, synced: true });
  return json({
    examId,
    candidateName: stored.candidate_name,
    score: stored.score,
    total: stored.total,
    elapsedSeconds: stored.elapsed_seconds,
    finishedAt: stored.finished_at,
    position: stored.position,
    answers,
    review,
  });
}

/* ---------- roteamento ---------- */
async function handle(url: URL, init?: RequestInit): Promise<Response> {
  try {
    if (url.pathname === '/api/rankings') return await rankingsRoute(url);
    if (url.pathname === '/api/progress') return await progressRoute(url);
    if (url.pathname === '/api/maranhao/eligibility') return await eligibilityRoute(url);
    if (url.pathname === '/api/attempts/finish' && (init?.method ?? 'GET').toUpperCase() === 'POST') return await finishRoute(init);
    return json({ error: 'Rota não encontrada.' }, 404);
  } catch (cause) {
    if (cause instanceof ApiError) return json({ error: cause.message }, cause.status);
    if (cause instanceof OfflineError) return json({ error: 'Servidor do ranking indisponível no momento. Tente novamente em instantes.' }, 503);
    return json({ error: 'Falha de comunicação com o servidor. Verifique sua conexão e tente novamente.' }, 503);
  }
}

export function installApi() {
  void MARANHAO_REVISION;
  try { importStoredResults(); } catch { /* ignora */ }
  window.setTimeout(() => void syncPending(), 3000);
  window.setInterval(() => void syncPending(), 60000);
  window.addEventListener('online', () => void syncPending());
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (raw.startsWith('/api/')) return handle(new URL(raw, window.location.origin), init);
    // Arquivos públicos pedidos com caminho absoluto (ex.: '/brain-anatomical.glb').
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    if (typeof input === 'string' && raw.startsWith('/') && !raw.startsWith(base + '/')) return nativeFetch(base + raw, init);
    return nativeFetch(input, init);
  };
}
