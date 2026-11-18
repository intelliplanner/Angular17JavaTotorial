import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { getAuthApiUrl } from './auth-api-url';
import { environment } from '../environments/environment';
import { DataService } from './services/data.service';

const FIREBASE_REFRESH_TOKEN_KEY = 'app.firebase.auth.refreshToken.v1';

export interface AuthUser {
  username: string;
  role: string;
  permissions: string[];
  uid?: string;
  email?: string;
  displayName?: string;
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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = getAuthApiUrl();
  private currentUser: AuthUser | null = null;
  private sessionResolved = false;
  private localFirebaseBootstrap = false;
  private firebaseRefreshTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly http: HttpClient,
    private readonly dataService: DataService
  ) { }

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
        if (this.isFirebaseLoginEnabled() && (!response.idToken || !response.refreshToken)) {
          throw new Error('The Firebase login response did not include authentication tokens.');
        }
        return response;
      }),
      tap(response => {
        if (this.isFirebaseLoginEnabled()) {
          this.setFirebaseTokens(response.idToken!, response.refreshToken!);
        } else {
          this.clearFirebaseTokens();
        }
        this.setSession(response.user!);
      }),
      map(response => response.user!)
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

  getGoogleSignInNonce(): Observable<string> {
    if (!this.apiUrl) {
      return throwError(new Error('Authentication API URL is not configured for this deployment.'));
    }

    return this.http.get<{ nonce?: string }>(`${this.apiUrl}/auth/google/nonce`, {
      withCredentials: true
    }).pipe(map(response => {
      if (!response || typeof response.nonce !== 'string' || !response.nonce) {
        throw new Error('The authentication server returned an invalid Google sign-in nonce.');
      }
      return response.nonce;
    }));
  }

  loginWithGoogle(credential: string, nonce: string): Observable<AuthUser> {
    if (!this.apiUrl) {
      return throwError(new Error('Authentication API URL is not configured for this deployment.'));
    }
    if (!credential || !nonce) {
      return throwError(new Error('Google sign-in credentials are incomplete.'));
    }

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/google/verify`, { credential, nonce }, {
      withCredentials: true
    }).pipe(
      map(response => {
        const user = response && response.user ? response.user : null;
        if (!response || response.authenticated !== true || !user) {
          throw new Error('The authentication server returned an invalid Google sign-in response.');
        }
        if (!user.uid) {
          throw new Error(
            'The authentication server did not return a Firebase UID. Deploy the updated backend to enable Google account provisioning.'
          );
        }
        if (!user.email) {
          throw new Error('The authentication server did not return the Google account email.');
        }
        if (!response.firebaseIdToken || !response.firebaseRefreshToken) {
          throw new Error('The authentication server did not return Firebase access tokens.');
        }
        return response;
      }),
      tap(response => {
        this.localFirebaseBootstrap = false;
        this.setFirebaseTokens(response.firebaseIdToken!, response.firebaseRefreshToken!);
        this.setSession(response.user!);
      }),
      map(response => response.user!)
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
      switchMap(response => {
        const user = response && response.authenticated && response.user ? response.user : null;
        if (!user) {
          this.clearFirebaseTokens();
          this.setSession(null);
          return of(null);
        }
        if (this.isFirebaseLoginEnabled() && sessionStorage.getItem(FIREBASE_REFRESH_TOKEN_KEY)) {
          return this.refreshFirebaseIdToken().pipe(
            map(() => user),
            tap(() => this.setSession(user))
          );
        }
        this.setSession(user);
        return of(user);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.clearFirebaseTokens();
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
    this.clearFirebaseTokens();
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true });
  }

  private setFirebaseTokens(idToken: string, refreshToken: string): void {
    this.dataService.setFirebaseAuthToken(idToken);
    sessionStorage.setItem(FIREBASE_REFRESH_TOKEN_KEY, refreshToken);
    this.scheduleFirebaseTokenRefresh();
  }

  private clearFirebaseTokens(): void {
    if (this.firebaseRefreshTimer) {
      clearTimeout(this.firebaseRefreshTimer);
      this.firebaseRefreshTimer = undefined;
    }
    this.dataService.setFirebaseAuthToken(null);
    sessionStorage.removeItem(FIREBASE_REFRESH_TOKEN_KEY);
  }

  private refreshFirebaseIdToken(): Observable<string> {
    const refreshToken = sessionStorage.getItem(FIREBASE_REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      return throwError(new Error('Firebase refresh token is unavailable. Sign in again.'));
    }

    return this.dataService.getFirebaseConfig().pipe(
      switchMap(config => this.http.post<FirebaseTokenRefreshResponse>(
        `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }).toString(),
        { headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }) }
      )),
      map(response => {
        if (!response.id_token || !response.refresh_token) {
          throw new Error('Firebase returned an incomplete token refresh response.');
        }
        return response;
      }),
      tap(response => {
        this.dataService.setFirebaseAuthToken(response.id_token!);
        sessionStorage.setItem(FIREBASE_REFRESH_TOKEN_KEY, response.refresh_token!);
        this.scheduleFirebaseTokenRefresh();
      }),
      map(response => response.id_token!)
    );
  }

  private scheduleFirebaseTokenRefresh(): void {
    if (this.firebaseRefreshTimer) {
      clearTimeout(this.firebaseRefreshTimer);
    }
    this.firebaseRefreshTimer = setTimeout(() => {
      this.firebaseRefreshTimer = undefined;
      this.refreshFirebaseIdToken().subscribe({
        error: error => console.error('Firebase authentication token refresh failed:', error)
      });
    }, 50 * 60 * 1000);
  }

  private setSession(user: AuthUser | null): void {
    this.currentUser = user;
    this.sessionResolved = true;
  }
}
