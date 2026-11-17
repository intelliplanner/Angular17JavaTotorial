import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { getAuthApiUrl } from './auth-api-url';
import { DataRecord, DataService } from './services/data.service';

export interface AuthUser {
  username: string;
  role: string;
  permissions: string[];
}

interface AuthResponse {
  authenticated: boolean;
  user: AuthUser;
  firebaseCustomToken?: string;
}

interface FirebaseSignInResponse {
  localId: string;
  idToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface FirebaseTokenRefreshResponse {
  user_id: string;
  id_token: string;
  refresh_token: string;
}

const FIREBASE_REFRESH_TOKEN_KEY = 'app.firebase.auth.refreshToken.v1';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = getAuthApiUrl();
  private currentUser: AuthUser | null = null;
  private sessionResolved = false;
  private firebaseSession = false;
  private firebaseRefreshTimer: number | undefined;

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

  login(username: string, password: string): Observable<AuthUser> {
    if (!this.apiUrl) {
      return throwError(new Error('Authentication API URL is not configured for this deployment.'));
    }

    const firebaseEnabled = this.dataService.isFirebaseEnabled();
    this.clearFirebaseSession();
    if (firebaseEnabled) {
      return this.http.post<FirebaseSignInResponse>(
        `${this.apiUrl}/auth/firebase/login`,
        { username, password },
        { withCredentials: true }
      ).pipe(
        map(response => {
          if (!response.localId || !response.idToken || !response.refreshToken ||
              !response.user?.username || !response.user.role ||
              !Array.isArray(response.user.permissions)) {
            throw new Error('Firebase Authentication returned an incomplete login response.');
          }
          return response;
        }),
        tap(response => {
          this.dataService.setFirebaseAuthToken(response.idToken);
          sessionStorage.setItem(FIREBASE_REFRESH_TOKEN_KEY, response.refreshToken);
          this.scheduleFirebaseTokenRefresh();
          this.setSession(response.user, true);
        }),
        map(response => response.user)
      );
    }

    return this.http.post<AuthResponse>(
      `${this.apiUrl}/auth/login`,
      { username, password, firebaseEnabled: false },
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

  loginWithLocalFirebaseBootstrap(username: string, password: string): Observable<AuthUser> {
    if (!this.dataService.isFirebaseEnabled()) {
      return throwError(new Error('Firebase must be enabled to use the one-time setup login.'));
    }
    if (!this.apiUrl) {
      return throwError(new Error('Firebase setup login API URL is not configured.'));
    }

    this.clearFirebaseSession();
    return this.http.post<AuthResponse>(
      `${this.apiUrl}/auth/firebase/bootstrap-login`,
      { username, password },
      { withCredentials: true }
    ).pipe(
      map(response => {
        if (!response.authenticated || !this.isFirebaseBootstrapUser(response.user)) {
          throw new Error('The authentication server returned an invalid setup login response.');
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
    if (this.dataService.isFirebaseEnabled()) {
      return this.restoreFirebaseSession();
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

  private restoreFirebaseSession(): Observable<AuthUser | null> {
    if (!this.apiUrl) {
      this.clearFirebaseSession();
      this.setSession(null);
      return of(null);
    }
    const refreshToken = sessionStorage.getItem(FIREBASE_REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      this.dataService.setFirebaseAuthToken(null);
      return this.restoreFirebaseBootstrapSession();
    }

    return this.dataService.getFirebaseConfig().pipe(
      switchMap(config => this.http.post<FirebaseTokenRefreshResponse>(
        `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`,
        `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
        { headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }) }
      )),
      switchMap(response => {
        if (!response.user_id || !response.id_token || !response.refresh_token) {
          return throwError(new Error('Firebase returned an incomplete session refresh response.'));
        }
        this.dataService.setFirebaseAuthToken(response.id_token);
        return this.http.get<AuthResponse>(`${this.apiUrl}/auth/session`, { withCredentials: true }).pipe(
          map(session => {
            if (!session.authenticated || !session.user) {
              throw new Error('The local user session is unavailable. Sign in again.');
            }
            return { user: session.user, refreshToken: response.refresh_token };
          })
        );
      }),
      tap(({ user, refreshToken: refreshedToken }) => {
        sessionStorage.setItem(FIREBASE_REFRESH_TOKEN_KEY, refreshedToken);
        this.setSession(user, true);
        this.scheduleFirebaseTokenRefresh();
      }),
      map(({ user }) => user),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 400 || error.status === 401) {
          this.clearFirebaseSession();
          this.setSession(null);
          return of(null);
        }
        return throwError(error);
      })
    );
  }

  private restoreFirebaseBootstrapSession(): Observable<AuthUser | null> {
    if (!this.apiUrl) {
      this.setSession(null);
      return of(null);
    }
    return this.http.get<AuthResponse>(
      `${this.apiUrl}/auth/firebase/bootstrap-session`,
      { withCredentials: true }
    ).pipe(
      map(response => response.authenticated && this.isFirebaseBootstrapUser(response.user)
        ? response.user
        : null),
      tap(user => this.setSession(user)),
      catchError((error: HttpErrorResponse) => {
        if ([401, 403, 404].includes(error.status)) {
          this.setSession(null);
          return of(null);
        }
        return throwError(error);
      })
    );
  }

  isFirebaseBootstrapUser(user: AuthUser | null = this.currentUser): boolean {
    return !!user &&
      user.role === 'firebaseBootstrap' &&
      Array.isArray(user.permissions) &&
      user.permissions.length === 1 &&
      user.permissions[0] === 'firebaseUserSetup';
  }

  hasPermission(permission: string, user: AuthUser | null = this.currentUser): boolean {
    return !!user && (user.permissions.includes('*') || user.permissions.includes(permission));
  }

  logout(): Observable<void> {
    if (this.firebaseSession) this.clearFirebaseSession();
    this.setSession(null);
    if (!this.apiUrl) {
      return throwError(new Error('Authentication API URL is not configured for this deployment.'));
    }
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true });
  }

  private clearFirebaseSession(): void {
    if (this.firebaseRefreshTimer !== undefined) {
      clearTimeout(this.firebaseRefreshTimer);
      this.firebaseRefreshTimer = undefined;
    }
    sessionStorage.removeItem(FIREBASE_REFRESH_TOKEN_KEY);
    sessionStorage.removeItem('app.firebase.auth.email.v1');
    this.dataService.setFirebaseAuthToken(null);
  }

  private scheduleFirebaseTokenRefresh(delay = 50 * 60 * 1000): void {
    if (this.firebaseRefreshTimer !== undefined) clearTimeout(this.firebaseRefreshTimer);
    this.firebaseRefreshTimer = window.setTimeout(() => {
      this.refreshFirebaseToken().subscribe({
        error: error => {
          if (error instanceof HttpErrorResponse && (error.status === 400 || error.status === 401)) {
            this.clearFirebaseSession();
            this.setSession(null);
            return;
          }
          console.error('Could not refresh the Firebase Authentication session.', error);
          this.scheduleFirebaseTokenRefresh(60_000);
        }
      });
    }, delay);
  }

  private refreshFirebaseToken(): Observable<void> {
    const refreshToken = sessionStorage.getItem(FIREBASE_REFRESH_TOKEN_KEY);
    if (!refreshToken) return throwError(new Error('Firebase refresh token is unavailable.'));

    return this.dataService.getFirebaseConfig().pipe(
      switchMap(config => this.http.post<FirebaseTokenRefreshResponse>(
        `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`,
        `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
        { headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }) }
      )),
      map(response => {
        if (!response.user_id || !response.id_token || !response.refresh_token) {
          throw new Error('Firebase returned an incomplete session refresh response.');
        }
        this.dataService.setFirebaseAuthToken(response.id_token);
        sessionStorage.setItem(FIREBASE_REFRESH_TOKEN_KEY, response.refresh_token);
        this.scheduleFirebaseTokenRefresh();
      })
    );
  }

  private setSession(user: AuthUser | null, authenticatedWithFirebase = false): void {
    this.currentUser = user;
    this.sessionResolved = true;
    this.firebaseSession = !!user && authenticatedWithFirebase;
    if (user && this.firebaseSession) {
      this.dataService.registerCurrentUserLogin(user.username).subscribe({
        error: error => console.error('Could not log the Firebase project sign-in:', error)
      });
    }
  }
}
