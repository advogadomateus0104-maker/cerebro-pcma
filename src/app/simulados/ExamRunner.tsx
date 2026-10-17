'use client';
/* eslint-disable @next/next/no-html-link-for-pages, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MARANHAO_REVISION, getMaranhaoExamInfo } from '@/data/maranhao';
import type { PublicExam, ReviewItem } from '@/data/types';

type Phase = 'intro' | 'running' | 'submitting' | 'finished';
type FinishResult = {
  candidateName: string;
  score: number;
  total: number;
  elapsedSeconds: number;
  finishedAt: string;
  position: number | null;
  answers: Record<string, string>;
  review: ReviewItem[];
};

const letters = ['a', 'b', 'c', 'd', 'e'];

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = seconds % 60;
  return [h, m, s].map((value) => String(value).padStart(2, '0')).join(':');
}

export default function ExamRunner({ exam }: { exam: PublicExam }) {
  const isMaranhaoExam = Boolean(getMaranhaoExamInfo(exam.id));
  const [checkingSequence, setCheckingSequence] = useState(false);
  const isSumulasExam = exam.id.startsWith('sp-') || exam.id.startsWith('spp-');
  const isJurisprudenciaExam = exam.id.startsWith('rgp-') || exam.id.startsWith('rgpp-');
  const isFocusExam = exam.id.startsWith('jfp-') || exam.id.startsWith('jfpp-');
  const isSpecialExam = isMaranhaoExam || isSumulasExam || isJurisprudenciaExam || isFocusExam;
  const examNumber = Number.parseInt(exam.id.split('-').at(-1) ?? exam.id, 10);
  const displayNumber = String(examNumber).padStart(2, '0');
  const storageKey = isMaranhaoExam ? `cerebro-pcpr-exam-${exam.id}-${MARANHAO_REVISION}` : exam.id === '01'
    ? `cerebro-pcpr-exam-${exam.id}`
    : /^\d{2}$/.test(exam.id)
      ? `cerebro-pcpr-exam-${exam.id}-20260829`
      : isSumulasExam
        ? `cerebro-pcpr-exam-${exam.id}-20260913`
        : isJurisprudenciaExam
          ? `cerebro-pcpr-exam-${exam.id}-20260918`
          : `cerebro-pcpr-exam-${exam.id}-20260928`;
  const [phase, setPhase] = useState<Phase>('intro');
  const [candidateName, setCandidateName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [discarded, setDiscarded] = useState<Record<string, string[]>>({});
  const [attemptKey, setAttemptKey] = useState('');
  const [startedAt, setStartedAt] = useState(0);
  const [deadlineAt, setDeadlineAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(exam.durationSeconds);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [error, setError] = useState('');
  const finishing = useRef(false);
  const supportsElimination = exam.id !== '01';

  const answeredCount = Object.keys(answers).length;
  const progress = Math.round(answeredCount / exam.questions.length * 100);
  const reviewMap = useMemo(() => new Map(result?.review.map((item) => [item.n, item]) ?? []), [result]);
  const missedCount = reviewingMisses(answers, reviewMap);

  const persist = useCallback((value: object) => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [storageKey]);

  useEffect(() => {
    try {
      if (isMaranhaoExam) localStorage.removeItem(`cerebro-pcpr-exam-${exam.id}-20260928`);
      const preferredName = localStorage.getItem('cerebro-pcpr-candidate-name') ?? '';
      const stored = localStorage.getItem(storageKey);
      if (!stored) { setCandidateName(preferredName); return; }
      const data = JSON.parse(stored);
      setCandidateName(data.candidateName ?? preferredName);
      setAnswers(data.answers ?? {});
      setDiscarded(supportsElimination ? data.discarded ?? {} : {});
      setAttemptKey(data.attemptKey ?? '');
      setStartedAt(data.startedAt ?? 0);
      setDeadlineAt(data.deadlineAt ?? 0);
      if (data.phase === 'finished' && data.result) {
        setResult(data.result);
        setPhase('finished');
      } else if (data.phase === 'running' && data.deadlineAt) {
        setSecondsLeft(Math.max(0, Math.ceil((data.deadlineAt - Date.now()) / 1000)));
        setPhase('running');
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, supportsElimination, isMaranhaoExam, exam.id]);

  const submitAttempt = useCallback(async (automatic = false) => {
    if (finishing.current || !attemptKey || !candidateName) return;
    if (!automatic && !window.confirm('Encerrar e entregar a prova? Depois da entrega, as respostas não poderão ser alteradas.')) return;
    finishing.current = true;
    setPhase('submitting');
    setError('');
    const elapsedSeconds = Math.min(exam.durationSeconds, Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    try {
      const response = await fetch('/api/attempts/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: exam.id, attemptKey, candidateName, elapsedSeconds, answers }),
      });
      const payload = await response.json() as FinishResult & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Não foi possível entregar a prova.');
      const finalResult = payload as FinishResult;
      setAnswers(finalResult.answers);
      setResult(finalResult);
      setPhase('finished');
      setShowReview(false);
      persist({ phase: 'finished', candidateName, attemptKey, startedAt, deadlineAt, answers: finalResult.answers, discarded, result: finalResult });
      window.dispatchEvent(new Event('cerebro-progress-updated'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entregar a prova.');
      setPhase('running');
    } finally {
      finishing.current = false;
    }
  }, [answers, attemptKey, candidateName, deadlineAt, discarded, exam.durationSeconds, exam.id, persist, startedAt]);

  useEffect(() => {
    if (phase !== 'running') return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) void submitAttempt(true);
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [deadlineAt, phase, submitAttempt]);

  async function startExam() {
    const name = candidateName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) { setError('Informe seu nome para iniciar e participar do ranking.'); return; }
    if (isMaranhaoExam) {
      setCheckingSequence(true);
      setError('');
      try {
        const response = await fetch(`/api/maranhao/eligibility?exam=${exam.id}&name=${encodeURIComponent(name)}`, {cache:'no-store'});
        const payload = await response.json() as {allowed?: boolean; error?: string};
        if (!response.ok || !payload.allowed) { setError(payload.error ?? 'Não foi possível verificar a sequência.'); return; }
      } catch { setError('Não foi possível verificar a sequência. Tente novamente.'); return; }
      finally { setCheckingSequence(false); }
    }
    const now = Date.now();
    const key = isMaranhaoExam ? `${MARANHAO_REVISION}-${crypto.randomUUID()}` : crypto.randomUUID();
    const deadline = now + exam.durationSeconds * 1000;
    setCandidateName(name);
    setAttemptKey(key);
    setStartedAt(now);
    setDeadlineAt(deadline);
    setSecondsLeft(exam.durationSeconds);
    setAnswers({});
    setDiscarded({});
    setError('');
    setPhase('running');
    localStorage.setItem('cerebro-pcpr-candidate-name', name);
    persist({ phase: 'running', candidateName: name, attemptKey: key, startedAt: now, deadlineAt: deadline, answers: {}, discarded: {} });
  }

  function startNewAttempt() {
    if (!window.confirm('Iniciar uma nova tentativa? O resultado já entregue continuará registrado no ranking.')) return;
    localStorage.removeItem(storageKey);
    finishing.current = false;
    setPhase('intro');
    setAnswers({});
    setDiscarded({});
    setAttemptKey('');
    setStartedAt(0);
    setDeadlineAt(0);
    setSecondsLeft(exam.durationSeconds);
    setResult(null);
    setShowReview(false);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectAnswer(question: number, answer: string) {
    if (phase !== 'running') return;
    const next = { ...answers, [String(question)]: answer };
    const remaining = supportsElimination
      ? { ...discarded, [String(question)]: (discarded[String(question)] ?? []).filter((letter) => letter !== answer) }
      : discarded;
    setAnswers(next);
    if (supportsElimination) setDiscarded(remaining);
    persist({ phase: 'running', candidateName, attemptKey, startedAt, deadlineAt, answers: next, discarded: remaining });
  }

  function toggleDiscard(question: number, answer: string) {
    if (!supportsElimination || phase !== 'running') return;
    const key = String(question);
    const current = discarded[key] ?? [];
    const restoring = current.includes(answer);
    const nextLetters = restoring
      ? current.filter((letter) => letter !== answer)
      : [...current, answer];
    const nextDiscarded = { ...discarded, [key]: nextLetters };
    const nextAnswers = { ...answers };
    if (!restoring && nextAnswers[key] === answer) delete nextAnswers[key];
    setDiscarded(nextDiscarded);
    setAnswers(nextAnswers);
    persist({ phase: 'running', candidateName, attemptKey, startedAt, deadlineAt, answers: nextAnswers, discarded: nextDiscarded });
  }

  if (phase === 'intro') {
    return (
      <section className="examIntro">
        <a className="backLink" href={isMaranhaoExam ? '/jurisprudencia-em-foco-2' : isSumulasExam ? '/sumulas' : isJurisprudenciaExam ? '/jurisprudencia' : isFocusExam ? '/jurisprudencia-em-foco' : '/plataforma#temporada'}>← Voltar aos simulados</a>
        <div className="examIntroGrid">
          <div>
            <p className="eyebrow">{isMaranhaoExam ? 'Jurisprudência em Foco 2 · Temporada Maranhão' : isFocusExam ? 'Jurisprudência em foco · atuais para PCMA' : isSpecialExam ? (isSumulasExam ? 'Edição especial de súmulas' : 'Edição especial de jurisprudência') : 'Edição da temporada'}</p>
            <span className="giantNumber">{displayNumber}</span>
            <h1>Simulado {examNumber}</h1>
            <p className="examSubtitle">{exam.title.replace(/^Simulado\s+\d+\s+[—-]\s*/i, '')}</p>
          </div>
          <aside className="startPanel">
            <p className="eyebrow">Identificação do candidato</p>
            <label htmlFor="candidateName">Nome que aparecerá no ranking</label>
            <input id="candidateName" maxLength={40} value={candidateName} onChange={(event) => setCandidateName(event.target.value)} placeholder="Digite seu nome" />
            <div className="examRules"><span><b>{exam.questions.length}</b> questões</span><span><b>05:00</b> horas</span><span><b>Livre</b> novas tentativas</span></div>
            <p>O cronômetro não pausa. Cada tentativa possui uma entrega; depois de finalizá-la, você pode iniciar outra. O gabarito e os comentários só são liberados após a entrega.{supportsElimination ? ' Durante a prova, use o botão direito para riscar ou restaurar uma alternativa.' : ''}</p>
            {error && <p className="formError" role="alert">{error}</p>}
            <button className="primaryAction" onClick={startExam} disabled={checkingSequence}>{checkingSequence ? 'VERIFICANDO SEQUÊNCIA…' : 'INICIAR PROVA DE 5 HORAS'}</button>
          </aside>
        </div>
      </section>
    );
  }

  if ((phase === 'finished' || phase === 'submitting') && !showReview) {
    return (
      <section className="resultScreen">
        {phase === 'submitting' ? (
          <div className="resultPanel"><p className="eyebrow">Processando entrega</p><h1>Calculando seu resultado…</h1><p>Aguarde enquanto a prova é registrada no ranking.</p></div>
        ) : result && (
          <div className="resultPanel">
            <p className="eyebrow">Prova encerrada · Simulado {examNumber}</p>
            <span className="scoreNumber">{result.score}<small>/ {result.total}</small></span>
            <h1>{result.candidateName}, sua prova foi registrada.</h1>
            <div className="resultFacts"><span><b>{Math.round(result.score/result.total*100)}%</b> aproveitamento</span><span><b>{formatTime(result.elapsedSeconds)}</b> tempo utilizado</span><span><b>{result.position ? `${result.position}º` : '—'}</b> posição atual</span></div>
            <p>Agora o gabarito comentado está liberado. Você também pode iniciar outra tentativa; esta entrega continuará registrada no ranking.</p>
            <div className="resultActions">
              <button className="primaryAction" onClick={() => setShowReview(true)}>REVISAR SIMULADO</button>
              <a href={`/rankings/${exam.id}`}>VER RANKING</a>
              <button className="restartAction" onClick={startNewAttempt}>FAZER NOVA TENTATIVA</button>
            </div>
          </div>
        )}
      </section>
    );
  }

  const reviewing = phase === 'finished' && showReview;
  return (
    <div className="runnerShell">
      <header className="runnerBar">
        <div><span>Simulado {examNumber}</span><b>{reviewing ? 'REVISÃO LIBERADA' : formatTime(secondsLeft)}</b></div>
        <div className="runnerProgress"><i style={{ width: `${progress}%` }} /><span>{answeredCount}/{exam.questions.length} respondidas</span></div>
        {reviewing ? <button onClick={() => setShowReview(false)}>VOLTAR AO RESULTADO</button> : <button onClick={() => void submitAttempt(false)} disabled={phase === 'submitting'}>ENCERRAR PROVA</button>}
      </header>
      <div className="runnerLayout">
        <section className="questionList">
          {!reviewing && supportsElimination && <div className="eliminationHint"><b>Eliminação estratégica</b><span>Clique com o botão direito sobre uma alternativa para riscá-la. Clique novamente para restaurá-la.</span></div>}
          {reviewing && <div className="reviewNotice"><b>Gabarito comentado liberado</b><span>No mapa: verde indica acerto; vermelho indica erro ou questão em branco. Clique no número para ir direto à questão.</span></div>}
          {exam.questions.map((question) => {
            const selected = answers[String(question.n)];
            const review = reviewMap.get(question.n);
            return (
              <article className="questionCard" id={`questao-${question.n}`} key={question.n}>
                <header><span>Questão {question.n}</span>{question.sum && <small className="sumulaTag">{question.sum}</small>}<small>{question.lei}</small><small>{question.fmt}</small><small>{question.niv}</small></header>
                <div className="questionText" dangerouslySetInnerHTML={{ __html: question.en }} />
                <div className="alternatives">
                  {question.alt.map((alternative, index) => {
                    const letter = letters[index];
                    const isDiscarded = supportsElimination && (discarded[String(question.n)] ?? []).includes(letter);
                    const isCorrect = reviewing && review?.g === letter;
                    const isWrong = reviewing && selected === letter && review?.g !== letter;
                    return <button
                      key={letter}
                      className={`${selected === letter ? 'selected' : ''} ${isDiscarded && !reviewing ? 'discarded' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
                      onClick={() => selectAnswer(question.n, letter)}
                      onContextMenu={supportsElimination && !reviewing ? (event) => { event.preventDefault(); toggleDiscard(question.n, letter); } : undefined}
                      aria-pressed={selected === letter}
                      title={supportsElimination && !reviewing ? 'Clique para marcar · botão direito para riscar ou restaurar' : undefined}
                      disabled={reviewing}
                    ><b>{letter.toUpperCase()}</b><span>{alternative}</span>{isDiscarded && !reviewing && <em>RISCADA</em>}</button>;
                  })}
                </div>
                {reviewing && review && <div className="commentary"><strong>{selected === review.g ? '✓ Você acertou' : selected ? `✗ Você marcou ${selected.toUpperCase()} — correta: ${review.g.toUpperCase()}` : `— Em branco — correta: ${review.g.toUpperCase()}`}</strong><div dangerouslySetInnerHTML={{ __html: review.com }} /><p><b>Gabarito: {review.g.toUpperCase()}</b> · {review.inst}</p></div>}
              </article>
            );
          })}
          {!reviewing && <div className="finishBlock"><h2>Concluiu a prova?</h2><p>Ao encerrar, suas respostas serão bloqueadas e o resultado entrará no ranking.</p>{error && <p className="formError">{error}</p>}<button className="primaryAction" onClick={() => void submitAttempt(false)}>ENCERRAR E ENTREGAR PROVA</button></div>}
        </section>
        <aside className={`questionNav ${reviewing ? 'reviewMap' : ''}`}><p>Mapa da prova</p><div>{exam.questions.map((question) => {
          const selected = answers[String(question.n)];
          const correct = reviewMap.get(question.n)?.g;
          const status = reviewing ? (selected === correct ? 'correctAnswer' : 'wrongAnswer') : selected ? 'answered' : '';
          const label = reviewing
            ? selected === correct ? `Questão ${question.n}: correta` : selected ? `Questão ${question.n}: errada` : `Questão ${question.n}: em branco`
            : `Ir para a questão ${question.n}`;
          return <a className={status} href={`#questao-${question.n}`} aria-label={label} title={label} key={question.n}>{question.n}</a>;
        })}</div><span>{reviewing ? `${missedCount} para revisar · clique nos números vermelhos` : `${answeredCount} respondidas · ${exam.questions.length-answeredCount} em branco`}</span></aside>
      </div>
    </div>
  );
}

function reviewingMisses(answers: Record<string, string>, reviewMap: Map<number, ReviewItem>) {
  let misses = 0;
  for (const [number, review] of reviewMap) {
    if (answers[String(number)] !== review.g) misses += 1;
  }
  return misses;
}
