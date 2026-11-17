import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AdminUserService } from './admin-user.service';
import { DataService } from './data.service';

describe('AdminUserService', () => {
  let service: AdminUserService;
  let http: HttpTestingController;
  let dataService: jasmine.SpyObj<DataService>;
  let originalProduction: boolean;
  let originalApiUrl: string;

  beforeEach(() => {
    originalProduction = environment.production;
    originalApiUrl = environment.authApiUrl;
    environment.production = true;
    environment.authApiUrl = 'https://api.example.test';
    dataService = jasmine.createSpyObj<DataService>('DataService', [
      'isFirebaseEnabled',
      'getFirebaseAuthToken'
    ]);
    dataService.isFirebaseEnabled.and.returnValue(true);
    dataService.getFirebaseAuthToken.and.returnValue('firebase-id-token');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DataService, useValue: dataService }
      ]
    });
    service = TestBed.inject(AdminUserService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.production = originalProduction;
    environment.authApiUrl = originalApiUrl;
  });

  it('sends user creation to the API with the authenticated Firebase token', () => {
    service.createUser('learner-2', 'unique-password-123', 'learner').subscribe();

    const request = http.expectOne('https://api.example.test/api/admin/users');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      username: 'learner-2',
      password: 'unique-password-123',
      role: 'learner'
    });
    expect(request.request.headers.get('Authorization')).toBe('Bearer firebase-id-token');
    request.flush({ username: 'learner-2', role: 'learner', permissions: ['home', 'learn', 'practiceQuiz'] });
  });

  it('creates the first administrator using the bootstrap cookie session', () => {
    service.createBootstrapAdmin('initial-admin', 'unique-password-123').subscribe();

    const request = http.expectOne('https://api.example.test/api/admin/bootstrap-user');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      username: 'initial-admin',
      password: 'unique-password-123'
    });
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({ username: 'initial-admin', role: 'admin', permissions: ['*'] });
  });

  it('sends user profile sync to the protected API with the Firebase token', () => {
    service.syncUserProfiles().subscribe();

    const request = http.expectOne('https://api.example.test/api/admin/sync-users');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer firebase-id-token');
    request.flush({ total: 2, synced: 2 });
  });
});
