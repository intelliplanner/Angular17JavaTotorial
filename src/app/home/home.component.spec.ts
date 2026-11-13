import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { QuestionService } from '../quiz/services/question.service';
import { QuizService } from '../quiz/services/quiz.service';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    const questionService = {
      load: jasmine.createSpy('load').and.returnValue(Promise.resolve()),
      categories: [],
      questions: [{
        category: 'Java',
        id: 1,
        subCategory: 'Core Java',
        difficulty: 'Easy',
        question: 'Sample question?',
        image: '',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        explanation: 'A is correct.'
      }]
    };

    spyOn(window, 'fetch').and.returnValue(Promise.resolve({
      ok: true,
      json: () => Promise.resolve([])
    } as Response));

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        { provide: QuestionService, useValue: questionService },
        { provide: QuizService, useValue: { activeSession: null, results: [] } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows the practice area and learning path cards', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Choose a practice area');
    expect(element.querySelectorAll('.catalog-card').length).toBe(6);
    expect(element.textContent).toContain('Learning paths');
    expect(element.querySelectorAll('.path-card').length).toBe(4);
  });

  it('shows question totals from the loaded question bank', () => {
    expect(fixture.nativeElement.textContent).toContain('1 questions');
    expect(component.getQuestionCount('Java')).toBe(1);
  });

  it('links learning paths to the learner-accessible Learn page', () => {
    expect(component.learningPaths.every(path => path.route === '/categorizedNotes' || path.route === '/quiz')).toBeTrue();
    expect(component.categoryCards.some(card => card.route === '/interview')).toBeFalse();
  });
});
