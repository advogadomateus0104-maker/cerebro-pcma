/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import WeeklyProgress from './WeeklyProgress';

export default function SiteHeader() {
  return (
    <>
      <header className="siteHeader">
        <a className="brandLink" href="/plataforma" aria-label="Voltar à página principal">
          <img src="/cerebro-3d.png" alt="" />
          <span>CÉREBRO PCMA<small>SIMULADOS</small></span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="/plataforma">Início</a>
          <a href="/plataforma#temporada">Simulados</a>
          <a href="/sumulas">Súmulas</a>
          <a href="/jurisprudencia">Jurisprudência</a>
          <a href="/jurisprudencia-em-foco">Em foco</a>
          <a href="/jurisprudencia-em-foco-2">Temporada Maranhão</a>
          <a href="/rankings/mapp-01">Rankings</a>
        </nav>
        <span className="seasonLive"><i /> Temporada ativa</span>
      </header>
      <WeeklyProgress />
    </>
  );
}

