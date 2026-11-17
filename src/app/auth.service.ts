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
}
}
