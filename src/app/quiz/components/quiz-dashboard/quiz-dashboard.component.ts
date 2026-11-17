import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { QuizCategory } from '../../models/category';
import { QuizDifficulty } from '../../models/question';
import { QuestionService } from '../../services/question.service';
import { QuizService } from '../../services/quiz.service';

@Component({
  selector: 'app-quiz-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './quiz-dashboard.component.html',
  styleUrl: './quiz-dashboard.component.css'
})
export class QuizDashboardComponent implements OnInit {
  readonly questionCounts = [10, 15, 20];
  readonly difficulties: QuizDifficulty[] = ['Easy', 'Medium', 'Hard'];
  categories: QuizCategory[] = [];
  questionCount = 10;
  category = '';
  subCategory = '';
  difficulty: QuizDifficulty = 'Medium';
  available = 0;
  errorMessage = '';
  loading = true;

  constructor(
    private readonly questionService: QuestionService,
    readonly quizService: QuizService,
    private readonly router: Router
  ) { }

  async ngOnInit(): Promise<void> {
    try {
      await this.questionService.load();
      await this.quizService.load();
const questions = this.questionService.findQuestions(this.category, this.subCategory, this.difficulty);
    if (questions.length < this.questionCount) {
      this.errorMessage = `Only ${questions.length} questions match this selection. Add more questions or choose another selection.`;
      return;
    }
    this.errorMessage = '';
    try {
      await this.quizService.start(questions, this.category, this.subCategory, this.difficulty, this.questionCount);
      await this.router.navigateByUrl('/quiz/play');
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Could not save this quiz session.';
    }
}

  resumeQuiz(): void {
    if (this.quizService.activeSession) this.router.navigateByUrl('/quiz/play');
  }
}
