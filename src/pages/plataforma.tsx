/* eslint-disable @next/next/no-html-link-for-pages */
import SiteHeader from '@/components/SiteHeader';

export default function PlataformaPage() { return (<main>
      <div className="appShell" id="temporada">
        <SiteHeader />
        <section className="homeHero platformCatalog">
          <div>
            <a className="sumulasQuickLink" href="/sumulas"><span><b>NOVA ÁREA</b> · SEMANA DE 14 A 18 DE SETEMBRO</span><strong>Simulados de Súmulas</strong><small>Penais e Processuais Penais →</small></a>
            <a className="sumulasQuickLink" href="/jurisprudencia"><span><b>PRÓXIMA SEMANA</b> · 21 A 24 DE SETEMBRO</span><strong>Simulados de Jurisprudência</strong><small>Repercussão Geral e Recursos Repetitivos →</small></a>
            <a className="sumulasQuickLink focusQuickLink" href="/jurisprudencia-em-foco"><span><b>NOVA ÁREA</b> · 28 DE SETEMBRO A 3 DE OUTUBRO</span><strong>Jurisprudência em Foco</strong><small>Julgados atuais · seis simulados →</small></a>
            <a className="sumulasQuickLink focusQuickLink" href="/jurisprudencia-em-foco-2"><span><b>TEMPORADA MARANHÃO</b></span><strong>Jurisprudência em Foco 2 (Temporada Maranhão)</strong><small>Simulados organizados por área do Direito →</small></a>
          </div>
        </section>

        <footer className="siteFooter"><span>© 2026 CÉREBRO PCMA · SIMULADOS</span><span>Preparação independente para Delegado da Polícia Civil do Maranhão</span></footer>
      </div>
</main>); }
