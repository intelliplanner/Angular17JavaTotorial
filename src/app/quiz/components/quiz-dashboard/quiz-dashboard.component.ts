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
      this.categories = this.questionService.categories;
      this.category = this.categories[0]?.name ?? '';
      this.updateSubcategory();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Could not load the quiz question bank.';
    } finally {
      this.loading = false;
    }
  }

  get subCategories(): string[] {
    return this.categories.find(item => item.name === this.category)?.subCategories ?? [];
  }

  get categoryLeaderboard(): { category: string; percentage: number; completedAt: string }[] {
    const bestByCategory = new Map<string, { category: string; percentage: number; completedAt: string }>();
    for (const result of this.quizService.results) {
      const current = bestByCategory.get(result.category);
      if (!current || result.percentage > current.percentage) {
        bestByCategory.set(result.category, {
          category: result.category,
          percentage: result.percentage,
          completedAt: result.completedAt
        });
      }
    }
    return [...bestByCategory.values()].sort((left, right) => right.percentage - left.percentage).slice(0, 5);
  }

  updateSubcategory(): void {
    this.subCategory = this.subCategories[0] ?? '';
    this.updateAvailability();
  }

  updateAvailability(): void {
    this.available = this.questionService.findQuestions(this.category, this.subCategory, this.difficulty).length;
  }

  startQuiz(): void {
    const questions = this.questionService.findQuestions(this.category, this.subCategory, this.difficulty);
    if (questions.length < this.questionCount) {
      this.errorMessage = `Only ${questions.length} questions match this selection. Add more questions or choose another selection.`;
      return;
    }
    this.errorMessage = '';
    this.quizService.start(questions, this.category, this.subCategory, this.difficulty, this.questionCount);
    this.router.navigateByUrl('/quiz/play');
  }

  resumeQuiz(): void {
    if (this.quizService.activeSession) this.router.navigateByUrl('/quiz/play');
  }
}
