import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QuizResult } from '../../models/quiz-result';
import { QuizService } from '../../services/quiz.service';
import { TimerService } from '../../services/timer.service';

@Component({
  selector: 'app-quiz-result',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './quiz-result.component.html',
  styleUrl: './quiz-result.component.css'
})
export class QuizResultComponent implements OnInit {
  result: QuizResult | null = null;
  error = '';

  constructor(readonly quizService: QuizService, readonly timer: TimerService) { }

  async ngOnInit(): Promise<void> {
    try {
      await this.quizService.load();
      this.result = this.quizService.results[0] ?? null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load the quiz result.';
    }
  }

  get barStyle(): string {
    return `conic-gradient(#42a27c ${this.result?.percentage ?? 0}%, #e8edef 0)`;
  }

  get categoryRows(): { name: string; correct: number; total: number; percent: number }[] {
    if (!this.result) return [];
    return [{
      name: `${this.result.category} · ${this.result.subCategory || 'All subcategories'}`,
      correct: this.result.correct,
      total: this.result.totalQuestions,
      percent: this.result.percentage
    }];
  }
}
