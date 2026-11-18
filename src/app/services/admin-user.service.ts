import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { getAuthApiUrl } from '../auth-api-url';
import { DataService } from './data.service';

export type ManagedUserRole = 'learner' | 'admin';

export interface ManagedUser {
  username: string;
  role: ManagedUserRole;
  permissions: string[];
}

export interface UserProfileSyncResult {
  total: number;
  synced: number;
}

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private readonly apiUrl = getAuthApiUrl();

  constructor(
    private readonly http: HttpClient,
    private readonly dataService: DataService
  ) { }

  createUser(username: string, password: string, role: ManagedUserRole): Observable<ManagedUser> {
    // if (!this.dataService.isFirebaseEnabled()) {
    if (false) {
      return throwError(new Error('Firebase must be enabled to create Firebase users.'));
    }
    const token = this.dataService.getFirebaseAuthToken();
    if (!token) {
      return throwError(new Error('Sign in again before creating a user.'));
    }
    if (!this.apiUrl) {
      return throwError(new Error('The Firebase user administration API URL is not configured.'));
    }

    return this.http.post<ManagedUser>(
      `${this.apiUrl}/api/admin/users`,
      { username, password, role },
      { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
    );
  }

  createBootstrapAdmin(username: string, password: string): Observable<ManagedUser> {
    if (!this.dataService.isFirebaseEnabled()) {
      return throwError(new Error('Firebase must be enabled to create the initial Firebase administrator.'));
    }
    if (!this.apiUrl) {
      return throwError(new Error('The Firebase setup API URL is not configured.'));
    }

    return this.http.post<ManagedUser>(
      `${this.apiUrl}/api/admin/bootstrap-user`,
      { username, password },
      { withCredentials: true }
    );
  }

  syncUserProfiles(): Observable<UserProfileSyncResult> {
    if (!this.dataService.isFirebaseEnabled()) {
      return throwError(new Error('Firebase must be enabled to synchronize user profiles.'));
    }
    const token = this.dataService.getFirebaseAuthToken();
    if (!token) {
      return throwError(new Error('Sign in again before synchronizing user profiles.'));
    }
    if (!this.apiUrl) {
      return throwError(new Error('The Firebase user administration API URL is not configured.'));
    }

    return this.http.post<UserProfileSyncResult>(
      `${this.apiUrl}/api/admin/sync-users`,
      {},
      { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
    );
  }
}
