import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewQuestionsAnswerUpdateComponent } from './interview-questions-answer-update.component';

describe('InterviewQuestionsAnswerUpdateComponent', () => {
  let component: InterviewQuestionsAnswerUpdateComponent;
  let fixture: ComponentFixture<InterviewQuestionsAnswerUpdateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewQuestionsAnswerUpdateComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InterviewQuestionsAnswerUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
