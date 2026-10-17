export type ExamQuestion = {
  n: number;
  sum?: string;
  lei: string;
  fmt: string;
  niv: string;
  inst: string;
  g: string;
  en: string;
  alt: string[];
  com: string;
};

export type FullExam = {
  id: string;
  title: string;
  durationSeconds: number;
  questions: ExamQuestion[];
};

export type PublicQuestion = Omit<ExamQuestion, 'g' | 'com'>;

export type PublicExam = {
  id: string;
  title: string;
  durationSeconds: number;
  questions: PublicQuestion[];
};

export type ReviewItem = {
  n: number;
  g: string;
  com: string;
  inst: string;
};

export type RankingEntry = {
  position: number;
  candidateName: string;
  score: number;
  total: number;
  elapsedSeconds: number;
  finishedAt: string;
};
