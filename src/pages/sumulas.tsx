/* eslint-disable @next/next/no-html-link-for-pages */
import SiteHeader from '@/components/SiteHeader';

const categories = [
  {
    id: 'penal',
    eyebrow: 'Direito Penal',
    title: 'Súmulas Penais',
    description: 'Dois simulados concentrados nos enunciados sumulares com maior relevância penal.',
    exams: [
      { id: 'sp-01', number: '01', weekday: 'Segunda-feira', date: '14 de setembro', questions: 30 },
      { id: 'sp-02', number: '02', weekday: 'Terça-feira', date: '15 de setembro', questions: 42 },
    ],
  },
  {
    id: 'processual-penal',
    eyebrow: 'Direito Processual Penal',
    title: 'Súmulas Processuais Penais',
    description: 'Três provas sucessivas para consolidar a jurisprudência processual penal durante a semana.',
    exams: [
      { id: 'spp-01', number: '01', weekday: 'Quarta-feira', date: '16 de setembro', questions: 37 },
      { id: 'spp-02', number: '02', weekday: 'Quinta-feira', date: '17 de setembro', questions: 37 },
      { id: 'spp-03', number: '03', weekday: 'Sexta-feira', date: '18 de setembro', questions: 36 },
    ],
  },
];

export default function SumulasPage() {
  return (
    <main className="sumulasPage">
      <SiteHeader />
      <section className="sumulasHero">
        <a className="backLink" href="/plataforma">← Voltar à página principal</a>
        <div className="sumulasHeroGrid">
          <div>
            <p className="eyebrow">Semana especial · 14 a 18 de setembro</p>
            <h1>Simulados de Súmulas:<br /><em>Penais e Processuais Penais.</em></h1>
          </div>
          <p>Cinco dias de treinamento dirigido, com prova cronometrada, eliminação estratégica de alternativas, correção comentada e ranking independente em cada edição.</p>
        </div>
        <div className="sumulasFacts"><span><b>05</b> simulados</span><span><b>182</b> questões</span><span><b>05:00</b> horas por prova</span></div>
      </section>

      <section className="sumulasCatalog" aria-label="Simulados de súmulas">
        {categories.map((category) => (
          <section className="sumulasCategory" id={category.id} key={category.id}>
            <header>
              <div><p className="eyebrow">{category.eyebrow}</p><h2>{category.title}</h2></div>
              <p>{category.description}</p>
            </header>
            <div className={`sumulasGrid ${category.exams.length === 2 ? 'twoColumns' : ''}`}>
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
      <footer className="siteFooter"><span>© 2026 CÉREBRO PCMA · SIMULADOS</span><span>Súmulas Penais e Processuais Penais</span></footer>
    </main>
  );
}
