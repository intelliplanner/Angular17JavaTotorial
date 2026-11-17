import { Injectable } from '@angular/core';
import { DataRecord, DataService } from '../../services/data.service';
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
  private activeSessionValue: QuizSession | null = null;
  private resultsValue: QuizResult[] = [];
  private loaded = false;

  constructor(
    private readonly storage: StorageService,
    private readonly dataService: DataService
  ) { }

  async load(): Promise<void> {
    if (this.loaded) return;
    if (this.dataService.isFirebaseEnabled()) {
      const settings = await this.dataService.list<DataRecord>('userSettings').toPromise() ?? [];
      this.activeSessionValue = this.readSetting<QuizSession | null>(settings, SESSION_KEY, null);
      this.resultsValue = this.readSetting<QuizResult[]>(settings, RESULTS_KEY, []);
    } else {
      this.activeSessionValue = this.storage.get<QuizSession | null>(SESSION_KEY, null);
      this.resultsValue = this.storage.get<QuizResult[]>(RESULTS_KEY, []);
    }
    this.loaded = true;
  }

  get activeSession(): QuizSession | null {
    return this.activeSessionValue;
  }

  get results(): QuizResult[] {
    return this.resultsValue;
  }

  async start(questions: QuizQuestion[], category: string, subCategory: string, difficulty: QuizDifficulty, count = questions.length): Promise<void> {
    await this.load();
    const shuffled = this.shuffle([...questions]).slice(0, count).map(question => ({
      ...question,
      options: this.shuffle([...question.options])
    }));
    const durationSeconds = 30 * 60;
    await this.saveSession({
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

  async updateAnswer(index: number, patch: Partial<QuizAnswer>): Promise<void> {
    await this.load();
    const session = this.activeSession;
    if (!session || !session.answers[index]) return;
    session.answers[index] = { ...session.answers[index], ...patch };
    await this.saveSession(session);
  }

  async setRemainingSeconds(seconds: number): Promise<void> {
    await this.load();
    const session = this.activeSession;
    if (session) {
      const updated = { ...session, remainingSeconds: seconds, lastUpdatedAt: Date.now() };
      this.activeSessionValue = updated;
      if (!this.dataService.isFirebaseEnabled() || seconds % 15 === 0 || seconds === 0) {
        await this.persistSetting(SESSION_KEY, updated);
      }
    }
  }

  async finish(): Promise<QuizResult | null> {
    await this.load();
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
    this.resultsValue = [result, ...this.results].slice(0, 50);
    this.activeSessionValue = null;
    await this.persistSetting(RESULTS_KEY, this.resultsValue);
    await this.removeSetting(SESSION_KEY);
    return result;
  }

  private async saveSession(session: QuizSession): Promise<void> {
    const updated = { ...session, lastUpdatedAt: Date.now() };
    this.activeSessionValue = updated;
    await this.persistSetting(SESSION_KEY, updated);
  }

  private async persistSetting(key: string, value: unknown): Promise<void> {
    if (this.dataService.isFirebaseEnabled()) {
      await this.dataService.importJsonRecord('userSettings', { id: key, value }).toPromise();
    } else {
      this.storage.set(key, value);
    }
  }

  private async removeSetting(key: string): Promise<void> {
    if (this.dataService.isFirebaseEnabled()) {
      const settings = await this.dataService.list<DataRecord>('userSettings').toPromise() ?? [];
      if (settings.some(setting => setting.id === key)) {
        await this.dataService.delete('userSettings', key).toPromise();
      }
    } else {
      this.storage.remove(key);
    }
  }

  private readSetting<T>(settings: DataRecord[], key: string, fallback: T): T {
    const setting = settings.find(item => item.id === key);
    if (!setting || !('value' in setting)) return fallback;
    const value = setting['value'];
    if (typeof value !== 'string') return value as T;
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      throw new Error(`Saved quiz setting "${key}" is invalid JSON: ${String(error)}`);
    }
  }

  private shuffle<T>(items: T[]): T[] {
    for (let index = items.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [items[index], items[swap]] = [items[swap], items[index]];
    }
    return items;
  }
}
