import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface JavaVersion {
  label: string;
  value: string;
  path: string;
}

@Injectable({
  providedIn: 'root'
})
export class JavaVersionService {
  private javaVersions: JavaVersion[] = [];
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  loadJavaVersions(): Observable<JavaVersion[]> {
    return this.http.get<JavaVersion[]>(`${this.apiUrl}/java-versions`).pipe(
      tap(versions => {
        this.javaVersions = versions;
        console.log('Java versions loaded:', versions);
      }),
      catchError(error => {
        console.error('Failed to load Java versions:', error);
        // Return fallback versions
        const fallbackVersions: JavaVersion[] = [
          { label: 'Java 8 (jdk1.8.0_192)', value: 'jdk1.8.0_192', path: 'D:\\Software_Installed_Dir\\java\\jdk1.8.0_192' },
          { label: 'Java 21 (jdk-21.0.3)', value: 'jdk-21.0.3', path: 'D:\\Software_Installed_Dir\\java\\jdk-21.0.3' }
        ];
        this.javaVersions = fallbackVersions;
        return of(fallbackVersions);
      })
    );
  }

  getJavaVersions(): JavaVersion[] {
    return this.javaVersions;
  }

  getSelectedJavaPath(versionValue: string): string {
    const selected = this.javaVersions.find(v => v.value === versionValue);
    return selected ? selected.path : this.javaVersions[0]?.path || '';
  }
}