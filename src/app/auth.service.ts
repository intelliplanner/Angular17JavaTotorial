import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { getAuthApiUrl } from './auth-api-url';
import { DataService, FirebaseConfig } from './services/data.service';

export interface AuthUser {
  username: string;
  role: string;
  permissions: string[];
}

interface AuthResponse {
  authenticated?: boolean;
  user?: AuthUser;
  idToken?: string;
  refreshToken?: string;
  firebaseIdToken?: string;
  firebaseRefreshToken?: string;
}

interface FirebaseTokenRefreshResponse {
  id_token?: string;
  refresh_token?: string;
}

const FIREBASE_REFRESH_TOKEN_KEY = 'app.firebase.auth.refreshToken.v1';
const FIREBASE_TOKEN_REFRESH_DELAY = 55 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = getAuthApiUrl();
  private currentUser: AuthUser | null = null;
  private sessionResolved = false;
  private localFirebaseBootstrap = false;
  private firebaseRefreshTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly http: HttpClient,
    private readonly dataService: DataService
  ) { }

  get user(): AuthUser | null {
    return this.currentUser;
  }

  isFirebaseLoginEnabled(): boolean {
    return this.dataService.isFirebaseEnabled();
  }

  isFirebaseBootstrapUser(user: AuthUser | null = this.currentUser): boolean {
    return !!user && user.role === 'firebaseBootstrap';
  }

  login(username: string, password: string): Observable<AuthUser> {
    if (!this.apiUrl) {
      return throwError(new Error('Authentication API URL is not configured for this deployment.'));
    }

    this.localFirebaseBootstrap = false;
    const firebaseEnabled = this.isFirebaseLoginEnabled();
    const request = firebaseEnabled
      ? this.http.post<AuthResponse>(`${this.apiUrl}/auth/firebase/login`, { username, password }, { withCredentials: true })
      : this.http.post<AuthResponse>(
        `${this.apiUrl}/auth/login`,
        { username, password, firebaseEnabled: false },
        { withCredentials: true }
      );

    return request.pipe(
      map(response => {
        const user = response && response.user ? response.user : null;
        const idToken = response && (response.firebaseIdToken || response.idToken);
        const refreshToken = response && (response.firebaseRefreshToken || response.refreshToken);
        if (!user || (firebaseEnabled && (response.authenticated === false || !idToken || !refreshToken))) {
          if (firebaseEnabled) {
            throw new Error('The authentication server returned an incomplete login response.');
          }
          throw new Error('The authentication server returned an invalid login response.');
        }
        return { user, idToken, refreshToken };
      }),
      tap(({ user, idToken, refreshToken }) => {
        if (firebaseEnabled && idToken && refreshToken) {
          this.setFirebaseTokens(idToken, refreshToken);
        }
        this.setSession(user);
      }),
      map(({ user }) => user)
    );
  }

  loginWithLocalFirebaseBootstrap(username: string, password: string): Observable<AuthUser> {
    if (!this.apiUrl) {
      return throwError(new Error('Authentication API URL is not configured for this deployment.'));
    }

    this.localFirebaseBootstrap = true;
    this.clearFirebaseTokens();
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
      tap(user => {
        this.setSession(user);
        if (user && !this.isFirebaseBootstrapUser(user) && this.isFirebaseLoginEnabled() &&
            sessionStorage.getItem(FIREBASE_REFRESH_TOKEN_KEY)) {
          this.scheduleFirebaseRefresh();
        } else if (!user || this.isFirebaseBootstrapUser(user) || !this.isFirebaseLoginEnabled()) {
          this.clearFirebaseTokens();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.setSession(null);
          this.clearFirebaseTokens();
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
    this.clearFirebaseTokens();
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true });
  }

  private setFirebaseTokens(idToken: string, refreshToken: string): void {
    this.dataService.setFirebaseAuthToken(idToken);
    sessionStorage.setItem(FIREBASE_REFRESH_TOKEN_KEY, refreshToken);
    this.scheduleFirebaseRefresh();
  }

  private clearFirebaseTokens(): void {
    if (this.firebaseRefreshTimer !== undefined) {
      clearTimeout(this.firebaseRefreshTimer);
      this.firebaseRefreshTimer = undefined;
    }
    this.dataService.setFirebaseAuthToken(null);
    sessionStorage.removeItem(FIREBASE_REFRESH_TOKEN_KEY);
  }

  private scheduleFirebaseRefresh(): void {
    if (this.firebaseRefreshTimer !== undefined) {
      clearTimeout(this.firebaseRefreshTimer);
    }
    this.firebaseRefreshTimer = setTimeout(() => {
      this.firebaseRefreshTimer = undefined;
      this.refreshFirebaseIdToken().subscribe({
        error: error => {
          this.clearFirebaseTokens();
          console.error('Firebase authentication token refresh failed:', error);
        }
      });
    }, FIREBASE_TOKEN_REFRESH_DELAY);
  }

  private refreshFirebaseIdToken(): Observable<string> {
    const refreshToken = sessionStorage.getItem(FIREBASE_REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      return throwError(new Error('Firebase refresh token is unavailable.'));
    }

    return this.dataService.getFirebaseConfig().pipe(
      switchMap((config: FirebaseConfig) => this.http.post<FirebaseTokenRefreshResponse>(
        `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )),
      map(response => {
        if (!response.id_token || !response.refresh_token) {
          throw new Error('Firebase returned an incomplete token refresh response.');
        }
        this.setFirebaseTokens(response.id_token, response.refresh_token);
        return response.id_token;
      }),
      catchError(error => {
        this.clearFirebaseTokens();
        return throwError(error);
      })
    );
  }

  private setSession(user: AuthUser | null): void {
    this.currentUser = user;
    this.sessionResolved = true;
  }
}
