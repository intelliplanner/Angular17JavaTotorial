import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { getAuthApiUrl } from '../auth-api-url';
import { InterviewQuestion, Tutorial } from './content.models';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly apiUrl = getAuthApiUrl();

  constructor(private readonly http: HttpClient) {}

  getTutorials(includeDrafts = false): Observable<Tutorial[]> {
    if (includeDrafts) {
      if (!this.apiUrl) return this.getStaticTutorials();
      return this.http.get<Tutorial[]>(`${this.apiUrl}/api/admin/tutorials`, { withCredentials: true });
    }
    if (!this.apiUrl) return this.getStaticTutorials().pipe(map(items => items.filter(item => item.published)));
    return this.http.get<Tutorial[]>(`${this.apiUrl}/api/tutorials`);
  }

  createTutorial(tutorial: Partial<Tutorial>): Observable<Tutorial> {
    if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.post<Tutorial>(`${this.apiUrl}/api/tutorials`, tutorial, { withCredentials: true });
  }

  updateTutorial(id: string, tutorial: Partial<Tutorial>): Observable<Tutorial> {
    if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.put<Tutorial>(`${this.apiUrl}/api/tutorials/${encodeURIComponent(id)}`, tutorial, { withCredentials: true });
  }

  deleteTutorial(id: string): Observable<void> {
    if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.delete<void>(`${this.apiUrl}/api/tutorials/${encodeURIComponent(id)}`, { withCredentials: true });
  }

  getQuestions(): Observable<InterviewQuestion[]> {
    if (!this.apiUrl) return this.http.get<InterviewQuestion[]>('assets/data/questions-and-answers.json');
    return this.http.get<InterviewQuestion[]>(`${this.apiUrl}/api/questions`);
  }

  createQuestion(question: Partial<InterviewQuestion>): Observable<InterviewQuestion> {
    if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.post<InterviewQuestion>(`${this.apiUrl}/api/questions`, question, { withCredentials: true });
  }

  updateQuestion(id: string, question: Partial<InterviewQuestion>): Observable<InterviewQuestion> {
    if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.put<InterviewQuestion>(`${this.apiUrl}/api/questions/${encodeURIComponent(id)}`, question, { withCredentials: true });
  }

  deleteQuestion(id: string): Observable<void> {
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
