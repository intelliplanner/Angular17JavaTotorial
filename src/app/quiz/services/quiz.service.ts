import { Injectable } from '@angular/core';
import { QuizAnswer, QuizDifficulty, QuizQuestion } from '../models/question';
import { QuizResult } from '../models/quiz-result';
import { StorageService } from './storage.service';

export interface QuizSession {
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  category: string;
  subCategory: string;
  difficulty: QuizDifficulty;
  durationSeconds: number;
  remainingSeconds: number;
  lastUpdatedAt: number;
}

const SESSION_KEY = 'interview-quiz.active-session.v1';
const RESULTS_KEY = 'interview-quiz.results.v1';

@Injectable({ providedIn: 'root' })
export class QuizService {
  constructor(private readonly storage: StorageService) { }

  get activeSession(): QuizSession | null {
    return this.storage.get<QuizSession | null>(SESSION_KEY, null);
  }

  get results(): QuizResult[] {
    return this.storage.get<QuizResult[]>(RESULTS_KEY, []);
  }

  start(questions: QuizQuestion[], category: string, subCategory: string, difficulty: QuizDifficulty, count = questions.length): void {
    const shuffled = this.shuffle([...questions]).slice(0, count).map(question => ({
      ...question,
      options: this.shuffle([...question.options])
    }));
    const durationSeconds = 30 * 60;
    this.saveSession({
      questions: shuffled,
      answers: shuffled.map(question => ({ questionId: question.id, selectedAnswer: null, markedForReview: false })),
      category,
      subCategory,
      difficulty,
      durationSeconds,
      remainingSeconds: durationSeconds,
      lastUpdatedAt: Date.now()
    });
  }

  updateAnswer(index: number, patch: Partial<QuizAnswer>): void {
    const session = this.activeSession;
    if (!session || !session.answers[index]) return;
    session.answers[index] = { ...session.answers[index], ...patch };
    this.saveSession(session);
  }

  setRemainingSeconds(seconds: number): void {
    const session = this.activeSession;
    if (session) this.saveSession({ ...session, remainingSeconds: seconds, lastUpdatedAt: Date.now() });
  }

  finish(): QuizResult | null {
    const session = this.activeSession;
    if (!session) return null;
    const correct = session.answers.filter((answer, index) =>
      answer.selectedAnswer === session.questions[index].correctAnswer
    ).length;
    const attempted = session.answers.filter(answer => answer.selectedAnswer !== null).length;
    const result: QuizResult = {
      id: `${Date.now()}`,
      category: session.category,
      subCategory: session.subCategory,
      difficulty: session.difficulty,
      totalQuestions: session.questions.length,
      attempted,
      correct,
      wrong: attempted - correct,
      score: correct,
      percentage: session.questions.length ? Math.round(correct / session.questions.length * 100) : 0,
      passed: session.questions.length > 0 && correct / session.questions.length >= 0.6,
      durationSeconds: session.durationSeconds - session.remainingSeconds,
      answers: session.answers,
      questions: session.questions,
      completedAt: new Date().toISOString()
    };
    this.storage.set(RESULTS_KEY, [result, ...this.results].slice(0, 50));
    this.storage.remove(SESSION_KEY);
    return result;
  }

  private saveSession(session: QuizSession): void {
    this.storage.set(SESSION_KEY, { ...session, lastUpdatedAt: Date.now() });
  }

  private shuffle<T>(items: T[]): T[] {
    for (let index = items.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [items[index], items[swap]] = [items[swap], items[index]];
    }
    return items;
  }
}
