import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

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

validationTriggered: boolean = false;

  newQuestion: any = {
    question: '',
    answerType: 'text',
    answer: ''
  };

 newQuestions: any[] = [
  { question: '', answerType: 'text', answer: '', subCategory: '', notification: '', notificationType: '' }
];

  ngOnInit(): void {
    this.loadQuestions();
  }

  private loadQuestions(): void {
    this.http.get<any[]>(`${environment.apiUrl}/assets/json_files/interview_question_answer.json`)
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
  generateUniqueId(): number {
    // If questions already have IDs, find max and increment
    const ids = this.questions.map(q => q.id).filter(id => typeof id === 'number');
    return ids.length ? Math.max(...ids) + 1 : 1;
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
      id: this.generateUniqueId(),   // <-- assign unique ID
      question: this.newQuestion.question.endsWith('?')
        ? this.newQuestion.question
        : this.newQuestion.question + '?',
      category: categoryToSave,
      subCategory: subCategoryToSave
    };

    this.http.post(`${environment.apiUrl}/saveQuestion`, payload)
      .subscribe({
        next: () => {
          this.questions.push(payload);
          this.notification = 'Question saved successfully!';
          this.notificationType = 'success';
          this.resetForm();
          this.loadQuestions();
        },
        error: () => {
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

  removeQuestion(index: number): void {
    this.newQuestions.splice(index, 1);
  }

  onAnswerTypeChange(q: any): void {
    if (q.answerType === 'text') {
      q.answer = '';
    } else if (q.answerType === 'table') {
      q.answer = [['']]; // start with one header row
    }
  }

  addRow(q: any): void {
    const cols = q.answer[0]?.length || 1;
    q.answer.push(Array(cols).fill(''));
  }

  addColumn(q: any): void {
    q.answer.forEach((row: string[]) => row.push(''));
  }

  deleteRow(q: any): void {
    if (q.answer.length > 1) {
      q.answer.pop();
    }
  }

  deleteColumn(q: any): void {
    const cols = q.answer[0]?.length || 0;
    if (cols > 1) {
      q.answer.forEach((row: string[]) => row.pop());
    }
  }

// Validate category (shared)
isCategoryValid(): boolean {
  if (!this.selectedCategory) {
    return false;
  }
  if (this.selectedCategory === 'Other') {
    return !!this.newCategory?.trim();
  }
  return true;
}


addNewQuestion(): void {
  this.validationTriggered = true; // enable validation messages
  const last = this.newQuestions[this.newQuestions.length - 1];

  if (!this.isQuestionValid(last)) {
    this.notification = '⚠️ Please complete the last question block before adding a new one!';
    this.notificationType = 'error';
    return;
  }

  this.newQuestions.push({ question: '', answerType: 'text', answer: '', subCategory: '', notification: '', notificationType: '' });
  this.notification = '';
  this.notificationType = '';
}



saveQuestions(): void {
   this.validationTriggered = true; // enable validation messages

  if (!this.isCategoryValid() || !this.allQuestionsValid()) {
    this.notification = '⚠️ Please fill all required fields before saving!';
    this.notificationType = 'error';
    return;
  }

  let allValid = true;
  this.newQuestions.forEach(q => {
    if (!this.isQuestionValid(q)) {
      allValid = false;
    }
  });

  if (!allValid) {
    this.notification = '⚠️ Please fix errors in each question before saving!';
    this.notificationType = 'error';
    return;
  }

  const categoryToSave = this.selectedCategory === 'Other' ? this.newCategory : this.selectedCategory;

  const payload = this.newQuestions.map(q => {
    const subCategoryToSave = q.subCategory === 'Other' ? q.newSubCategory : q.subCategory;
    return {
      ...q,
      category: categoryToSave,
      subCategory: subCategoryToSave
    };
  });

  payload.forEach(p => delete (p as any).newSubCategory);

  this.http.post(`${environment.apiUrl}/saveQuestionsBatch`, payload)
    .subscribe({
      next: () => {
        this.notification = '✅ All questions saved successfully!';
        this.notificationType = 'success';
        this.newQuestions = [{ question: '', answerType: 'text', answer: '', subCategory: '' }];
      },
      error: () => {
        this.notification = '❌ Failed to save questions!';
        this.notificationType = 'error';
      }
    });
}
isQuestionValid(q: any): boolean {
  if (!q) return false;

  const subCategoryValid = !!q.subCategory && (q.subCategory !== 'Other' || !!q.newSubCategory?.trim());
  const questionValid = !!q.question?.trim();
  const answerValid =
    q.answerType === 'text'
      ? !!q.answer?.trim()
      : Array.isArray(q.answer) &&
        q.answer.length > 0 &&
        q.answer.every((row: string[]) => row.every(cell => cell.trim().length > 0));

  if (!subCategoryValid) {
    q.notification = '⚠️ SubCategory is required!';
    q.notificationType = 'error';
    return false;
  }
  if (!questionValid) {
    q.notification = '⚠️ Question text is required!';
    q.notificationType = 'error';
    return false;
  }
  if (!answerValid) {
    q.notification = '⚠️ Answer is required!';
    q.notificationType = 'error';
    return false;
  }

  q.notification = '';
  q.notificationType = '';
  return true;
}


allQuestionsValid(): boolean {
  return this.newQuestions.every(q => {
    return this.validationTriggered ? this.isQuestionValid(q) : true;
  });
}

checkLastQuestionValid(): boolean {
  const last = this.newQuestions[this.newQuestions.length - 1];
  if (!last) return false;
  const subCategoryValid = !!last.subCategory && (last.subCategory !== 'Other' || !!last.newSubCategory?.trim());
  const questionValid = !!last.question?.trim();
  const answerValid = last.answerType === 'text'
    ? !!last.answer?.trim()
    : Array.isArray(last.answer) && last.answer.length > 0 && last.answer.every((row: string[]) => row.every(cell => cell.trim().length > 0));
  return subCategoryValid && questionValid && answerValid;
}


isSaveDisabled(): boolean {
  // Pure validity check, no notifications
  const allValid = this.newQuestions.every(q => this.checkQuestionValid(q));
  return !allValid || !this.isCategoryValid();
}

checkQuestionValid(q: any): boolean {
  if (!q) return false;

  const subCategoryValid = !!q.subCategory && (q.subCategory !== 'Other' || !!q.newSubCategory?.trim());
  const questionValid = !!q.question?.trim();
  const answerValid =
    q.answerType === 'text'
      ? !!q.answer?.trim()
      : Array.isArray(q.answer) &&
        q.answer.length > 0 &&
        q.answer.every((row: string[]) => row.every(cell => cell.trim().length > 0));

  return subCategoryValid && questionValid && answerValid;
}
}
