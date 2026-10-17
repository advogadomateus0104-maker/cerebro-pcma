'use client';
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useState } from 'react';
import { getMaranhaoExamInfo } from '@/data/maranhao';
import type { RankingEntry } from '@/data/types';

function formatTime(totalSeconds:number) {
  const h=Math.floor(totalSeconds/3600),m=Math.floor(totalSeconds%3600/60),s=totalSeconds%60;
  return [h,m,s].map((value)=>String(value).padStart(2,'0')).join(':');
}

export default function RankingClient({ examId }: { examId: string }) {
  const maranhao = getMaranhaoExamInfo(examId);
  const isMaranhao = Boolean(maranhao);
  const isPenal = examId.startsWith('sp-');
  const isProcessualPenal = examId.startsWith('spp-');
  const isSumulas = isPenal || isProcessualPenal;
  const isJurisprudenciaPenal = examId.startsWith('rgp-');
  const isJurisprudenciaProcessual = examId.startsWith('rgpp-');
  const isJurisprudencia = isJurisprudenciaPenal || isJurisprudenciaProcessual;
  const isFocusPenal = examId.startsWith('jfp-');
  const isFocusProcessual = examId.startsWith('jfpp-');
  const isFocus = isFocusPenal || isFocusProcessual;
  const isSpecial = isMaranhao || isSumulas || isJurisprudencia || isFocus;
  const examNumber = Number.parseInt(examId.split('-').at(-1) ?? examId, 10);
  const category = isMaranhao ? `Temporada Maranhão · ${maranhao?.name}` : isProcessualPenal
    ? 'Súmulas Processuais Penais'
    : isPenal
      ? 'Súmulas Penais'
      : isJurisprudenciaProcessual
        ? 'Jurisprudência Processual Penal'
        : isJurisprudenciaPenal
          ? 'Jurisprudência Penal'
          : isFocusProcessual
            ? 'Jurisprudência em Foco · Processo Penal'
            : isFocusPenal
              ? 'Jurisprudência em Foco · Direito Penal'
          : '';
  const tabIds = isMaranhao ? maranhao!.ids : isPenal
    ? ['sp-01', 'sp-02']
    : isProcessualPenal
      ? ['spp-01', 'spp-02', 'spp-03']
      : isJurisprudenciaPenal
        ? ['rgp-01', 'rgp-02', 'rgp-03']
        : isJurisprudenciaProcessual
          ? ['rgpp-01']
          : isFocusPenal
            ? ['jfp-01', 'jfp-02']
            : isFocusProcessual
              ? ['jfpp-01', 'jfpp-02', 'jfpp-03', 'jfpp-04']
          : Array.from({length:6},(_,index)=>String(index+1).padStart(2,'0'));
  const [ranking,setRanking]=useState<RankingEntry[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    fetch(`/api/rankings?exam=${examId}`,{cache:'no-store'})
      .then(async(response)=>{const payload=await response.json() as {ranking: RankingEntry[]; error?: string};if(!response.ok)throw new Error(payload.error??'Falha ao carregar ranking.');return payload;})
      .then((payload)=>{if(active)setRanking(payload.ranking);})
      .catch((cause)=>{if(active)setError(cause instanceof Error?cause.message:'Falha ao carregar ranking.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false};
  },[examId]);

  return (
    <section className="rankingShell">
      <a className="backLink" href={isMaranhao ? '/jurisprudencia-em-foco-2' : isSumulas ? '/sumulas' : isJurisprudencia ? '/jurisprudencia' : isFocus ? '/jurisprudencia-em-foco' : '/plataforma#temporada'}>← Voltar aos simulados</a>
      <header className="rankingHero"><div><p className="eyebrow">{isSpecial ? category : 'Classificação da temporada'}</p><h1>Ranking<br /><em>Simulado {examNumber}</em></h1></div><p>Maior número de acertos em primeiro lugar. Em caso de empate, prevalece o menor tempo de prova.</p></header>
      <nav className={`rankingTabs ${isSpecial ? 'sumulasRankingTabs' : ''}`} aria-label="Rankings por simulado">{tabIds.map((id)=><a className={id===examId?'active':''} href={`/rankings/${id}`} key={id}>SIMULADO {String(Number.parseInt(id.split('-').at(-1) ?? id,10)).padStart(2,'0')}</a>)}</nav>
      {(examId === 'mapp-01' || examId === 'mapp-02') && <p className="reviewNotice">Este ranking inclui resultados preservados da versão anterior do simulado.</p>}
      <div className="rankingBoard">
        {loading && <p className="rankingEmpty">Carregando classificação…</p>}
        {error && <p className="formError">{error}</p>}
        {!loading&&!error&&ranking.length===0&&<div className="rankingEmpty"><b>A classificação ainda está vazia.</b><span>Os nomes aparecerão aqui depois que os candidatos encerrarem o Simulado {examNumber}.</span>{(isSpecial || examNumber<=2)&&<a href={`/simulados/${examId}`}>FAZER ESTE SIMULADO</a>}</div>}
        {ranking.length>0&&<div className="rankingTable" role="table" aria-label={`Ranking do Simulado ${examNumber}`}>
          <div className="rankingRow heading" role="row"><span>Posição</span><span>Candidato</span><span>Pontos</span><span>Tempo</span></div>
          {ranking.map((entry)=><div className={`rankingRow place${entry.position}`} role="row" key={`${entry.candidateName}-${entry.finishedAt}`}><span><b>{entry.position}º</b></span><span>{entry.candidateName}</span><span><b>{entry.score}</b>/{entry.total}</span><span>{formatTime(entry.elapsedSeconds)}</span></div>)}
        </div>}
      </div>
    </section>
  );
}
