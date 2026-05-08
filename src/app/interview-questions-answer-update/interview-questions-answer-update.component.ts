import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../../environments/environment.prod';

import { MatDialog } from '@angular/material/dialog';
import { EditQuestionDialogComponent } from '../edit-question-dialog/edit-question-dialog.component';

@Component({
  selector: 'app-interview-questions-answer-update',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './interview-questions-answer-update.component.html',
  styleUrls: ['./interview-questions-answer-update.component.css']
})
export class InterviewQuestionsAnswerUpdateComponent {
  questions: any[] = [];
  notification: string = '';
  notificationType: 'success' | 'error' | '' = '';

  constructor(private http: HttpClient, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.loadQuestions();
  }

  loadQuestions(): void {
    this.http.get<any[]>(`${environment.apiUrl}/assets/json_files/interview_question_answer.json`)
      .subscribe({
        next: data => this.questions = Array.isArray(data) ? data : [],
        error: err => {
          console.error('Failed to load questions', err);
          this.questions = [];
        }
      });
  }

  trackByIndex(index: number): number {
    return index;
  }

  /** ✅ Open Edit Dialog in Center */
  editQuestion(index: number): void {
    const q = this.questions[index];
    const dialogRef = this.dialog.open(EditQuestionDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      disableClose: true,
      autoFocus: true,
      position: { top: '', left: '' },   // ensures center
      data: {
        newQuestion: { ...q },
        categories: this.questions.map(q => q.category),
        subCategories: this.questions.map(q => q.subCategory),
        selectedCategory: q.category,
        selectedSubCategory: q.subCategory,
        newCategory: '',
        newSubCategory: ''
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.questions[index] = result.newQuestion;
        this.updateQuestionBackend(result.newQuestion);
      }
    });
  }

  /** ✅ Update by ID */
  updateQuestionBackend(payload: any): void {
    this.http.put(`${environment.apiUrl}/updateQuestion/${payload.id}`, payload)
      .subscribe({
        next: () => {
          this.notification = 'Question updated successfully!';
          this.notificationType = 'success';
        },
        error: () => {
          this.notification = 'Failed to update question!';
          this.notificationType = 'error';
        }
      });
  }

  /** ✅ Delete by ID */
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
}
