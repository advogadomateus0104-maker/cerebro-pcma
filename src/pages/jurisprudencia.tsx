/* eslint-disable @next/next/no-html-link-for-pages */
import SiteHeader from '@/components/SiteHeader';

const categories = [
  {
    id: 'penal',
    eyebrow: 'Direito Penal',
    title: 'Jurisprudência Penal',
    description: 'Três provas sobre teses firmadas em repercussão geral pelo STF e em recursos repetitivos pelo STJ.',
    exams: [
      { id: 'rgp-01', number: '01', weekday: 'Segunda-feira', date: '21 de setembro', questions: 32 },
      { id: 'rgp-02', number: '02', weekday: 'Terça-feira', date: '22 de setembro', questions: 32 },
      { id: 'rgp-03', number: '03', weekday: 'Quarta-feira', date: '23 de setembro', questions: 21 },
    ],
  },
  {
    id: 'processual-penal',
    eyebrow: 'Direito Processual Penal',
    title: 'Jurisprudência Processual Penal',
    description: 'Uma prova concentrada nas teses processuais penais dos Tribunais Superiores.',
    exams: [
      { id: 'rgpp-01', number: '01', weekday: 'Quinta-feira', date: '24 de setembro', questions: 61 },
    ],
  },
];

export default function JurisprudenciaPage() {
  return (
    <main className="sumulasPage jurisprudenciaPage">
      <SiteHeader />
      <section className="sumulasHero jurisprudenciaHero">
        <a className="backLink" href="/plataforma">← Voltar à página principal</a>
        <div className="sumulasHeroGrid">
          <div>
            <p className="eyebrow">Programação · 21 a 24 de setembro</p>
            <h1>Simulados de Jurisprudência <em>Repercussão Geral e Repetitivos</em></h1>
          </div>
          <p>Quatro provas com teses firmadas pelo STF e pelo STJ, mantendo o mesmo padrão de resolução, correção comentada e classificação individual.</p>
        </div>
        <div className="sumulasFacts"><span><b>04</b> simulados</span><span><b>146</b> questões</span><span><b>05:00</b> horas por prova</span></div>
      </section>

      <section className="sumulasCatalog" aria-label="Simulados de jurisprudência">
        {categories.map((category) => (
          <section className="sumulasCategory" id={category.id} key={category.id}>
            <header>
              <div><p className="eyebrow">{category.eyebrow}</p><h2>{category.title}</h2></div>
              <p>{category.description}</p>
            </header>
            <div className={`sumulasGrid ${category.exams.length === 1 ? 'oneColumn' : ''}`}>
              {category.exams.map((exam) => (
                <article className="sumulasCard" key={exam.id}>
                  <div className="cardTop"><span>Simulado {exam.number}</span><small>Disponível</small></div>
                  <strong>{exam.number}</strong>
                  <h3>{exam.weekday}</h3>
                  <p>{exam.date} de 2026 · {exam.questions} questões · duração de 5 horas</p>
                  <div className="cardActions">
                    <a href={`/simulados/${exam.id}`}>ABRIR SIMULADO</a>
                    <a className="rankLink" href={`/rankings/${exam.id}`}>VER RANKING</a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>
      <footer className="siteFooter"><span>© 2026 CÉREBRO PCMA · SIMULADOS</span><span>Repercussão Geral e Recursos Repetitivos</span></footer>
    </main>
  );
}
