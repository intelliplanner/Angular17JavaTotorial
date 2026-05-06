import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewQuestionAnswerCategorywiseComponent } from './interview-question-answer-categorywise.component';

describe('InterviewQuestionAnswerCategorywiseComponent', () => {
  let component: InterviewQuestionAnswerCategorywiseComponent;
  let fixture: ComponentFixture<InterviewQuestionAnswerCategorywiseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InterviewQuestionAnswerCategorywiseComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InterviewQuestionAnswerCategorywiseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
