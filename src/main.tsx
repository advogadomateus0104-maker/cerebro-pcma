/*
 * Ponto de entrada. Substitui o roteamento do Next.js por um roteador simples
 * baseado no endereço, mantendo as mesmas rotas do site original:
 *   /  /plataforma  /sumulas  /jurisprudencia  /jurisprudencia-em-foco
 *   /jurisprudencia-em-foco-2  /simulados/:id  /rankings/:id
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { installApi } from './api';
import { loadPublicExam, normalizeExamId } from './data/exams';
import type { PublicExam } from './data/types';
import SiteHeader from './components/SiteHeader';
import Home from './pages/home';
import PlataformaPage from './pages/plataforma';
import SumulasPage from './pages/sumulas';
import JurisprudenciaPage from './pages/jurisprudencia';
import JurisprudenciaEmFocoPage from './pages/jurisprudencia-em-foco';
import MaranhaoPage from './pages/jurisprudencia-em-foco-2';
import ExamRunner from './app/simulados/ExamRunner';
import RankingClient from './app/rankings/RankingClient';

installApi();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Converte um caminho do site original ("/plataforma") para o endereço publicado. */
function toPublished(path: string) {
  return path.startsWith(BASE + '/') || path === BASE ? path : BASE + path;
}

/** Caminho interno da rota atual, sem o prefixo de publicação. */
function currentRoute() {
  const path = window.location.pathname;
  const inner = path.startsWith(BASE) ? path.slice(BASE.length) : path;
  return (inner || '/').replace(/\/+$/, '') || '/';
}

/* Ajusta links e imagens com caminho absoluto ("/x") ao prefixo do GitHub Pages,
   sem alterar o código das telas originais. */
function fixUrls(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach((a) => {
    const href = a.getAttribute('href')!;
    const fixed = toPublished(href);
    if (fixed !== href) a.setAttribute('href', fixed);
  });
  root.querySelectorAll<HTMLImageElement>('img[src^="/"]').forEach((img) => {
    const src = img.getAttribute('src')!;
    const fixed = toPublished(src);
    if (fixed !== src) img.setAttribute('src', fixed);
  });
}
new MutationObserver(() => fixUrls(document)).observe(document.documentElement, {
  subtree: true, childList: true, attributes: true, attributeFilter: ['href', 'src'],
});

function navigate(href: string) {
  const url = new URL(href, window.location.href);
  const samePage = url.pathname === window.location.pathname;
  if (samePage && url.hash) {
    history.pushState(null, '', url.pathname + url.search + url.hash);
    document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  history.pushState(null, '', url.pathname + url.search + url.hash);
  window.dispatchEvent(new Event('cerebro-route'));
}

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element | null)?.closest?.('a');
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return;
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith(BASE + '/') && url.pathname !== BASE) return;
  event.preventDefault();
  navigate(url.href);
});

function NotFound() {
  return (
    <div style={{ fontFamily: 'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif', height: '100vh', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#000' }}>
      <div><h1 style={{ display: 'inline-block', margin: '0 20px 0 0', padding: '0 23px 0 0', fontSize: 24, fontWeight: 500, verticalAlign: 'top', lineHeight: '49px', borderRight: '1px solid rgba(255,255,255,.3)' }}>404</h1>
        <div style={{ display: 'inline-block' }}><h2 style={{ fontSize: 14, fontWeight: 400, lineHeight: '49px', margin: 0 }}>This page could not be found.</h2></div></div>
    </div>
  );
}

/* Equivalente a app/simulados/[id]/page.tsx: carrega a prova pública e abre o ExamRunner. */
function SimuladoPage({ id }: { id: string }) {
  const [exam, setExam] = useState<PublicExam | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    loadPublicExam(id).then((value) => { if (active) setExam(value); }).catch(() => { if (active) setExam(null); });
    return () => { active = false; };
  }, [id]);
  if (exam === null) return <NotFound />;
  return <main className="examPage"><SiteHeader />{exam && <ExamRunner exam={exam} />}</main>;
}

/* Equivalente a app/rankings/[id]/page.tsx */
function RankingPage({ id }: { id: string }) {
  const examId = normalizeExamId(id);
  if (!examId) return <NotFound />;
  return <main className="rankingPage"><SiteHeader /><RankingClient examId={examId} /></main>;
}

function resolve(route: string) {
  switch (route) {
    case '/': return <Home />;
    case '/plataforma': return <PlataformaPage />;
    case '/sumulas': return <SumulasPage />;
    case '/jurisprudencia': return <JurisprudenciaPage />;
    case '/jurisprudencia-em-foco': return <JurisprudenciaEmFocoPage />;
    case '/jurisprudencia-em-foco-2': return <MaranhaoPage />;
  }
  const simulado = /^\/simulados\/([^/]+)$/.exec(route);
  if (simulado) return <SimuladoPage key={route} id={decodeURIComponent(simulado[1])} />;
  const ranking = /^\/rankings\/([^/]+)$/.exec(route);
  if (ranking) return <RankingPage key={route} id={decodeURIComponent(ranking[1])} />;
  return <NotFound />;
}

function App() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const update = () => {
      setRoute(currentRoute());
      requestAnimationFrame(() => {
        const hash = window.location.hash.slice(1);
        if (hash) document.getElementById(decodeURIComponent(hash))?.scrollIntoView();
        else window.scrollTo(0, 0);
      });
    };
    window.addEventListener('popstate', update);
    window.addEventListener('cerebro-route', update);
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('cerebro-route', update); };
  }, []);
  return <div key={route} style={{ display: 'contents' }}>{resolve(route)}</div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
