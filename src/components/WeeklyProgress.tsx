'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react';

type WeekProgress = {
  startDate: string;
  endDate: string;
  questions: number;
  attempts: number;
};

type ProgressPayload = {
  candidateName: string;
  currentWeekStart: string;
  weeks: WeekProgress[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(`${value}T12:00:00`))
    .replace('.', '');
}

function weekLabel(week: WeekProgress) {
  return `${formatDate(week.startDate)} a ${formatDate(week.endDate)}`;
}

export default function WeeklyProgress() {
  const [candidateName, setCandidateName] = useState('');
  const [payload, setPayload] = useState<ProgressPayload | null>(null);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    const name = localStorage.getItem('cerebro-pcpr-candidate-name')?.trim() ?? '';
    setCandidateName(name);
    if (name.length < 2) {
      setPayload(null);
      setSelectedWeek('');
      return;
    }
    setLoading(true);
    setError('');
    fetch(`/api/progress?candidate=${encodeURIComponent(name)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as ProgressPayload & {error?: string};
        if (!response.ok) throw new Error(data.error ?? 'Não foi possível carregar seu progresso.');
        return data as ProgressPayload;
      })
      .then((data) => {
        setPayload(data);
        setSelectedWeek((current) => current && data.weeks.some((week) => week.startDate === current)
          ? current
          : data.currentWeekStart);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível carregar seu progresso.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('cerebro-progress-updated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('cerebro-progress-updated', refresh);
    };
  }, [refresh]);

  const current = payload?.weeks.find((week) => week.startDate === payload.currentWeekStart) ?? null;
  const selected = useMemo(
    () => payload?.weeks.find((week) => week.startDate === selectedWeek) ?? current,
    [current, payload, selectedWeek],
  );

  return (
    <div className={`weeklyProgress ${open ? 'open' : ''}`}>
      <button className="weeklyProgressTrigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>Progresso semanal</span>
        {candidateName && current ? (
          <><strong>{current.questions}</strong><small>questões · {payload?.candidateName ?? candidateName}</small></>
        ) : (
          <><strong>—</strong><small>identifique-se em um simulado</small></>
        )}
      </button>
      {open && (
        <section className="weeklyProgressPanel" aria-label="Progresso semanal de questões">
          <header><div><span>Segunda a domingo</span><h2>Seu ritmo semanal</h2></div><button onClick={() => setOpen(false)} aria-label="Fechar progresso">×</button></header>
          {!candidateName && <p className="progressEmpty">Digite seu nome ao iniciar um simulado. Depois da entrega, suas questões aparecerão aqui.</p>}
          {candidateName && loading && <p className="progressEmpty">Atualizando seu progresso…</p>}
          {candidateName && error && <p className="progressError">{error}</p>}
          {candidateName && !loading && !error && selected && (
            <>
              <div className="progressCandidate"><span>Candidato</span><b>{payload?.candidateName ?? candidateName}</b></div>
              <div className="progressTotal"><span>{selected.startDate === payload?.currentWeekStart ? 'Esta semana' : 'Semana selecionada'}</span><strong>{selected.questions}</strong><b>questões respondidas</b><small>{weekLabel(selected)} · {selected.attempts} {selected.attempts === 1 ? 'prova entregue' : 'provas entregues'}</small></div>
              <div className="progressHistory"><p>Histórico por semana</p>{payload?.weeks.map((week) => <button className={week.startDate === selected.startDate ? 'active' : ''} onClick={() => setSelectedWeek(week.startDate)} key={week.startDate}><span>{weekLabel(week)}</span><b>{week.questions} questões</b></button>)}</div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
