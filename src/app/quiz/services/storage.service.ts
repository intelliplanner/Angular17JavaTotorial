import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StorageService {
  get<T>(key: string, fallback: T): T {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value) as T;
    } catch (error) {
      console.error(`Could not read quiz data "${key}" from local storage.`, error);
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Could not save quiz data "${key}" to local storage.`, error);
      throw error;
    }
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }
}
