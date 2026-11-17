import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { getAuthApiUrl } from '../../auth-api-url';
import { DataRecord, DataService } from '../../services/data.service';
import { QuizCategory } from '../models/category';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly apiUrl = getAuthApiUrl();

  constructor(
    private readonly http: HttpClient,
    private readonly dataService: DataService
  ) {}

  getCategories(): Observable<QuizCategory[]> {
    if (this.dataService.isFirebaseEnabled()) {
      return this.dataService.list<QuizCategory & DataRecord>('categories').pipe(
        map(categories => {
          this.validateCategories(categories);
          return categories;
        })
      );
    }
    if (this.apiUrl) return this.http.get<QuizCategory[]>(`${this.apiUrl}/api/categories`, { withCredentials: true });
    return this.http.get<QuizCategory[]>('assets/data/topic_categories.json').pipe(
      map(categories => {
        this.validateCategories(categories);
        return categories;
      })
    );
  }

  createCategory(category: QuizCategory): Observable<QuizCategory[]> {
    if (this.dataService.isFirebaseEnabled()) {
      const record = { ...category, id: category.name } as QuizCategory & DataRecord;
      return this.dataService.create('categories', record).pipe(
        switchMap(() => this.getCategories())
      );
    }
    if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.post<QuizCategory[]>(`${this.apiUrl}/api/categories`, category, { withCredentials: true });
  }

  updateCategory(previousName: string, category: QuizCategory): Observable<QuizCategory[]> {
    if (this.dataService.isFirebaseEnabled()) {
      const record = { ...category, id: category.name } as QuizCategory & DataRecord;
      return this.dataService.update('categories', previousName, record).pipe(
        switchMap(() => this.getCategories())
      );
    }
    if (!this.apiUrl) return this.apiNotConfigured();
    return this.http.put<QuizCategory[]>(
      `${this.apiUrl}/api/categories/${encodeURIComponent(previousName)}`,
      category,
      { withCredentials: true }
    );
  }

  deleteCategory(name: string): Observable<QuizCategory[]> {
    if (this.dataService.isFirebaseEnabled()) {
      return this.dataService.delete('categories', name).pipe(switchMap(() => this.getCategories()));
    }
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
