import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-question-answer-panel',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './question-answer-panel.component.html',
  styleUrls: ['./question-answer-panel.component.css']
})
export class QuestionAnswerPanelComponent implements OnInit {

  constructor(private http: HttpClient) { }

  questions: any[] = [];
  categories: string[] = ['Other'];
  subCategories: string[] = ['Other'];

  selectedCategory: string = '';
  selectedSubCategory: string = '';

  newCategory: string = '';
  newSubCategory: string = '';

  notification: string = '';
  notificationType: 'success' | 'error' | '' = '';

  newQuestion: any = {
    question: '',
    answerType: 'text',
    answer: ''
  };

  ngOnInit(): void {
    this.loadQuestions();
  }

  private loadQuestions(): void {
    this.http.get<any[]>('/assets/json_files/interview_question_answer.json')
      .subscribe(data => {
        // Ensure data is an array
        this.questions = Array.isArray(data) ? data : [];

        const cats = new Set<string>();
        const subs = new Set<string>();

        this.questions.forEach(q => {
          if (q.category) cats.add(this.normalize(q.category));
          if (q.subCategory) subs.add(this.normalize(q.subCategory));
        });

        this.categories = Array.from(cats).sort();
        this.subCategories = Array.from(subs).sort();

        if (!this.categories.includes('Other')) this.categories.push('Other');
        if (!this.subCategories.includes('Other')) this.subCategories.push('Other');
      },
        error => {
          console.error('Failed to load questions', error);
          this.questions = []; // fallback
        });
  }


  normalize(value: string): string {
    return value.trim().replace(/_/g, ' ').replace(/\s+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  onAnswerTypeChange(): void {
    if (this.newQuestion.answerType === 'text') {
      this.newQuestion.answer = ''; // always a string
    } else if (this.newQuestion.answerType === 'table') {
      this.newQuestion.answer = [['']]; // always a 2D array
    }
  }


  addRow(): void {
    if (this.newQuestion.answerType === 'table' && Array.isArray(this.newQuestion.answer)) {
      const cols = this.newQuestion.answer[0]?.length || 1;
      const newRow = Array(cols).fill('');
      this.newQuestion.answer.push(newRow);
    }
  }

  addColumn(): void {
    if (this.newQuestion.answerType === 'table' && Array.isArray(this.newQuestion.answer)) {
      this.newQuestion.answer.forEach((row: string[]) => row.push(''));
    }
  }


  trackByIndex(index: number, item: any): number {
    return index;
  }

  validateFields(): boolean {
    const categoryValid: boolean = !!this.selectedCategory &&
      (this.selectedCategory !== 'Other' || this.newCategory.trim().length > 0);

    const subCategoryValid: boolean = !!this.selectedSubCategory &&
      (this.selectedSubCategory !== 'Other' || this.newSubCategory.trim().length > 0);

    const questionValid: boolean = this.newQuestion.question.trim().length > 0;

    const answerValid: boolean = this.newQuestion.answerType === 'text'
      ? this.newQuestion.answer.trim().length > 0
      : Array.isArray(this.newQuestion.answer) && this.newQuestion.answer.length > 0;

    return categoryValid && subCategoryValid && questionValid && answerValid;
  }

  saveQuestion(): void {
    if (!this.validateFields()) {
      this.notification = 'Please fill all required fields!';
      this.notificationType = 'error';
      return;
    }

    const categoryToSave = this.selectedCategory === 'Other' ? this.newCategory : this.selectedCategory;
    const subCategoryToSave = this.selectedSubCategory === 'Other' ? this.newSubCategory : this.selectedSubCategory;

    const payload = {
      ...this.newQuestion,
      question: this.newQuestion.question.endsWith('?')
        ? this.newQuestion.question
        : this.newQuestion.question + '?',
      category: categoryToSave,
      subCategory: subCategoryToSave
    };

    this.http.post('http://localhost:9090/saveQuestion', payload)
      .subscribe({
        next: (res: any) => {
          if (!Array.isArray(this.questions)) {
            this.questions = [];
          }
          this.questions.push(payload);
          this.notification = 'Question saved successfully!';
          this.notificationType = 'success';
          this.resetForm();
          this.loadQuestions(); // refresh categories/subcategories
        },
        error: (err) => {
          console.error('Failed to save question', err);
          this.notification = 'Failed to save question!';
          this.notificationType = 'error';
        }
      });

  }

  resetForm() {
    this.newQuestion = {
      question: '',
      answerType: 'text',
      answer: ''
    };
    this.selectedCategory = '';
    this.selectedSubCategory = '';
    this.newCategory = '';
    this.newSubCategory = '';
  }
}
