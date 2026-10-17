/* eslint-disable @next/next/no-html-link-for-pages */
import SiteHeader from '@/components/SiteHeader';
import MaranhaoCatalog from '@/components/MaranhaoCatalog';
export default function MaranhaoPage() {
  return <main className="sumulasPage jurisprudenciaPage focusPage"><SiteHeader />
    <section className="sumulasHero jurisprudenciaHero">
      <a className="backLink" href="/plataforma">← Voltar à plataforma</a>
      <div className="sumulasHeroGrid"><div><p className="eyebrow">Jurisprudência em Foco 2 · Temporada Maranhão</p><h1>Simulado Jurisprudência em Foco <em>(Temporada Maranhão)</em></h1></div>
      <p>Escolha sua área. Faça os simulados em sequência, com tempo de prova, ranking e revisão comentada de todas as alternativas.</p></div>
    </section><MaranhaoCatalog />
    <footer className="siteFooter"><span>© 2026 CÉREBRO PCMA · SIMULADOS</span><span>Temporada Maranhão</span></footer>
  </main>;
}
