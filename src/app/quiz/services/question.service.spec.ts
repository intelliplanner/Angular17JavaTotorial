import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { QuizQuestion } from '../models/question';
import { QuestionService } from './question.service';
import { StorageService } from './storage.service';

describe('QuestionService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('loads and combines question files listed in the category manifest', async () => {
    const javaQuestion: QuizQuestion = {
      id: 1,
      category: 'Java',
      subCategory: 'Core Java',
      difficulty: 'Easy',
      question: 'Java question?',
      image: '',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      explanation: 'A is correct.'
    };
    const awsQuestion: QuizQuestion = {
      ...javaQuestion,
      id: 2,
      category: 'AWS',
      subCategory: 'EC2',
      question: 'AWS question?',
      correctAnswer: 'B'
    };
    const http = {
      get: jasmine.createSpy('get').and.callFake((url: string) => of(
        url.endsWith('question-files.json')
          ? { Java: 'java.json', AWS: 'aws.json' }
          : url.endsWith('/api/categories')
            ? [
              { name: 'Java', subCategories: ['Core Java'] },
              { name: 'AWS', subCategories: ['EC2'] }
            ]
          : url.endsWith('java.json') ? [javaQuestion] : [awsQuestion]
      ))
    };
    TestBed.configureTestingModule({
      providers: [
        QuestionService,
        StorageService,
        { provide: HttpClient, useValue: http }
      ]
    });
    const service = TestBed.inject(QuestionService);

    await service.load();

    expect(service.questions.map(question => question.category)).toEqual(['Java', 'AWS']);
    expect(service.questionFileCounts).toEqual([
      { category: 'Java', filename: 'java.json', count: 1 },
      { category: 'AWS', filename: 'aws.json', count: 1 }
    ]);
    expect(service.totalQuestionFileCount).toBe(2);
    expect(service.categories.map(category => category.name)).toEqual(['Java', 'AWS']);
    expect(http.get).toHaveBeenCalledTimes(4);
  });

  it('loads JSON file counts even when quiz questions have local edits', async () => {
    const storedQuestion: QuizQuestion = {
      id: 99,
      category: 'Java',
      subCategory: 'Core Java',
      difficulty: 'Easy',
      question: 'Locally edited question?',
      image: '',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      explanation: 'A is correct.'
    };
    localStorage.setItem('interview-quiz.questions.v1', JSON.stringify([storedQuestion]));
    const fileQuestion: QuizQuestion = { ...storedQuestion, id: 1, question: 'Bundled question?' };
    const http = {
      get: jasmine.createSpy('get').and.callFake((url: string) => of(
        url.endsWith('question-files.json')
          ? { Java: 'java.json' }
          : url.endsWith('/api/categories')
            ? [{ name: 'Java', subCategories: ['Core Java'] }]
          : [fileQuestion]
      ))
    };
    TestBed.configureTestingModule({
      providers: [
        QuestionService,
        StorageService,
        { provide: HttpClient, useValue: http }
      ]
    });
    const service = TestBed.inject(QuestionService);

    await service.load();

    expect(service.questions.map(question => question.id)).toEqual([99]);
    expect(service.questionFileCounts).toEqual([
      { category: 'Java', filename: 'java.json', count: 1 }
    ]);
  });
});
