import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { getAuthApiUrl } from './auth-api-url';

export interface AuthUser {
  username: string;
  role: string;
  permissions: string[];
}

interface AuthResponse {
  authenticated: boolean;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = getAuthApiUrl();
  private currentUser: AuthUser | null = null;
  private sessionResolved = false;

  constructor(private readonly http: HttpClient) { }

  get user(): AuthUser | null {
    return this.currentUser;
  }

  login(username: string, password: string): Observable<AuthUser> {
    if (!this.apiUrl) {
      return throwError(new Error('Authentication API URL is not configured for this deployment.'));
    }

    return this.http.post<AuthResponse>(
      `${this.apiUrl}/auth/login`,
      { username, password },
      { withCredentials: true }
    ).pipe(
      map(response => {
        if (!response.authenticated || !response.user) {
          throw new Error('The authentication server returned an invalid login response.');
        }
        return response.user;
      }),
      tap(user => this.setSession(user))
    );
  }

  getSession(): Observable<AuthUser | null> {
    if (this.sessionResolved) {
      return of(this.currentUser);
    }
    if (!this.apiUrl) {
      this.setSession(null);
      return of(null);
    }

    return this.http.get<AuthResponse>(`${this.apiUrl}/auth/session`, { withCredentials: true }).pipe(
      map(response => response.authenticated && response.user ? response.user : null),
      tap(user => this.setSession(user)),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.setSession(null);
          return of(null);
        }
        return throwError(error);
      })
    );
  }

  hasPermission(permission: string, user: AuthUser | null = this.currentUser): boolean {
    return !!user && (user.permissions.includes('*') || user.permissions.includes(permission));
  }

  logout(): Observable<void> {
    this.setSession(null);
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true });
  }

  private setSession(user: AuthUser | null): void {
    this.currentUser = user;
    this.sessionResolved = true;
  }
}
