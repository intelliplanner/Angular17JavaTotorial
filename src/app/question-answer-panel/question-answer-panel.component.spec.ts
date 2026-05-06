import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionAnswerPanelComponent } from './question-answer-panel.component';

describe('QuestionAnswerPanelComponent', () => {
  let component: QuestionAnswerPanelComponent;
  let fixture: ComponentFixture<QuestionAnswerPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionAnswerPanelComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(QuestionAnswerPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
