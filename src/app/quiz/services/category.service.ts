import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, forkJoin, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { getAuthApiUrl } from '../../auth-api-url';
import { QuizCategory } from '../models/category';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly apiUrl = getAuthApiUrl();

  constructor(private readonly http: HttpClient) {}

  getCategories(): Observable<QuizCategory[]> {
    if (this.apiUrl) return this.http.get<QuizCategory[]>(`${this.apiUrl}/api/categories`);
    return forkJoin({
      files: this.http.get<Record<string, string[]>>('assets/data/subcategories.json'),
      names: this.http.get<string[]>('assets/data/categories.json')
    }).pipe(map(({ files, names }) => {
      if (!Array.isArray(names) || names.some(name => typeof name !== 'string' || !name.trim())) {
        throw new Error('The categories JSON file must contain non-empty category names.');
      }
      return names.map(name => {
        const subCategories = files[name];
        if (!Array.isArray(subCategories) ||
            subCategories.some(subCategory => typeof subCategory !== 'string' || !subCategory.trim())) {
          throw new Error(`The subcategories JSON file has an invalid entry for "${name}".`);
        }
        return { name, subCategories };
      });
    }));
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
}
