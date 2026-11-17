import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { getAuthApiUrl } from './auth-api-url';
import { environment } from '../environments/environment';

export interface AuthUser {
  username: string;
  role: string;
  permissions: string[];
}

interface AuthResponse {
  authenticated?: boolean;
  user?: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = getAuthApiUrl();
  private currentUser: AuthUser | null = null;
  private sessionResolved = false;
  private localFirebaseBootstrap = false;

  constructor(private readonly http: HttpClient) { }

  get user(): AuthUser | null {
    return this.currentUser;
  }

  isFirebaseLoginEnabled(): boolean {
    return environment.enableFirebase;
  }

  isFirebaseBootstrapUser(user: AuthUser | null = this.currentUser): boolean {
    return !!user && user.role === 'firebaseBootstrap';
  }

  login(username: string, password: string): Observable<AuthUser> {
    if (!this.apiUrl) {
      return throwError(new Error('Authentication API URL is not configured for this deployment.'));
    }

    this.localFirebaseBootstrap = false;
    const request = this.isFirebaseLoginEnabled()
      ? this.http.post<AuthResponse>(`${this.apiUrl}/auth/firebase/login`, { username, password }, { withCredentials: true })
      : this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, { username, password }, { withCredentials: true });

    return request.pipe(
      map(response => {
        const user = response && response.user ? response.user : null;
        if (!user || (this.isFirebaseLoginEnabled() && response.authenticated === false)) {
          throw new Error('The authentication server returned an invalid login response.');
        }
        return user;
      }),
      tap(user => this.setSession(user))
    );
  }

  loginWithLocalFirebaseBootstrap(username: string, password: string): Observable<AuthUser> {
    if (!this.apiUrl) {
      return throwError(new Error('Authentication API URL is not configured for this deployment.'));
    }

    this.localFirebaseBootstrap = true;
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/firebase/bootstrap-login`, { username, password }, { withCredentials: true }).pipe(
      map(response => {
        const user = response && response.user ? response.user : null;
        if (!user) {
          throw new Error('The authentication server returned an invalid bootstrap login response.');
        }
        return user;
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

    const endpoint = this.localFirebaseBootstrap
      ? `${this.apiUrl}/auth/firebase/bootstrap-session`
      : `${this.apiUrl}/auth/session`;

    return this.http.get<AuthResponse>(endpoint, { withCredentials: true }).pipe(
      map(response => response && response.authenticated && response.user ? response.user : null),
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
    this.localFirebaseBootstrap = false;
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true });
  }

  private setSession(user: AuthUser | null): void {
    this.currentUser = user;
    this.sessionResolved = true;
  }
}
