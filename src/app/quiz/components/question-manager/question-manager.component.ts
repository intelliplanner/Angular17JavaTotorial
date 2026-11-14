import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuizCategory } from '../../models/category';
import { QuizDifficulty, QuizQuestion } from '../../models/question';
import { QuestionFileCount, QuestionService } from '../../services/question.service';

@Component({
  selector: 'app-question-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './question-manager.component.html',
  styleUrl: './question-manager.component.css'
})
export class QuestionManagerComponent implements OnInit {
  readonly difficulties: QuizDifficulty[] = ['Easy', 'Medium', 'Hard'];
  categories: QuizCategory[] = [];
  questions: QuizQuestion[] = [];
  questionFileCounts: QuestionFileCount[] = [];
  totalQuestionFileCount = 0;
  search = '';
  categoryFilter = '';
  subCategoryFilter = '';
  difficultyFilter = '';
  message = '';
  error = '';
  editingId: number | null = null;
  previewId: number | null = null;
  draft: QuizQuestion = this.emptyQuestion();

  constructor(private readonly questionService: QuestionService) { }

  async ngOnInit(): Promise<void> {
    try {
      await this.questionService.load();
      this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not load question data.';
    }
  }

  get filteredQuestions(): QuizQuestion[] {
    const query = this.search.trim().toLowerCase();
    return this.questions.filter(question =>
      (!query || `${question.question} ${question.category} ${question.subCategory}`.toLowerCase().includes(query)) &&
      (!this.categoryFilter || question.category === this.categoryFilter) &&
      (!this.subCategoryFilter || question.subCategory === this.subCategoryFilter) &&
      (!this.difficultyFilter || question.difficulty === this.difficultyFilter)
    );
  }

  get subCategories(): string[] {
    return this.categories.find(item => item.name === this.categoryFilter)?.subCategories ?? [];
  }

  get draftSubCategories(): string[] {
    return this.categories.find(item => item.name === this.draft.category)?.subCategories ?? [];
  }

  newQuestion(): void {
    this.editingId = null;
    this.draft = this.emptyQuestion();
    this.error = '';
    this.message = '';
  }

  edit(question: QuizQuestion): void {
    this.editingId = question.id;
    this.draft = { ...question, options: [...question.options] };
    this.error = '';
    this.message = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  save(): void {
    const question: QuizQuestion = {
      ...this.draft,
      id: this.editingId ?? Date.now(),
      question: this.draft.question.trim(),
      options: this.draft.options.map(option => option.trim()),
      explanation: this.draft.explanation.trim()
    };
    if (!question.category || !question.subCategory || !question.question ||
        question.options.some(option => !option) ||
        new Set(question.options).size !== 4 ||
        !question.options.includes(question.correctAnswer)) {
      this.error = 'Complete all fields, provide four unique options, and choose one of those options as the correct answer.';
      return;
    }
    try {
      this.questionService.saveQuestion(question);
      this.refresh();
      this.message = this.editingId === null ? 'Question added.' : 'Question updated.';
      this.editingId = null;
      this.draft = this.emptyQuestion();
      this.error = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not save this question.';
    }
  }

  delete(question: QuizQuestion): void {
    if (!window.confirm(`Delete question "${question.question}"?`)) return;
    this.questionService.deleteQuestion(question.id);
    this.refresh();
    this.message = 'Question deleted.';
    if (this.editingId === question.id) this.newQuestion();
  }

  async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error('The imported JSON must be an array of questions.');
      this.questionService.importQuestions(parsed as QuizQuestion[]);
      this.refresh();
      this.message = `Imported ${parsed.length} question(s).`;
      this.error = '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Could not import question JSON.';
    } finally {
      input.value = '';
    }
  }

  exportJson(): void {
    this.download('questions.json', this.questions);
  }

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error = 'Choose an image file.';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.draft.image = typeof reader.result === 'string' ? reader.result : '';
      this.error = '';
    };
    reader.onerror = () => this.error = 'Could not read the selected image.';
    reader.readAsDataURL(file);
  }

  private refresh(): void {
    this.questions = this.questionService.questions;
    this.categories = this.questionService.categories;
    this.questionFileCounts = this.questionService.questionFileCounts;
    this.totalQuestionFileCount = this.questionService.totalQuestionFileCount;
    if (!this.draft.category && this.categories.length) {
      this.draft.category = this.categories[0].name;
      this.draft.subCategory = this.categories[0].subCategories[0] ?? '';
    }
  }

  private emptyQuestion(): QuizQuestion {
    return { id: 0, category: '', subCategory: '', difficulty: 'Medium', question: '', image: '', options: ['', '', '', ''], correctAnswer: '', explanation: '' };
  }

  private download(filename: string, value: unknown): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
