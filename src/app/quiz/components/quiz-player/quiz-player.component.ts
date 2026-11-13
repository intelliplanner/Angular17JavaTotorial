import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { QuizAnswer } from '../../models/question';
import { QuizService, QuizSession } from '../../services/quiz.service';
import { TimerService } from '../../services/timer.service';

@Component({
  selector: 'app-quiz-player',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './quiz-player.component.html',
  styleUrl: './quiz-player.component.css'
})
export class QuizPlayerComponent implements OnInit, OnDestroy {
  session: QuizSession | null = null;
  index = 0;
  confirmSubmit = false;
  private timerSubscription?: Subscription;

  constructor(
    readonly quizService: QuizService,
    readonly timer: TimerService,
    private readonly router: Router
  ) { }

  ngOnInit(): void {
    this.session = this.quizService.activeSession;
    if (!this.session) {
      this.router.navigateByUrl('/quiz');
      return;
    }
    const elapsed = Math.floor((Date.now() - this.session.lastUpdatedAt) / 1000);
    if (elapsed > 0) {
      this.quizService.setRemainingSeconds(Math.max(0, this.session.remainingSeconds - elapsed));
      this.session = this.quizService.activeSession;
      if (this.session?.remainingSeconds === 0) {
        this.submit();
        return;
      }
    }
    this.timerSubscription = interval(1000).subscribe(() => {
      const current = this.quizService.activeSession;
      if (!current) return;
      const remaining = Math.max(0, current.remainingSeconds - 1);
      this.quizService.setRemainingSeconds(remaining);
      this.session = this.quizService.activeSession;
      if (remaining === 0) this.submit();
    });
  }

  ngOnDestroy(): void {
    this.timerSubscription?.unsubscribe();
  }

  get question() {
    return this.session?.questions[this.index];
  }

  get answer(): QuizAnswer | undefined {
    return this.session?.answers[this.index];
  }

  get progress(): number {
    return this.session ? ((this.index + 1) / this.session.questions.length) * 100 : 0;
  }

  get attemptedCount(): number {
    return this.session?.answers.filter(answer => answer.selectedAnswer !== null).length ?? 0;
  }

  selectAnswer(value: string): void {
    this.quizService.updateAnswer(this.index, { selectedAnswer: value });
    this.session = this.quizService.activeSession;
  }

  move(offset: number): void {
    if (!this.session) return;
    this.index = Math.min(this.session.questions.length - 1, Math.max(0, this.index + offset));
  }

  toggleReview(): void {
    if (!this.answer) return;
    this.quizService.updateAnswer(this.index, { markedForReview: !this.answer.markedForReview });
    this.session = this.quizService.activeSession;
  }

  goTo(index: number): void {
    this.index = index;
  }

  submit(): void {
    const result = this.quizService.finish();
    this.timerSubscription?.unsubscribe();
    if (result) this.router.navigateByUrl('/quiz/result');
  }
}
