import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-interview-questions-answer-update',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './interview-questions-answer-update.component.html',
  styleUrls: ['./interview-questions-answer-update.component.css']
})
export class InterviewQuestionsAnswerUpdateComponent {
  questions: any[] = [];
  categories: string[] = ['Other'];
  subCategories: string[] = ['Other'];

  editingIndex: number | null = null;
  editData: any = {};

  notification: string = '';
  notificationType: 'success' | 'error' | '' = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadQuestions();
  }

  loadQuestions(): void {
    this.http.get<any[]>(`${environment.apiUrl}/assets/json_files/interview_question_answer.json`)
      .subscribe({
        next: data => {
          this.questions = Array.isArray(data) ? data : [];

          // collect categories/subcategories
          const cats = new Set<string>();
          const subs = new Set<string>();
          this.questions.forEach(q => {
            if (q.category) cats.add(q.category);
            if (q.subCategory) subs.add(q.subCategory);
          });
          this.categories = Array.from(cats).sort();
          this.subCategories = Array.from(subs).sort();

          if (!this.categories.includes('Other')) this.categories.push('Other');
          if (!this.subCategories.includes('Other')) this.subCategories.push('Other');
        },
        error: err => {
          console.error('Failed to load questions', err);
          this.questions = [];
        }
      });
  }

  trackByIndex(index: number): number {
    return index;
  }

  /** Toggle accordion edit form */
  toggleEdit(index: number): void {
    if (this.editingIndex === index) {
      this.cancelEdit();
    } else {
      this.editingIndex = index;
      this.editData = { ...this.questions[index] };
    }
  }

  cancelEdit(): void {
    this.editingIndex = null;
    this.editData = {};
  }

  /** Update by ID */
  updateQuestion(): void {
    if (this.editingIndex === null) return;

    const payload = { ...this.editData };
    this.http.put(`${environment.apiUrl}/updateQuestion/${payload.id}`, payload)
      .subscribe({
        next: () => {
          this.questions[this.editingIndex!] = payload;
          this.notification = 'Question updated successfully!';
          this.notificationType = 'success';
          this.cancelEdit();
        },
        error: () => {
          this.notification = 'Failed to update question!';
          this.notificationType = 'error';
        }
      });
  }

  /** Delete by ID */
  deleteQuestion(index: number): void {
    const q = this.questions[index];
    if (confirm(`Delete question: "${q.question}"?`)) {
      this.http.delete(`${environment.apiUrl}/deleteQuestion/${q.id}`)
        .subscribe({
          next: () => {
            this.questions.splice(index, 1);
            this.notification = 'Question deleted successfully!';
            this.notificationType = 'success';
          },
          error: () => {
            this.notification = 'Failed to delete question!';
            this.notificationType = 'error';
          }
        });
    }
  }

  /** Answer type handling */
  onAnswerTypeChange(): void {
    if (this.editData.answerType === 'text') {
      this.editData.answer = '';
    } else if (this.editData.answerType === 'table') {
      this.editData.answer = [['']];
    }
  }

  addRow(): void {
    const cols = this.editData.answer[0]?.length || 1;
    this.editData.answer.push(Array(cols).fill(''));
  }

  addColumn(): void {
    this.editData.answer.forEach((row: string[]) => row.push(''));
  }

  deleteRow(): void {
    if (this.editData.answer.length > 1) {
      this.editData.answer.pop();
    }
  }

  deleteColumn(): void {
    const cols = this.editData.answer[0]?.length || 0;
    if (cols > 1) {
      this.editData.answer.forEach((row: string[]) => row.pop());
    }
  }
}
