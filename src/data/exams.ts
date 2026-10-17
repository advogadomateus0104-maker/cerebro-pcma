import type { PublicExam, ReviewItem } from './types';

// Copiado do original (data/exams.ts): mesma regra de normalização dos IDs.
export function normalizeExamId(value: string) {
  if (/^(?:map-0[1-4]|maadm-0[1-7]|macon-0[1-7]|maciv-0[1-5]|maamb-0[12]|macpc-0[1-3]|mapp-0[1-5]|sp-0[12]|spp-0[1-3]|rgp-0[1-3]|rgpp-01|jfp-0[12]|jfpp-0[1-4])$/.test(value)) return value;
  if (!/^(?:0?[1-6])$/.test(value)) return null;
  return String(Number.parseInt(value, 10)).padStart(2, '0');
}

const base = import.meta.env.BASE_URL;

// Questões públicas (sem gabarito/comentário), como em getPublicExam do original.
export async function loadPublicExam(id: string): Promise<PublicExam | null> {
  const examId = normalizeExamId(id);
  if (!examId) return null;
  const response = await fetch(`${base}data/${examId}.json`);
  if (!response.ok) return null;
  return response.json();
}

// Gabarito comentado, liberado apenas após a entrega.
export async function loadReview(id: string): Promise<ReviewItem[]> {
  const response = await fetch(`${base}review/${id}.json`);
  if (!response.ok) throw new Error('Não foi possível carregar a correção.');
  return response.json();
}
