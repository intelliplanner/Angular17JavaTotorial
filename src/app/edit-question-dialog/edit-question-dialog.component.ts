import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-question-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-question-dialog.component.html',
  styleUrls: ['./edit-question-dialog.component.css']
})
export class EditQuestionDialogComponent {
  categories: string[] = [];
  subCategories: string[] = [];

  constructor(
    public dialogRef: MatDialogRef<EditQuestionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    const cats = new Set<string>();
    const subs = new Set<string>();

    if (Array.isArray(data.categories)) {
      data.categories.forEach((cat: string) => cats.add(this.normalize(cat)));
    }
    if (Array.isArray(data.subCategories)) {
      data.subCategories.forEach((sub: string) => subs.add(this.normalize(sub)));
    }

    this.categories = Array.from(cats).sort();
    this.subCategories = Array.from(subs).sort();

    if (!this.categories.includes('Other')) {
      this.categories.push('Other');
    }
    if (!this.subCategories.includes('Other')) {
      this.subCategories.push('Other');
    }
  }

normalize(value: string): string {
    return value
      .trim()
      .replace(/\s+/g, ' ') // collapse multiple spaces
      .replace(/\b\w/g, c => c.toUpperCase()); // capitalize words
  }


  onAnswerTypeChange(): void {
    if (this.data.newQuestion.answerType === 'text') {
      this.data.newQuestion.answer = '';
    } else if (this.data.newQuestion.answerType === 'table') {
      this.data.newQuestion.answer = [['']];
    }
  }

  addRow(): void {
    const cols = this.data.newQuestion.answer[0]?.length || 1;
    this.data.newQuestion.answer.push(Array(cols).fill(''));
  }

  addColumn(): void {
    this.data.newQuestion.answer.forEach((row: string[]) => row.push(''));
  }

  deleteRow(): void {
    if (this.data.newQuestion.answer.length > 1) {
      this.data.newQuestion.answer.pop();
    }
  }

  deleteColumn(): void {
    const cols = this.data.newQuestion.answer[0]?.length || 0;
    if (cols > 1) {
      this.data.newQuestion.answer.forEach((row: string[]) => row.pop());
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.dialogRef.close(this.data);
  }
}
