import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { getAuthApiUrl } from '../auth-api-url';
import { DataRecord, DataService } from '../services/data.service';
if (includeDrafts) {
      if (!this.apiUrl) return this.getStaticTutorials();
      return this.http.get<Tutorial[]>(`${this.apiUrl}/api/admin/tutorials`, { withCredentials: true });
    }
    if (!this.apiUrl) return this.getStaticTutorials().pipe(map(items => items.filter(item => item.published)));
    return this.http.get<Tutorial[]>(`${this.apiUrl}/api/tutorials`);
  }

  createTutorial(tutorial: Partial<Tutorial>): Observable<Tutorial> {
    if (this.dataService.isFirebaseEnabled()) {
      const now = new Date().toISOString();
      const record = {
        ...tutorial,
        id: tutorial.id ?? crypto.randomUUID(),
        createdAt: tutorial.createdAt ?? now,
        updatedAt: now
      } as Tutorial & DataRecord;
      return this.dataService.create('tutorials', record);
    }
if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.put<Tutorial>(`${this.apiUrl}/api/tutorials/${encodeURIComponent(id)}`, tutorial, { withCredentials: true });
  }

  deleteTutorial(id: string): Observable<void> {
    if (this.dataService.isFirebaseEnabled()) return this.dataService.delete('tutorials', id);
if (!this.apiUrl) return this.http.get<InterviewQuestion[]>('assets/data/questions-and-answers.json');
    return this.http.get<InterviewQuestion[]>(`${this.apiUrl}/api/questions`);
  }

  createQuestion(question: Partial<InterviewQuestion>): Observable<InterviewQuestion> {
    if (this.dataService.isFirebaseEnabled()) {
      const record = {
        ...question,
        id: question.id ?? crypto.randomUUID(),
        createdAt: question.createdAt ?? new Date().toISOString()
      } as InterviewQuestion & DataRecord;
      return this.dataService.create('questions', record);
    }
if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.put<InterviewQuestion>(`${this.apiUrl}/api/questions/${encodeURIComponent(id)}`, question, { withCredentials: true });
  }

  deleteQuestion(id: string): Observable<void> {
    if (this.dataService.isFirebaseEnabled()) return this.dataService.delete('questions', id);
if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.delete<void>(`${this.apiUrl}/api/questions/${encodeURIComponent(id)}`, { withCredentials: true });
  }

  private getStaticTutorials(): Observable<Tutorial[]> {
    return this.http.get<Tutorial[]>('assets/data/tutorials.json');
  }

  private apiNotConfigured<T>(): Observable<T> {
    return throwError(new Error('Tutorial and question management requires a configured Node.js API URL.'));
  }
}
