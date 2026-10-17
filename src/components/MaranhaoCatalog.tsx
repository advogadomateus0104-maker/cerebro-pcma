"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
import { useState } from 'react';
import { maranhaoAreas as areas } from '@/data/maranhao';
export default function MaranhaoCatalog() {
 const [selected, setSelected] = useState<number | null>(null);
 return <section className="sumulasCatalog" aria-label="Áreas do Direito">
  <div className="maAreas">{areas.map((area,index)=><button key={area.name} className={selected===index?'active':''} onClick={()=>setSelected(index)} aria-pressed={selected===index}><span>0{index+1}</span>{area.name}<b>→</b></button>)}</div>
  {selected!==null && <section className="sumulasCategory" aria-live="polite"><header><div><p className="eyebrow">Temporada Maranhão</p><h2>{areas[selected].name}</h2></div><p>{areas[selected].count>0?'Conclua o Simulado 1 para liberar o 2, e assim sucessivamente. Use o mesmo nome em todas as tentativas.':'Os simulados desta área serão adicionados em breve.'}</p></header>
   {areas[selected].count>0 && <div className="sumulasGrid">{Array.from({length:areas[selected].count},(_,index)=>{const n=index+1;const id=`${areas[selected].prefix}-0${n}`;return <article className="sumulasCard" key={id}><div className="cardTop"><span>{areas[selected].name}</span><small>{n===1?'Disponível':`Após o Simulado ${n-1}`}</small></div><strong>0{n}</strong><h3>Simulado {n}</h3><p>20 questões · duração de 5 horas · correção comentada</p><div className="cardActions"><a href={`/simulados/${id}`}>ABRIR SIMULADO</a><a className="rankLink" href={`/rankings/${id}`}>VER RANKING</a></div></article>})}</div>}
  </section>}
 </section>;
}
