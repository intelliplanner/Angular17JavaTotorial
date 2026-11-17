import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { QuizAnswer } from '../../models/question';
import { QuizResult } from '../../models/quiz-result';
private timerSubscription?: Subscription;

  constructor(
    readonly quizService: QuizService,
    readonly timer: TimerService,
    private readonly router: Router
  ) { }

  async ngOnInit(): Promise<void> {
    try {
      await this.quizService.load();
    } catch (error) {
      this.saveError = error instanceof Error ? error.message : 'Could not load the saved quiz session.';
      return;
    }
this.session = this.quizService.activeSession;
    if (!this.session) {
      this.router.navigateByUrl('/quiz');
      return;
    }
    const elapsed = Math.floor((Date.now() - this.session.lastUpdatedAt) / 1000);
    if (elapsed > 0) {
      await this.quizService.setRemainingSeconds(Math.max(0, this.session.remainingSeconds - elapsed));
this.session = this.quizService.activeSession;
      if (this.session?.remainingSeconds === 0) {
        this.submit();
        return;
      }
    }
    this.timerSubscription = interval(1000).subscribe(async () => {
      const current = this.quizService.activeSession;
      if (!current) return;
      const remaining = Math.max(0, current.remainingSeconds - 1);
      try {
        await this.quizService.setRemainingSeconds(remaining);
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : 'Could not save the quiz timer.';
      }
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

  async selectAnswer(value: string): Promise<void> {
    try {
      await this.quizService.updateAnswer(this.index, { selectedAnswer: value });
      this.session = this.quizService.activeSession;
      this.saveError = '';
    } catch (error) {
      this.saveError = error instanceof Error ? error.message : 'Could not save this answer.';
    }
}

  move(offset: number): void {
    if (!this.session) return;
    this.index = Math.min(this.session.questions.length - 1, Math.max(0, this.index + offset));
  }

  async toggleReview(): Promise<void> {
    if (!this.answer) return;
    try {
      await this.quizService.updateAnswer(this.index, { markedForReview: !this.answer.markedForReview });
      this.session = this.quizService.activeSession;
      this.saveError = '';
    } catch (error) {
      this.saveError = error instanceof Error ? error.message : 'Could not save your review status.';
    }
}

  goTo(index: number): void {
    this.index = index;
  }

  async submit(): Promise<void> {
    if (this.submitting) return;
    this.submitting = true;
    let result: QuizResult | null;
    try {
      result = await this.quizService.finish();
    } catch (error) {
      this.saveError = error instanceof Error ? error.message : 'Could not save your quiz result.';
      this.submitting = false;
      return;
    }
    this.timerSubscription?.unsubscribe();
    if (result) this.router.navigateByUrl('/quiz/result');
    this.submitting = false;
}
}
