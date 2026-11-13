export type QuizDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface QuizQuestion {
  id: number;
  category: string;
  subCategory: string;
  difficulty: QuizDifficulty;
  question: string;
  image: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizAnswer {
  questionId: number;
  selectedAnswer: string | null;
  markedForReview: boolean;
}
