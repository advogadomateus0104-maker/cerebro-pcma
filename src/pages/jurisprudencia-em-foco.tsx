/* eslint-disable @next/next/no-html-link-for-pages */
import SiteHeader from '@/components/SiteHeader';

const categories = [
  {
    id: 'penal',
    eyebrow: 'Direito Penal',
    title: 'Jurisprudência Penal em Foco',
    description: 'Dois simulados com jurisprudência atual e direcionada à preparação para Delegado da PCMA.',
    exams: [
      { id: 'jfp-01', number: '01', weekday: 'Segunda-feira', date: '28 de setembro', questions: 96 },
      { id: 'jfp-02', number: '02', weekday: 'Terça-feira', date: '29 de setembro', questions: 95 },
    ],
  },
  {
    id: 'processual-penal',
    eyebrow: 'Direito Processual Penal',
    title: 'Jurisprudência Processual Penal em Foco',
    description: 'Quatro simulados sequenciais com julgados atuais de processo penal relevantes para a PCMA.',
    exams: [
      { id: 'jfpp-01', number: '01', weekday: 'Quarta-feira', date: '30 de setembro', questions: 62 },
      { id: 'jfpp-02', number: '02', weekday: 'Quinta-feira', date: '1º de outubro', questions: 62 },
      { id: 'jfpp-03', number: '03', weekday: 'Sexta-feira', date: '2 de outubro', questions: 62 },
      { id: 'jfpp-04', number: '04', weekday: 'Sábado', date: '3 de outubro', questions: 62 },
    ],
  },
];

export default function JurisprudenciaEmFocoPage() {
  return (
    <main className="sumulasPage jurisprudenciaPage focusPage">
      <SiteHeader />
      <section className="sumulasHero jurisprudenciaHero">
        <a className="backLink" href="/plataforma">← Voltar à página principal</a>
        <div className="sumulasHeroGrid">
          <div>
            <p className="eyebrow">Programação · 28 de setembro a 3 de outubro</p>
            <h1>Jurisprudência em Foco <em>Atuais para PCMA</em></h1>
          </div>
          <p>Seis provas de revisão intensiva, com correção comentada, mapa visual dos erros e ranking independente em cada edição.</p>
        </div>
        <div className="sumulasFacts"><span><b>06</b> simulados</span><span><b>439</b> questões</span><span><b>05:00</b> horas por prova</span></div>
      </section>

      <section className="sumulasCatalog" aria-label="Simulados de jurisprudência em foco">
        {categories.map((category) => (
          <section className="sumulasCategory" id={category.id} key={category.id}>
            <header>
              <div><p className="eyebrow">{category.eyebrow}</p><h2>{category.title}</h2></div>
              <p>{category.description}</p>
            </header>
            <div className={`sumulasGrid ${category.exams.length === 2 ? 'twoColumns' : 'fourColumns'}`}>
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
      <footer className="siteFooter"><span>© 2026 CÉREBRO PCMA · SIMULADOS</span><span>Jurisprudência atual direcionada à PCMA</span></footer>
    </main>
  );
}
