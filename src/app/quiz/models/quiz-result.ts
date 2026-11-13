import { QuizAnswer, QuizQuestion } from './question';

export interface QuizResult {
  id: string;
  category: string;
  subCategory: string;
  difficulty: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  wrong: number;
  score: number;
  percentage: number;
  passed: boolean;
  durationSeconds: number;
  answers: QuizAnswer[];
  questions: QuizQuestion[];
  completedAt: string;
}
