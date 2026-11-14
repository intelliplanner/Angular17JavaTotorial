import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { getAuthApiUrl } from '../../auth-api-url';
import { QuizCategory } from '../models/category';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly apiUrl = getAuthApiUrl();

  constructor(private readonly http: HttpClient) {}

  getCategories(): Observable<QuizCategory[]> {
    if (this.apiUrl) return this.http.get<QuizCategory[]>(`${this.apiUrl}/api/categories`);
    return this.http.get<QuizCategory[]>('assets/data/topic_categories.json').pipe(
      map(categories => {
        this.validateCategories(categories);
        return categories;
      })
    );
  }

  createCategory(category: QuizCategory): Observable<QuizCategory[]> {
    if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.post<QuizCategory[]>(`${this.apiUrl}/api/categories`, category, { withCredentials: true });
  }

  updateCategory(previousName: string, category: QuizCategory): Observable<QuizCategory[]> {
    if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.put<QuizCategory[]>(
      `${this.apiUrl}/api/categories/${encodeURIComponent(previousName)}`,
      category,
      { withCredentials: true }
    );
  }

  deleteCategory(name: string): Observable<QuizCategory[]> {
    if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.delete<QuizCategory[]>(
      `${this.apiUrl}/api/categories/${encodeURIComponent(name)}`,
      { withCredentials: true }
    );
  }

  private apiNotConfigured<T>(): Observable<T> {
    return throwError(new Error('Category changes require a configured Node.js API URL.'));
  }

  private validateCategories(value: unknown): asserts value is QuizCategory[] {
    if (!Array.isArray(value) || value.some(category =>
      !category || typeof category.name !== 'string' || !category.name.trim() ||
      !Array.isArray(category.subCategories) ||
      category.subCategories.some((subCategory: unknown) =>
        typeof subCategory !== 'string' || !subCategory.trim()
      ) ||
      new Set(category.subCategories.map((subCategory: string) => subCategory.toLowerCase())).size !==
        category.subCategories.length
    )) {
      throw new Error('The topic categories JSON file must contain categories with valid subcategory lists.');
    }
    if (new Set(value.map(category => category.name.toLowerCase())).size !== value.length) {
      throw new Error('Category names in the topic categories JSON file must be unique.');
    }
  }
}
