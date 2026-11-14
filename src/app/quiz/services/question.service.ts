import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { QuizCategory } from '../models/category';
import { QuizDifficulty, QuizQuestion } from '../models/question';
import { CategoryService } from './category.service';
import { StorageService } from './storage.service';

const QUESTION_KEY = 'interview-quiz.questions.v1';

export const DEFAULT_CATEGORIES: QuizCategory[] = [
  { name: 'Java', subCategories: ['Core Java', 'Collections', 'Multithreading', 'JVM', 'Garbage Collection', 'Streams', 'Java 8'] },
  { name: 'Database', subCategories: ['SQL', 'PL/SQL', 'Oracle', 'PostgreSQL', 'MySQL'] },
  { name: 'Spring Boot', subCategories: ['Core', 'Web', 'Security', 'Data', 'Actuator'] },
  { name: 'Microservices', subCategories: ['Architecture', 'Communication', 'Resilience', 'Discovery'] },
  { name: 'Kafka', subCategories: ['Topics', 'Partitions', 'Consumer Groups', 'Delivery Semantics'] },
  { name: 'Docker', subCategories: ['Images', 'Containers', 'Networking', 'Compose'] },
  { name: 'Kubernetes', subCategories: ['Pods', 'Services', 'Deployment', 'ConfigMap', 'Helm'] },
  { name: 'AWS', subCategories: ['EC2', 'S3', 'IAM', 'Lambda', 'VPC'] },
  { name: 'GCP', subCategories: ['GKE', 'Cloud Run', 'PubSub', 'BigQuery', 'GCS'] },
  { name: 'Angular', subCategories: ['Components', 'Routing', 'Signals', 'Forms'] },
  { name: 'React', subCategories: ['Components', 'Hooks', 'State', 'Rendering'] },
  { name: 'JavaScript', subCategories: ['Language', 'Async', 'DOM', 'ES Modules'] }
];

export interface QuestionFileCount {
  category: string;
  filename: string;
  count: number;
}

@Injectable({ providedIn: 'root' })
export class QuestionService {
  private readonly questionsSubject = new BehaviorSubject<QuizQuestion[]>([]);
  private readonly questionFileCountsSubject = new BehaviorSubject<QuestionFileCount[]>([]);
  private readonly categoriesSubject = new BehaviorSubject<QuizCategory[]>(DEFAULT_CATEGORIES);
  readonly questions$ = this.questionsSubject.asObservable();
  readonly categories$ = this.categoriesSubject.asObservable();
  private loading?: Promise<void>;

  constructor(
    private readonly http: HttpClient,
    private readonly storage: StorageService,
    private readonly categoryService: CategoryService
  ) { }

  async load(): Promise<void> {
    if (this.questionsSubject.value.length) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const saved = this.storage.get<QuizQuestion[] | null>(QUESTION_KEY, null);
      const { questions: fileQuestions, fileCounts, categories } = await this.loadCategoryFiles();
      const questions = saved ?? fileQuestions;
      this.validateQuestions(questions);
      this.questionsSubject.next(questions);
      this.questionFileCountsSubject.next(fileCounts);
      this.saveCategories(categories);
      if (!saved) this.storage.set(QUESTION_KEY, questions);
    })();
    try {
      await this.loading;
    } finally {
      this.loading = undefined;
    }
  }

  get questions(): QuizQuestion[] { return this.questionsSubject.value; }
  get categories(): QuizCategory[] { return this.categoriesSubject.value; }
  get questionFileCounts(): QuestionFileCount[] { return this.questionFileCountsSubject.value; }
  get totalQuestionFileCount(): number {
    return this.questionFileCounts.reduce((total, item) => total + item.count, 0);
  }

  findQuestions(category: string, subCategory: string, difficulty: QuizDifficulty): QuizQuestion[] {
    return this.questions.filter(question =>
      question.category === category &&
      (!subCategory || question.subCategory === subCategory) &&
      question.difficulty === difficulty
    );
  }

  saveQuestion(question: QuizQuestion): void {
    const updated = this.questions.filter(item => item.id !== question.id);
    updated.unshift(question);
    this.saveQuestions(updated);
  }

  deleteQuestion(id: number): void {
    this.saveQuestions(this.questions.filter(question => question.id !== id));
  }

  importQuestions(questions: QuizQuestion[]): void {
    this.validateQuestions(questions);
    const merged = new Map(this.questions.map(question => [question.id, question]));
    questions.forEach(question => merged.set(question.id, question));
    this.saveQuestions([...merged.values()]);
  }

  saveCategories(categories: QuizCategory[]): void {
    const names = new Set<string>();
    for (const category of categories) {
      const name = category.name.trim();
      if (!name || names.has(name.toLowerCase())) {
        throw new Error('Category names must be non-empty and unique.');
      }
      names.add(name.toLowerCase());
      category.name = name;
      category.subCategories = [...new Set(category.subCategories.map(item => item.trim()).filter(Boolean))];
    }
    this.categoriesSubject.next(categories);
  }

  renameCategory(previousName: string, category: QuizCategory): void {
    const changed = this.questions.map(question =>
      question.category === previousName
        ? { ...question, category: category.name,
          subCategory: category.subCategories.includes(question.subCategory)
            ? question.subCategory
            : category.subCategories[0] ?? question.subCategory }
        : question
    );
    this.saveQuestions(changed);
    this.saveCategories(this.categories.map(item => item.name === previousName ? category : item));
  }

  private saveQuestions(questions: QuizQuestion[]): void {
    this.validateQuestions(questions);
    this.questionsSubject.next(questions);
    this.storage.set(QUESTION_KEY, questions);
  }

  private async loadCategoryFiles(): Promise<{
    questions: QuizQuestion[];
    fileCounts: QuestionFileCount[];
    categories: QuizCategory[];
  }> {
    const categories = await this.categoryService.getCategories().toPromise();
    if (!Array.isArray(categories)) {
      throw new Error('The category configuration must contain a JSON array.');
    }
    const manifest = await this.http.get<Record<string, string>>('assets/data/question-files.json').toPromise();
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new Error('The question file manifest must be a category-to-filename object.');
    }

    const entries = Object.entries(manifest);
    const invalidEntry = entries.find(([category, filename]) =>
      !category.trim() ||
      typeof filename !== 'string' ||
      !/^[a-z0-9-]+\.json$/i.test(filename)
    );
    if (invalidEntry) {
      throw new Error(`Invalid question file entry for category "${invalidEntry[0]}".`);
    }

    const questionGroups = await Promise.all(entries.map(async ([category, filename]) => {
      const questions = await this.http.get<QuizQuestion[]>(`assets/data/${filename}`).toPromise();
      if (!Array.isArray(questions)) {
        throw new Error(`Question file "${filename}" must contain a JSON array.`);
      }
      this.validateQuestions(questions);
      if (questions.some(question => question.category !== category)) {
        throw new Error(`Question file "${filename}" contains a question assigned to another category.`);
      }
      return {
        questions,
        fileCount: { category, filename, count: questions.length }
      };
    }));

    return {
      questions: questionGroups.flatMap(group => group.questions),
      fileCounts: questionGroups.map(group => group.fileCount),
      categories
    };
  }

  private validateQuestions(value: unknown): asserts value is QuizQuestion[] {
    if (!Array.isArray(value) || value.some(question =>
      !Number.isInteger(question?.id) ||
      typeof question.category !== 'string' ||
      typeof question.subCategory !== 'string' ||
      typeof question.question !== 'string' ||
      !['Easy', 'Medium', 'Hard'].includes(question.difficulty) ||
      typeof question.image !== 'string' ||
      !Array.isArray(question.options) ||
      question.options.length !== 4 ||
      question.options.some((option: unknown) => typeof option !== 'string' || !option.trim()) ||
      new Set(question.options).size !== 4 ||
      typeof question.correctAnswer !== 'string' ||
      !question.options.includes(question.correctAnswer) ||
      typeof question.explanation !== 'string'
    )) {
      throw new Error('Invalid questions JSON. Each question needs an id, category, subcategory, four options, correct answer, and explanation.');
    }
  }
}
