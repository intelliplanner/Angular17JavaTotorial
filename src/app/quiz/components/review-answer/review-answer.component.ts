import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QuizService } from '../../services/quiz.service';

@Component({
  selector: 'app-review-answer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './review-answer.component.html',
  styleUrl: './review-answer.component.css'
})
export class ReviewAnswerComponent {
  result = this.quizService.results[0] ?? null;
  index = 0;

  constructor(private readonly quizService: QuizService) { }

  get question() { return this.result?.questions[this.index]; }
  get answer() { return this.result?.answers[this.index]; }
  get isCorrect(): boolean { return !!this.question && this.answer?.selectedAnswer === this.question.correctAnswer; }
  move(offset: number): void {
    if (!this.result) return;
    this.index = Math.min(this.result.questions.length - 1, Math.max(0, this.index + offset));
  }
}
