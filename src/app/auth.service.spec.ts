import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { DataService } from './services/data.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: jasmine.SpyObj<HttpClient>;
  let dataService: jasmine.SpyObj<DataService>;

  beforeEach(() => {
    sessionStorage.clear();
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['post', 'get']);
    dataService = jasmine.createSpyObj<DataService>(
      'DataService',
      ['isFirebaseEnabled', 'getFirebaseConfig', 'getFirebaseUserProfile', 'setFirebaseAuthToken', 'registerCurrentUserLogin']
    );
    dataService.isFirebaseEnabled.and.returnValue(false);
    dataService.registerCurrentUserLogin.and.returnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: HttpClient, useValue: http },
        { provide: DataService, useValue: dataService }
      ]
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    if (service.user && service.isFirebaseLoginEnabled()) {
      http.post.and.returnValue(of(undefined));
      service.logout().subscribe();
    }
    sessionStorage.clear();
  });

  it('uses the existing JSON authentication API when Firebase is disabled', () => {
    http.post.and.returnValue(of({
      authenticated: true,
      user: { username: 'admin', role: 'admin', permissions: ['*'] }
    }));
    let result: unknown;

    service.login('admin', 'password').subscribe(user => result = user);

    expect(http.post).toHaveBeenCalledWith(
      jasmine.stringMatching(/\/auth\/login$/),
      { username: 'admin', password: 'password', firebaseEnabled: false },
      { withCredentials: true }
    );
    expect(dataService.getFirebaseConfig).not.toHaveBeenCalled();
    expect(result).toEqual({ username: 'admin', role: 'admin', permissions: ['*'] });
  });

  it('authenticates username and password with Firebase when Firebase is enabled', () => {
    dataService.isFirebaseEnabled.and.returnValue(true);
    http.post.and.returnValue(of({
      localId: 'firebase-uid',
      idToken: 'test-id-token',
      refreshToken: 'test-refresh-token',
      user: { username: 'admin', role: 'admin', permissions: ['*'] }
    }));
    let result: unknown;

    service.login('admin', 'password').subscribe(user => result = user);

    expect(http.post).toHaveBeenCalledOnceWith(
      jasmine.stringMatching(/\/auth\/firebase\/login$/),
      { username: 'admin', password: 'password' },
      { withCredentials: true }
    );
    expect(dataService.getFirebaseUserProfile).not.toHaveBeenCalled();
    expect(dataService.setFirebaseAuthToken).toHaveBeenCalledWith('test-id-token');
    expect(sessionStorage.getItem('app.firebase.auth.refreshToken.v1')).toBe('test-refresh-token');
    expect(result).toEqual({ username: 'admin', role: 'admin', permissions: ['*'] });
  });

  it('uses the restricted local bootstrap endpoint only when explicitly selected', () => {
    dataService.isFirebaseEnabled.and.returnValue(true);
    http.post.and.returnValue(of({
      authenticated: true,
      user: {
        username: 'admin',
        role: 'firebaseBootstrap',
        permissions: ['firebaseUserSetup']
      }
    }));
    let result: unknown;

    service.loginWithLocalFirebaseBootstrap('admin', 'password').subscribe(user => result = user);

    expect(http.post).toHaveBeenCalledWith(
      jasmine.stringMatching(/\/auth\/firebase\/bootstrap-login$/),
      { username: 'admin', password: 'password' },
      { withCredentials: true }
    );
    expect(result).toEqual({
      username: 'admin',
      role: 'firebaseBootstrap',
      permissions: ['firebaseUserSetup']
    });
    expect(dataService.getFirebaseUserProfile).not.toHaveBeenCalled();
  });

  it('restores a restricted bootstrap session from its server cookie', () => {
    dataService.isFirebaseEnabled.and.returnValue(true);
    http.post.and.returnValue(of(undefined));
    http.get.and.returnValue(of({
      authenticated: true,
      user: {
        username: 'admin',
        role: 'firebaseBootstrap',
        permissions: ['firebaseUserSetup']
      }
    }));
    let result: unknown;

    service.getSession().subscribe(user => result = user);

    expect(http.get).toHaveBeenCalledWith(
      jasmine.stringMatching(/\/auth\/firebase\/bootstrap-session$/),
      { withCredentials: true }
    );
    expect(result).toEqual({
      username: 'admin',
      role: 'firebaseBootstrap',
      permissions: ['firebaseUserSetup']
    });
  });

  it('rejects an incomplete Firebase username login response', () => {
    dataService.isFirebaseEnabled.and.returnValue(true);
    http.post.and.returnValue(of({
      localId: 'firebase-uid',
      idToken: '',
      refreshToken: '',
      user: { username: 'admin', role: 'admin', permissions: ['*'] }
    }));
    let message = '';

    service.login('admin', 'password').subscribe({
      error: error => message = error.message
    });

    expect(message).toContain('incomplete login response');
    expect(dataService.getFirebaseUserProfile).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('app.firebase.auth.refreshToken.v1')).toBeNull();
  });

  it('refreshes the Firebase ID token and restores permissions from the local server session', () => {
    dataService.isFirebaseEnabled.and.returnValue(true);
    dataService.getFirebaseConfig.and.returnValue(of({
      apiKey: 'test-key',
      authDomain: 'sample.firebaseapp.com',
      projectId: 'sample-project',
      storageBucket: '',
      messagingSenderId: '',
      appId: 'sample-app'
    }));
    http.get.and.returnValue(of({
      authenticated: true,
      user: { username: 'admin', role: 'admin', permissions: ['*'] }
    }));
    sessionStorage.setItem('app.firebase.auth.refreshToken.v1', 'initial-refresh-token');
    http.post.and.returnValue(of({
      user_id: 'firebase-uid',
      id_token: 'refreshed-id-token',
      refresh_token: 'refreshed-refresh-token'
    }));
    let refreshHandler: (() => void) | undefined;
    spyOn(window, 'setTimeout').and.callFake((handler: TimerHandler) => {
      if (typeof handler === 'function') refreshHandler = () => handler();
      return 1;
    });

    service.getSession().subscribe();
    refreshHandler?.();

    expect(http.post).toHaveBeenCalledTimes(2);
    expect(http.get).toHaveBeenCalledWith(
      jasmine.stringMatching(/\/auth\/session$/),
      { withCredentials: true }
    );
    expect(dataService.setFirebaseAuthToken).toHaveBeenCalledWith('refreshed-id-token');
    expect(sessionStorage.getItem('app.firebase.auth.refreshToken.v1')).toBe('refreshed-refresh-token');
  });
});
