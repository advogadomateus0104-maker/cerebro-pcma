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

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const response = await nativeFetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message: string = payload?.message ?? 'Falha de comunicação com o servidor.';
    // Funções SQL sinalizam o status HTTP original no prefixo "409:" / "403:".
    const match = /^(\d{3}):\s*(.*)$/s.exec(message);
    if (match) throw new ApiError(match[2], Number(match[1]));
    throw new ApiError(message, response.status >= 500 ? 500 : 400);
  }
  return payload as T;
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
  const ranking = await getRanking(examId);
  return json({ examId, ranking });
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
  const attempts = await rpc<Array<{ candidate_name: string; answered: number; finished_at: string }>>(
    'candidate_attempts', { p_name: candidateName });
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
  const allowed = !info.previousId || await rpc<boolean>('has_completed', { p_name: name, p_exam: info.previousId });
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
  const stored = await rpc<StoredAttempt>('finish_attempt', {
    p_exam: examId,
    p_attempt_key: payload.attemptKey,
    p_name: payload.candidateName,
    p_elapsed: Number.isFinite(Number(payload.elapsedSeconds)) ? Math.floor(Number(payload.elapsedSeconds)) : null,
    p_answers: payload.answers ?? {},
  });
  const review = await loadReview(examId);
  let answers: Record<string, string> = {};
  try { answers = JSON.parse(stored.answers_json); } catch { answers = {}; }
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
    return json({ error: 'Falha de comunicação com o servidor. Verifique sua conexão e tente novamente.' }, 503);
  }
}

export function installApi() {
  void MARANHAO_REVISION;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (raw.startsWith('/api/')) return handle(new URL(raw, window.location.origin), init);
    // Arquivos públicos pedidos com caminho absoluto (ex.: '/brain-anatomical.glb').
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    if (typeof input === 'string' && raw.startsWith('/') && !raw.startsWith(base + '/')) return nativeFetch(base + raw, init);
    return nativeFetch(input, init);
  };
}
