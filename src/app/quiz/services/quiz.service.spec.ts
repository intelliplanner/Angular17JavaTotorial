import { QuizQuestion } from '../models/question';
import { QuizService } from './quiz.service';
import { StorageService } from './storage.service';

describe('QuizService', () => {
  let service: QuizService;
  const questions: QuizQuestion[] = [
    { id: 1, category: 'Java', subCategory: 'Core Java', difficulty: 'Easy', question: 'One?', image: '', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', explanation: 'A is correct.' },
    { id: 2, category: 'Java', subCategory: 'Core Java', difficulty: 'Easy', question: 'Two?', image: '', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B', explanation: 'B is correct.' }
  ];

  beforeEach(() => {
    localStorage.clear();
    service = new QuizService(new StorageService());
  });

  it('starts a randomized, resumable 30-minute session', () => {
    service.start(questions, 'Java', 'Core Java', 'Easy');

    expect(service.activeSession?.questions.length).toBe(2);
    expect(service.activeSession?.remainingSeconds).toBe(1800);
    expect(service.activeSession?.answers.length).toBe(2);
  });

  it('scores answers and persists the completed review', () => {
    service.start(questions, 'Java', 'Core Java', 'Easy');
    const session = service.activeSession!;
    session.questions.forEach((question, index) => {
      service.updateAnswer(index, { selectedAnswer: question.correctAnswer });
    });

    const result = service.finish();

    expect(result?.correct).toBe(2);
    expect(result?.attempted).toBe(2);
    expect(result?.percentage).toBe(100);
    expect(result?.questions.length).toBe(2);
    expect(service.activeSession).toBeNull();
    expect(service.results[0].id).toBe(result!.id);
  });
});
