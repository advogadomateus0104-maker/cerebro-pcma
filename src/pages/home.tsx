/* eslint-disable @next/next/no-html-link-for-pages */
import Brain3D from '@/components/Brain3D';

export default function Home() {
  return (
    <main>
      <section className="portal">
        <div className="portalGrid" aria-hidden="true" />
        <div className="portalFrame" aria-hidden="true" />
        <div className="portalCopy">
          <p className="eyebrow">Temporada Maranhão · Delegado PCMA</p>
          <h1>CÉREBRO<br />PCMA <span>SIMULADOS</span></h1>
          <a className="goldButton" href="/plataforma">ENTRAR NA PLATAFORMA <span>→</span></a>
        </div>
        <div className="brainStage">
          <div className="brainAura" aria-hidden="true" />
          <div className="orbit orbitOne" aria-hidden="true" />
          <div className="orbit orbitTwo" aria-hidden="true" />
          <Brain3D />
          <span>ROTAÇÃO VOLUMÉTRICA</span>
        </div>
      </section>


    </main>
  );
}
