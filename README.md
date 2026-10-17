# CÉREBRO PCMA — Simulados

Cópia fiel do site original (ChatGPT Sites, versão 12, commit `ddebbe0`), migrada para **GitHub Pages + Supabase**.

## Onde fica cada coisa

| O quê | Arquivo |
|---|---|
| Questões (enunciado e alternativas) | `public/data/<id>.json` |
| Gabarito, comentário e fundamento | `public/review/<id>.json` |
| Visual (CSS original compilado, sem alteração) | `public/site.css` |
| Cérebro 3D (WebGL + modelo `.glb`) | `src/components/Brain3D.tsx`, `public/brain-anatomical.glb` |
| Páginas | `src/pages/*.tsx` (código original) |
| Prova (cronômetro, mapa, riscar alternativa, revisão) | `src/app/simulados/ExamRunner.tsx` (original) |
| Ranking | `src/app/rankings/RankingClient.tsx` (original) |
| Rotas e navegação | `src/main.tsx` |
| Ligação com o banco (substitui as rotas `/api/*` do Worker) | `src/api.ts` |
| Banco: tabelas, funções, gabaritos e rankings históricos | `supabase/schema.sql`, `supabase/dados.sql` |
| Endereço e chave pública do Supabase | `.env.production` |

## Regras preservadas do original
- Pontuação = número de acertos (calculada no servidor, pelo gabarito da tabela `gabaritos`).
- Ranking: todas as tentativas; maior número de acertos, depois menor tempo, depois data. Até 100 linhas.
- Temporada Maranhão: sequência obrigatória (Simulado N só após o N−1 com o mesmo nome) e revisão `ma20261016`.
- Cronômetro de 5 horas que não pausa; entrega automática ao zerar.
- Removidas as rotinas do original que apagavam rankings automaticamente.

## Como alterar
1. Editar os arquivos acima. Para um simulado novo: criar `public/data/<id>.json` e `public/review/<id>.json`, incluir o ID em `normalizeExamId` (`src/data/exams.ts`), cadastrá-lo nas páginas e inserir no banco as linhas em `exams` e `gabaritos`.
2. `git push` na branch `main`: o GitHub Actions compila e publica sozinho.

## Teste local
`npm ci && npm run build && npx vite preview`
