import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { DataService } from './data.service';

describe('DataService', () => {
  let service: DataService;
  let http: HttpTestingController;
  let originalProduction: boolean;
  let originalApiUrl: string;
  let originalFirebaseEnabled: boolean;
  let originalLoginEnabled: boolean;
  let originalAdminConfig: typeof environment.adminFirebaseConfig;

  beforeEach(() => {
    originalProduction = environment.production;
    originalApiUrl = environment.authApiUrl;
    originalFirebaseEnabled = environment.enableFirebase;
    originalLoginEnabled = environment.loginEnabled;
    originalAdminConfig = { ...environment.adminFirebaseConfig };
    environment.production = true;
    environment.authApiUrl = 'https://json.example.test';
    environment.enableFirebase = false;
    localStorage.removeItem('app.firebase.enabled.v1');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(DataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.production = originalProduction;
    environment.authApiUrl = originalApiUrl;
    environment.enableFirebase = originalFirebaseEnabled;
    environment.loginEnabled = originalLoginEnabled;
    environment.adminFirebaseConfig = originalAdminConfig;
    localStorage.removeItem('app.firebase.enabled.v1');
  });

  it('uses the JSON endpoint and makes no Firestore request when Firebase is disabled', () => {
    let result: unknown[] = [];

    service.list('notes').subscribe(records => result = records);

    http.expectOne('https://json.example.test/api/data/notes').flush([{ id: 'note-1' }]);
    http.expectNone(request => request.url.startsWith('https://firestore.googleapis.com/'));
    expect(result).toEqual([{ id: 'note-1' }]);
  });

  it('ignores a stale browser Firebase override when the environment disables Firebase', () => {
    localStorage.setItem('app.firebase.enabled.v1', 'true');
    let result: unknown[] = [];

    service.list('notes').subscribe(records => result = records);

    expect(service.isFirebaseEnabled()).toBeFalse();
    http.expectOne('https://json.example.test/api/data/notes').flush([{ id: 'local-note' }]);
    http.expectNone(request => request.url.startsWith('https://firestore.googleapis.com/'));
    expect(result).toEqual([{ id: 'local-note' }]);
  });

  it('loads every JSON asset listed in the sync manifest as a stable file record', () => {
    let result: unknown[] = [];

    service.readLocalJsonFiles().subscribe(records => result = records);

    http.expectOne('assets/data/json-sync-manifest.json').flush([
      'data/tutorials.json',
      'json_files/route_mapping.json'
    ]);
    http.expectOne('assets/data/tutorials.json').flush([{ id: 't-1' }]);
    http.expectOne('assets/json_files/route_mapping.json').flush([{ route: '/home' }]);

    expect(result).toEqual([
      { id: 'data%2Ftutorials.json', sourcePath: 'data/tutorials.json', data: [{ id: 't-1' }] },
      { id: 'json_files%2Froute_mapping.json', sourcePath: 'json_files/route_mapping.json', data: [{ route: '/home' }] }
    ]);
  });

  it('rejects unsafe JSON asset paths from the sync manifest', () => {
    let error = '';

    service.readLocalJsonFiles().subscribe({
      error: value => error = value.message
    });

    http.expectOne('assets/data/json-sync-manifest.json').flush(['../environments/environment.prod.ts']);

    expect(error).toBe('The JSON asset manifest contains an invalid file path.');
    http.expectNone(request => request.url.includes('environment.prod.ts'));
  });

  it('uses Firestore directly when Firebase is enabled', fakeAsync(() => {
    environment.enableFirebase = true;
    environment.adminFirebaseConfig = {
      apiKey: 'AIzaSyDUMMYTESTKEY1234567890123456789',
      authDomain: '',
      projectId: 'sample-project',
      storageBucket: '',
      messagingSenderId: '',
      appId: 'sample-app'
    };
    service.setFirebaseAuthToken('test-id-token');
    let result: unknown[] = [];

    service.list('questions').subscribe(records => result = records);
    flushMicrotasks();

    const request = http.expectOne(
      'https://firestore.googleapis.com/v1/projects/sample-project/databases/(default)/documents/questions?key=AIzaSyDUMMYTESTKEY1234567890123456789&pageSize=1000'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-id-token');
    request.flush({ documents: [{ name: 'projects/sample-project/databases/(default)/documents/questions/q1', fields: { question: { stringValue: 'Question?' } } }] });
    expect(result).toEqual([{ id: 'q1', question: 'Question?' }]);
    http.expectNone('https://json.example.test/api/data/questions');
  }));

  it('uses the local Admin SDK check when login is disabled', () => {
    environment.enableFirebase = true;
    environment.loginEnabled = false;
    const config = {
      apiKey: 'AIzaSyDUMMYTESTKEY1234567890123456789',
      authDomain: 'sample.firebaseapp.com',
      projectId: 'sample-project',
      storageBucket: '',
      messagingSenderId: '',
      appId: 'sample-app'
    };
    let result: void | undefined;

    service.validateFirebaseConnection(config).subscribe(value => result = value);

    const request = http.expectOne('https://json.example.test/api/admin/validate-firebase-connection');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ projectId: 'sample-project', apiKey: config.apiKey });
    request.flush({ connected: true, projectId: 'sample-project' });
    expect(result).toBeUndefined();
    http.expectNone(request => request.url.startsWith('https://firestore.googleapis.com/'));
  });

  it('syncs JSON file snapshots to the Firestore jsonFiles collection', fakeAsync(() => {
    environment.enableFirebase = true;
    environment.adminFirebaseConfig = {
      apiKey: 'AIzaSyDUMMYTESTKEY1234567890123456789',
      authDomain: '',
      projectId: 'sample-project',
      storageBucket: '',
      messagingSenderId: '',
      appId: 'sample-app'
    };
    let result: string | undefined;

    service.syncRecord('jsonFiles', {
      id: 'data%2Ftutorials.json',
      sourcePath: 'data/tutorials.json',
      data: [{ id: 't-1' }]
    }).subscribe(outcome => result = outcome);
    flushMicrotasks();

    http.expectOne(request => request.url.includes('/documents/jsonFiles?key=')).flush({ documents: [] });
    const write = http.expectOne(request =>
      request.url.includes('/documents/jsonFiles?documentId=data%252Ftutorials.json')
    );
    expect(write.request.method).toBe('POST');
    expect(write.request.body.fields.sourcePath).toEqual({ stringValue: 'data/tutorials.json' });
    write.flush({ name: 'projects/sample-project/databases/(default)/documents/jsonFiles/data%2Ftutorials.json' });

    expect(result).toBe('created');
    http.expectNone(request => request.url.includes('/documents/tutorials'));
  }));
});
