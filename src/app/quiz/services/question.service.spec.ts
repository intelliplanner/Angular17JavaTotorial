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
    expect(http.get).toHaveBeenCalledTimes(3);
  });
});
