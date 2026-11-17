import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { QuizCategory } from '../models/category';
import { QuizDifficulty, QuizQuestion } from '../models/question';
import { DataRecord, DataService } from '../../services/data.service';
) { }

  async load(): Promise<void> {
    if (this.questionsSubject.value.length) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      if (this.dataService.isFirebaseEnabled()) {
        const [storedQuestions, categories] = await Promise.all([
          this.dataService.list<DataRecord>('quizzes').toPromise(),
          this.categoryService.getCategories().toPromise()
        ]);
        const questions = (storedQuestions ?? []).map(item => ({ ...item, id: Number(item.id) })) as unknown as QuizQuestion[];
        this.validateQuestions(questions);
        this.questionsSubject.next(questions);
        this.questionFileCountsSubject.next((categories ?? []).map(category => ({
          category: category.name,
          filename: 'Firestore',
          count: questions.filter(question => question.category === category.name).length
        })));
        this.saveCategories(categories ?? []);
        return;
      }
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

  async renameCategory(previousName: string, category: QuizCategory): Promise<void> {
const changed = this.questions.map(question =>
      question.category === previousName
        ? { ...question, category: category.name,
          subCategory: category.subCategories.includes(question.subCategory)
            ? question.subCategory
            : category.subCategories[0] ?? question.subCategory }
        : question
    );
    await this.saveQuestions(changed);
    this.saveCategories(this.categories.map(item => item.name === previousName ? category : item));
  }

  private async saveQuestions(questions: QuizQuestion[]): Promise<void> {
    this.validateQuestions(questions);
    if (this.dataService.isFirebaseEnabled()) {
      const current = await this.dataService.list<DataRecord>('quizzes').toPromise() ?? [];
      const byId = new Map(current.map(record => [record.id, record]));
      const nextIds = new Set(questions.map(question => String(question.id)));
      for (const question of questions) {
        const record = { ...question, id: String(question.id) } as unknown as DataRecord;
        if (byId.has(record.id)) {
          await this.dataService.update<DataRecord>('quizzes', record.id, record).toPromise();
        } else {
          await this.dataService.create('quizzes', record).toPromise();
        }
      }
      for (const record of current) {
        if (!nextIds.has(record.id)) await this.dataService.delete('quizzes', record.id).toPromise();
      }
    } else {
      this.storage.set(QUESTION_KEY, questions);
    }
    this.questionsSubject.next(questions);
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
