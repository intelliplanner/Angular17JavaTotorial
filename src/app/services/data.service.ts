import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, defer, forkJoin, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { getAuthApiUrl } from '../auth-api-url';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export type DataCollection =
  | 'tutorials'
  | 'notes'
  | 'questions'
  | 'answers'
  | 'quizzes'
  | 'categories'
  | 'userSettings'
  | 'jsonFiles';

export interface DataRecord {
  id: string;
  [key: string]: unknown;
}

export interface SyncCollectionData {
  [collection: string]: DataRecord[];
}

interface FirestoreDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
}

type FirestoreValue = Record<string, unknown>;

const COLLECTIONS: DataCollection[] = [
  'tutorials', 'notes', 'questions', 'answers', 'quizzes', 'categories', 'userSettings', 'jsonFiles'
];
const CONFIG_KEY = 'app.firebase.config.encrypted.v1';
const ENCRYPTION_KEY = 'firebase-config-key';
const CONFIG_DATABASE = 'tech-interview-hub-config';
const CONFIG_KEY_STORE = 'keys';
const ENABLED_KEY = 'app.firebase.enabled.v1';
const LOCAL_DATA_KEY = 'app.json.data.v1';

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly apiUrl = getAuthApiUrl();
  private configuredFirebase: FirebaseConfig | null = null;
  private firebaseAuthToken: string | null = null;
  private readonly firestoreDocumentIds = new Map<string, Set<string>>();

  constructor(private readonly http: HttpClient) {}

  isFirebaseEnabled(): boolean {
    return environment.enableFirebase;
  }

  async saveFirebaseConfig(config: FirebaseConfig): Promise<void> {
    this.validateConfig(config);
    if (!globalThis.crypto?.subtle) {
      throw new Error('Secure browser storage is unavailable. Use HTTPS to configure Firebase.');
    }

    const key = await this.getOrCreateEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(config));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      iv: this.toBase64(iv),
      data: this.toBase64(new Uint8Array(ciphertext))
    }));
    this.configuredFirebase = { ...config };
  }

  async loadSavedFirebaseConfig(): Promise<FirebaseConfig | null> {
    if (environment.enableFirebase || !localStorage.getItem(CONFIG_KEY)) return null;
    return this.decryptSavedFirebaseConfig();
  }

  getFirebaseConfig(): Observable<FirebaseConfig> {
    return this.resolveFirebaseConfig();
  }

  setFirebaseAuthToken(token: string | null): void {
    this.firebaseAuthToken = token;
  }

  getFirebaseAuthToken(): string | null {
    return this.firebaseAuthToken;
  }

  getFirebaseUserProfile(uid: string): Observable<DataRecord | null> {
    if (!this.isFirebaseEnabled()) {
      return throwError(new Error('Firebase is disabled by the deployment environment.'));
    }
    if (!uid || uid.includes('/')) {
      return throwError(new Error('Firebase user ID is invalid.'));
    }
    return this.resolveFirebaseConfig().pipe(
      switchMap(config => this.getFirestoreDocument(config, 'users', uid))
    );
  }

  enableFirebase(): void {
    if (!environment.enableFirebase) {
      throw new Error('Firebase is disabled by the deployment environment.');
    }
  }

  disableFirebase(): void {
    if (environment.enableFirebase) {
      throw new Error('Firebase is enabled by the deployment environment and cannot be disabled here.');
    }
    localStorage.removeItem(ENABLED_KEY);
  }

  validateFirebaseConnection(config: FirebaseConfig): Observable<void> {
    if (!this.isFirebaseEnabled()) {
      return throwError(new Error('Firebase is disabled by the deployment environment.'));
    }
    try {
      this.validateConfig(config);
    } catch (error) {
      return throwError(error);
    }
    if (!environment.loginEnabled) {
      if (!this.apiUrl) {
        return throwError(new Error('The local Firebase Admin connection check requires the authentication API.'));
      }
      return this.http.post<{ connected: boolean }>(
        `${this.apiUrl}/api/admin/validate-firebase-connection`,
        { projectId: config.projectId, apiKey: config.apiKey },
        { withCredentials: true }
      ).pipe(
        map(response => {
          if (!response || response.connected !== true) {
            throw new Error('The backend did not confirm the Firebase Admin connection.');
          }
          return undefined;
        })
      );
    }
    if (!this.firebaseAuthToken) {
      return throwError(new Error('Sign in with a Firebase account before testing Firestore access.'));
    }
    return this.listFirestore(config, 'tutorials').pipe(
      switchMap(() => {
        const id = `firebase-connection-test-${crypto.randomUUID()}`;
        return this.writeFirestoreDocument(config, 'tutorials', id, { id, connectionTest: true }).pipe(
          switchMap(() => this.deleteFirestoreDocument(config, 'tutorials', id)),
          catchError(error => throwError(new Error(
            `Firestore read/write validation failed. Check collection rules and permissions: ${this.errorDescription(error)}`
          )))
        );
      }),
      map(() => undefined)
    );
  }

  registerConnectedProject(
    projectConfig: FirebaseConfig,
    project: DataRecord
  ): Observable<void> {
    if (!this.isFirebaseEnabled()) {
      return throwError(new Error('Firebase is disabled by the deployment environment.'));
    }
    const adminConfig = environment.adminFirebaseConfig;
    try {
      this.validateConfig(projectConfig);
      this.validateConfig(adminConfig);
    } catch {
      return throwError(new Error('The deployment must configure its admin Firebase project before registering connections.'));
    }

    return this.getFirestoreDocument(adminConfig, 'connectedProjects', project.id).pipe(
      switchMap(existing => {
        const record = this.withId({
          ...project,
          projectName: existing?.['projectName'] ?? project['projectName'],
          connectedAt: existing?.['connectedAt'] ?? project['connectedAt'],
          lastSyncDate: existing?.['lastSyncDate'] ?? project['lastSyncDate'],
          loginCount: Number(existing?.['loginCount'] ?? 0) + 1,
          firebaseConfigMetadata: {
            authDomain: projectConfig.authDomain,
            storageBucket: projectConfig.storageBucket,
            messagingSenderId: projectConfig.messagingSenderId,
            appId: projectConfig.appId
          }
        });
        return existing
          ? this.patchFirestoreDocument(adminConfig, 'connectedProjects', project.id, record)
          : this.writeFirestoreDocument(adminConfig, 'connectedProjects', project.id, record);
      }),
      map(() => undefined)
    );
  }

  registerCurrentUserLogin(userIdentifier: string): Observable<void> {
    if (!this.isFirebaseEnabled()) return of(undefined);
    return this.resolveFirebaseConfig().pipe(
      switchMap(config => this.registerConnectedProject(config, {
        id: config.projectId,
        projectName: config.projectId,
        projectId: config.projectId,
        connectedAt: new Date().toISOString(),
        lastSyncDate: null,
        appVersion: environment.appVersion,
        userEmail: userIdentifier.includes('@') ? userIdentifier : '',
        userIdentifier,
        firebaseEnabled: true,
        status: 'Connected'
      }))
    );
  }

  updateConnectedProjectSyncDate(projectId: string, lastSyncDate: string): Observable<void> {
    if (!this.isFirebaseEnabled()) {
      return throwError(new Error('Firebase is disabled by the deployment environment.'));
    }
    const adminConfig = environment.adminFirebaseConfig;
    try {
      this.validateConfig(adminConfig);
    } catch {
      return throwError(new Error('The deployment must configure its admin Firebase project before recording sync activity.'));
    }
    return this.getFirestoreDocument(adminConfig, 'connectedProjects', projectId).pipe(
      switchMap(project => {
        if (!project) return throwError(new Error('The connected project registry record was not found.'));
        return this.patchFirestoreDocument(adminConfig, 'connectedProjects', projectId, {
          ...project,
          lastSyncDate
        });
      }),
      map(() => undefined)
    );
  }

  list<T extends DataRecord>(collection: DataCollection): Observable<T[]> {
    if (this.isFirebaseEnabled()) {
      return this.resolveFirebaseConfig().pipe(
        switchMap(config => this.listFirestore(config, collection))
      ) as Observable<T[]>;
    }
    return this.readJsonCollection(collection) as Observable<T[]>;
  }

  create<T extends DataRecord>(collection: DataCollection, record: T): Observable<T> {
    const normalized = this.withId(record);
    if (this.isFirebaseEnabled()) {
      return this.resolveFirebaseConfig().pipe(
        switchMap(config => this.writeFirestoreDocument(config, collection, normalized.id, normalized))
      ) as Observable<T>;
    }
    return this.writeJsonRecord(collection, normalized).pipe(map(saved => saved as T));
  }

  importJsonRecord<T extends DataRecord>(collection: DataCollection, record: T): Observable<T> {
    const normalized = this.withId(record) as T;
    return this.list<T>(collection).pipe(
      switchMap(records => {
        const existing = records.find(item => item.id === normalized.id);
        return existing
          ? this.update<T>(collection, normalized.id, normalized)
          : this.create<T>(collection, normalized);
      }),
      catchError(error => this.httpStatus(error) === 409
        ? this.update<T>(collection, normalized.id, normalized)
        : throwError(error)
      )
    );
  }

  update<T extends DataRecord>(collection: DataCollection, id: string, patch: Partial<T>): Observable<T> {
    if (this.isFirebaseEnabled()) {
      return this.resolveFirebaseConfig().pipe(
        switchMap(config => this.getFirestoreDocument(config, collection, id).pipe(
          switchMap(existing => {
            if (!existing) return throwError(new Error(`Record "${id}" does not exist in ${collection}.`));
            const updated = { ...existing, ...patch, id };
            return this.patchFirestoreDocument(config, collection, id, updated);
          })
        ))
      ) as Observable<T>;
    }
    if (this.apiUrl) {
      return this.http.put<T>(`${this.apiUrl}/api/data/${collection}/${encodeURIComponent(id)}`, patch, {
        withCredentials: true
      });
    }
    const data = this.readBrowserCollections();
    const records = Array.isArray(data[collection]) ? data[collection] : [];
    if (!records.some(item => item.id === id)) {
      return throwError(new Error(`Record "${id}" does not exist in ${collection}.`));
    }
    data[collection] = records.map(item => item.id === id ? { ...item, ...patch, id } : item);
    this.saveBrowserCollections(data);
    return of(data[collection].find(item => item.id === id) as T);
  }

  delete(collection: DataCollection, id: string): Observable<void> {
    if (this.isFirebaseEnabled()) {
      return this.resolveFirebaseConfig().pipe(
        switchMap(config => this.deleteFirestoreDocument(config, collection, id))
      );
    }
    if (this.apiUrl) {
      return this.http.delete<void>(`${this.apiUrl}/api/data/${collection}/${encodeURIComponent(id)}`, {
        withCredentials: true
      });
    }
    const data = this.readBrowserCollections();
    const records = Array.isArray(data[collection]) ? data[collection] : [];
    if (!records.some(item => item.id === id)) {
      return throwError(new Error(`Record "${id}" does not exist in ${collection}.`));
    }
    data[collection] = records.filter(item => item.id !== id);
    this.saveBrowserCollections(data);
    return of(undefined);
  }

  syncRecord(collection: DataCollection, record: DataRecord): Observable<'created' | 'skipped'> {
    if (!this.isFirebaseEnabled()) {
      return throwError(new Error('Firebase is disabled by the deployment environment.'));
    }
    const normalized = this.withId(record);
    return this.resolveFirebaseConfig().pipe(
      switchMap(config => {
        const cacheKey = `${config.projectId}/${collection}`;
        const cachedIds = this.firestoreDocumentIds.get(cacheKey);
        const ids$ = cachedIds
          ? of(cachedIds)
          : this.listFirestore(config, collection).pipe(
            map(documents => new Set(documents.map(document => document.id)))
          );
        return ids$.pipe(switchMap(ids => {
          this.firestoreDocumentIds.set(cacheKey, ids);
          if (ids.has(normalized.id)) return of<'created' | 'skipped'>('skipped');
          return this.writeFirestoreDocument(config, collection, normalized.id, normalized).pipe(
            map(() => {
              ids.add(normalized.id);
              return 'created' as const;
            }),
            catchError(error => {
              this.firestoreDocumentIds.delete(cacheKey);
              return throwError(error);
            })
          );
        }));
      })
    );
  }

  readLocalJsonFiles(): Observable<DataRecord[]> {
    return this.http.get<unknown>('assets/data/json-sync-manifest.json').pipe(
      switchMap(manifest => {
        if (!Array.isArray(manifest) || manifest.some(path =>
          typeof path !== 'string' || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.json$/i.test(path)
        )) {
          return throwError(new Error('The JSON asset manifest contains an invalid file path.'));
        }

        const paths = manifest as string[];
        const ids = paths.map(path => encodeURIComponent(path));
        if (new Set(ids).size !== ids.length) {
          return throwError(new Error('The JSON asset manifest contains duplicate file paths.'));
        }
        if (!paths.length) return of([]);

        return forkJoin(paths.map((path, index) =>
          this.http.get<unknown>(`assets/${path}`).pipe(
            map(data => ({
              id: ids[index],
              sourcePath: path,
              data
            }))
          )
        ));
      })
    );
  }

  readLocalCollections(): Observable<SyncCollectionData> {
    return from(this.loadJsonFiles()).pipe(
      switchMap(collections => {
        if (!this.apiUrl) return of(this.mergeBrowserData(collections));
        return forkJoin({
          saved: this.http.get<SyncCollectionData>(`${this.apiUrl}/api/data`, { withCredentials: true }),
          tutorials: this.http.get<DataRecord[]>(`${this.apiUrl}/api/admin/tutorials`, { withCredentials: true }),
          questions: this.http.get<DataRecord[]>(`${this.apiUrl}/api/questions`, { withCredentials: true }),
          categories: this.http.get<DataRecord[]>(`${this.apiUrl}/api/categories`, { withCredentials: true })
        }).pipe(map(({ saved, tutorials, questions, categories }) => {
          const current = this.mergeCollections(collections, saved);
          current['tutorials'] = this.mergeRecords(tutorials.map((item, index) => this.withId({
            ...item,
            id: String(item.id ?? item['tid'] ?? `tutorial-${index}`)
          })), saved['tutorials'] ?? []);
          current['questions'] = this.mergeRecords(questions.map((item, index) => this.withId({
            ...item,
            id: item.id || `question-${index}`
          })), saved['questions'] ?? []);
          current['answers'] = this.mergeRecords(questions.map((item, index) => this.withId({
            id: `${item.id || `question-${index}`}-answer`,
            questionId: item.id || `question-${index}`,
            answer: item['answer'] ?? ''
          })), saved['answers'] ?? []);
          current['categories'] = this.mergeRecords(categories.map((item, index) => this.withId({
            ...item,
            id: item.id || String(item['name'] ?? `category-${index}`)
          })), saved['categories'] ?? []);
          return current;
        }));
      })
    );
  }

  private readJsonCollection(collection: DataCollection): Observable<DataRecord[]> {
    if (this.apiUrl) {
      return this.http.get<DataRecord[]>(`${this.apiUrl}/api/data/${collection}`, {
        withCredentials: true
      }).pipe(catchError(error => this.httpStatus(error) === 404
        ? of([])
        : throwError(error)));
    }
    const local = this.readBrowserCollections();
    const value = local[collection];
    return of(Array.isArray(value) ? value : []);
  }

  private writeJsonRecord<T extends DataRecord>(collection: DataCollection, record: T): Observable<T> {
    if (this.apiUrl) {
      return this.http.post<T>(`${this.apiUrl}/api/data/${collection}`, record, { withCredentials: true });
    }
    const data = this.readBrowserCollections();
    const records = Array.isArray(data[collection]) ? data[collection] : [];
    if (records.some(item => item.id === record.id)) {
      return throwError(new Error(`Record "${record.id}" already exists in ${collection}.`));
    }
    data[collection] = [...records, record];
    this.saveBrowserCollections(data);
    return of(record);
  }

  private resolveFirebaseConfig(): Observable<FirebaseConfig> {
    return defer(() => from(this.loadFirebaseConfig()));
  }

  private async loadFirebaseConfig(): Promise<FirebaseConfig> {
    if (this.configuredFirebase) return this.configuredFirebase;
    if (environment.enableFirebase) {
      this.validateConfig(environment.adminFirebaseConfig);
      return environment.adminFirebaseConfig;
    }
    return this.decryptSavedFirebaseConfig();
  }

  private async decryptSavedFirebaseConfig(): Promise<FirebaseConfig> {
    const encrypted = localStorage.getItem(CONFIG_KEY);
    if (!encrypted) throw new Error('Configure Firebase on this device before enabling it.');

    try {
      const payload = JSON.parse(encrypted) as { iv: string; data: string };
      const key = await this.getOrCreateEncryptionKey();
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: this.fromBase64(payload.iv) },
        key,
        this.fromBase64(payload.data)
      );
      const config = JSON.parse(new TextDecoder().decode(plaintext)) as FirebaseConfig;
      this.validateConfig(config);
      this.configuredFirebase = config;
      return config;
    } catch (error) {
      throw new Error(`Saved Firebase configuration could not be decrypted or validated: ${String(error)}`);
    }
  }

  private async getOrCreateEncryptionKey(): Promise<CryptoKey> {
    const database = await this.openConfigDatabase();
    const generatedKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    return new Promise<CryptoKey>((resolve, reject) => {
      const transaction = database.transaction(CONFIG_KEY_STORE, 'readwrite');
      const store = transaction.objectStore(CONFIG_KEY_STORE);
      const existingRequest = store.get(ENCRYPTION_KEY);
      let selectedKey: CryptoKey = generatedKey;
      existingRequest.onsuccess = () => {
        if (existingRequest.result) {
          selectedKey = existingRequest.result as CryptoKey;
        } else {
          store.add(generatedKey, ENCRYPTION_KEY);
        }
      };
      transaction.oncomplete = () => {
        database.close();
        resolve(selectedKey);
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error('Could not securely store the Firebase encryption key.'));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error ?? new Error('Secure Firebase configuration storage was aborted.'));
      };
    });
  }

  private openConfigDatabase(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(CONFIG_DATABASE, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(CONFIG_KEY_STORE)) {
          request.result.createObjectStore(CONFIG_KEY_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open secure browser configuration storage.'));
      request.onblocked = () => reject(new Error('Secure browser configuration storage is blocked by another tab.'));
    });
  }

  private validateConfig(config: FirebaseConfig): void {
    if (!config || typeof config.apiKey !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(config.apiKey) ||
      typeof config.projectId !== 'string' || !/^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId) ||
      typeof config.appId !== 'string' || !config.appId.trim()) {
      throw new Error('Firebase API key, valid project ID, and app ID are required.');
    }
  }

  private listFirestore(config: FirebaseConfig, collection: string): Observable<DataRecord[]> {
    const url = `${this.firestoreCollectionUrl(config, collection)}?key=${encodeURIComponent(config.apiKey)}&pageSize=1000`;
    return this.http.get<{ documents?: FirestoreDocument[]; nextPageToken?: string }>(url, {
      headers: this.firebaseAuthHeaders()
    }).pipe(
      switchMap(response => {
        const documents = response.documents ?? [];
        return response.nextPageToken
          ? this.listFirestorePages(config, collection, response.nextPageToken, documents)
          : of(documents.map(document => this.fromFirestoreDocument(document)));
      })
    );
  }

  private listFirestorePages(
    config: FirebaseConfig,
    collection: string,
    pageToken: string,
    accumulated: FirestoreDocument[]
  ): Observable<DataRecord[]> {
    const url = `${this.firestoreCollectionUrl(config, collection)}?key=${encodeURIComponent(config.apiKey)}&pageSize=1000&pageToken=${encodeURIComponent(pageToken)}`;
    return this.http.get<{ documents?: FirestoreDocument[]; nextPageToken?: string }>(url, {
      headers: this.firebaseAuthHeaders()
    }).pipe(
      switchMap(response => {
        const documents = [...accumulated, ...(response.documents ?? [])];
        return response.nextPageToken
          ? this.listFirestorePages(config, collection, response.nextPageToken, documents)
          : of(documents.map(document => this.fromFirestoreDocument(document)));
      })
    );
  }

  private getFirestoreDocument(
    config: FirebaseConfig,
    collection: string,
    id: string
  ): Observable<DataRecord | null> {
    const url = `${this.firestoreCollectionUrl(config, collection)}/${encodeURIComponent(id)}?key=${encodeURIComponent(config.apiKey)}`;
    return this.http.get<FirestoreDocument>(url, { headers: this.firebaseAuthHeaders() }).pipe(
      map(document => this.fromFirestoreDocument(document)),
      catchError(error => this.httpStatus(error) === 404 ? of(null) : throwError(error))
    );
  }

  private writeFirestoreDocument(
    config: FirebaseConfig,
    collection: string,
    id: string,
    record: DataRecord
  ): Observable<DataRecord> {
    const url = `${this.firestoreCollectionUrl(config, collection)}?documentId=${encodeURIComponent(id)}&key=${encodeURIComponent(config.apiKey)}`;
    return this.http.post<FirestoreDocument>(url, { fields: this.toFirestoreFields(record) }, {
      headers: this.firebaseAuthHeaders()
    }).pipe(
      map(document => this.fromFirestoreDocument(document))
    );
  }

  private patchFirestoreDocument(
    config: FirebaseConfig,
    collection: string,
    id: string,
    record: DataRecord
  ): Observable<DataRecord> {
    const url = `${this.firestoreCollectionUrl(config, collection)}/${encodeURIComponent(id)}?key=${encodeURIComponent(config.apiKey)}`;
    return this.http.patch<FirestoreDocument>(url, { fields: this.toFirestoreFields(record) }, {
      headers: this.firebaseAuthHeaders()
    }).pipe(
      map(document => this.fromFirestoreDocument(document))
    );
  }

  private deleteFirestoreDocument(config: FirebaseConfig, collection: string, id: string): Observable<void> {
    const url = `${this.firestoreCollectionUrl(config, collection)}/${encodeURIComponent(id)}?key=${encodeURIComponent(config.apiKey)}`;
    return this.http.delete<void>(url, { headers: this.firebaseAuthHeaders() });
  }

  private firebaseAuthHeaders(): HttpHeaders | undefined {
    return this.firebaseAuthToken
      ? new HttpHeaders({ Authorization: `Bearer ${this.firebaseAuthToken}` })
      : undefined;
  }

  private firestoreCollectionUrl(config: FirebaseConfig, collection: string): string {
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/${encodeURIComponent(collection)}`;
  }

  private toFirestoreFields(record: DataRecord): Record<string, FirestoreValue> {
    return Object.fromEntries(Object.entries(record)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, this.toFirestoreValue(value)]));
  }

  private toFirestoreValue(value: unknown): FirestoreValue {
    if (value === null) return { nullValue: null };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Firestore numbers must be finite.');
      return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    }
    if (Array.isArray(value)) {
      return { arrayValue: { values: value.map(item => this.toFirestoreValue(item)) } };
    }
    if (typeof value === 'object') {
      return { mapValue: { fields: this.toFirestoreFields(value as DataRecord) } };
    }
    throw new Error(`Unsupported Firestore field type: ${typeof value}`);
  }

  private fromFirestoreDocument(document: FirestoreDocument): DataRecord {
    const id = document.name.split('/').pop() ?? '';
    return {
      id,
      ...Object.fromEntries(Object.entries(document.fields ?? {}).map(
        ([key, value]) => [key, this.fromFirestoreValue(value)]
      ))
    };
  }

  private fromFirestoreValue(value: FirestoreValue): unknown {
    if ('stringValue' in value) return value['stringValue'];
    if ('integerValue' in value) return Number(value['integerValue']);
    if ('doubleValue' in value) return value['doubleValue'];
    if ('booleanValue' in value) return value['booleanValue'];
    if ('nullValue' in value) return null;
    if ('arrayValue' in value) {
      const array = value['arrayValue'] as { values?: FirestoreValue[] };
      return (array.values ?? []).map(item => this.fromFirestoreValue(item));
    }
    if ('mapValue' in value) {
      const map = value['mapValue'] as { fields?: Record<string, FirestoreValue> };
      return Object.fromEntries(Object.entries(map.fields ?? {}).map(
        ([key, item]) => [key, this.fromFirestoreValue(item)]
      ));
    }
    return undefined;
  }

  private withId(record: DataRecord): DataRecord {
    const id = typeof record.id === 'string' || typeof record.id === 'number'
      ? String(record.id)
      : crypto.randomUUID();
    if (!id || id.includes('/')) throw new Error('Record ID must be non-empty and cannot contain "/".');
    return { ...record, id };
  }

  private async loadJsonFiles(): Promise<SyncCollectionData> {
    const [tutorials, questions, categories, notes, quizManifest, jsonFiles] = await Promise.all([
      this.http.get<DataRecord[]>('assets/data/tutorials.json').toPromise(),
      this.http.get<DataRecord[]>('assets/data/questions-and-answers.json').toPromise(),
      this.http.get<DataRecord[]>('assets/data/topic_categories.json').toPromise(),
      this.http.get<unknown>('assets/json_files/categorized_topic.json').toPromise(),
      this.http.get<Record<string, string>>('assets/data/question-files.json').toPromise(),
      this.readLocalJsonFiles().toPromise()
    ]);

    const quizGroups = await Promise.all(Object.entries(quizManifest ?? {}).map(async ([category, filename]) => {
      if (!/^[a-z0-9-]+\.json$/i.test(filename)) throw new Error(`Invalid quiz JSON filename: ${filename}`);
      const questionsForCategory = await this.http.get<DataRecord[]>(`assets/data/${filename}`).toPromise();
      return (questionsForCategory ?? []).map(item => ({
        ...item,
        id: String(item.id),
        category: item['category'] || category
      }));
    }));
    let savedQuizQuestions: DataRecord[] | null = null;
    const quizQuestionJson = localStorage.getItem('interview-quiz.questions.v1');
    if (quizQuestionJson) {
      const saved: unknown = JSON.parse(quizQuestionJson);
      if (!Array.isArray(saved) || saved.some(item => !item || typeof item !== 'object')) {
        throw new Error('Saved quiz question data is invalid JSON.');
      }
      savedQuizQuestions = saved as DataRecord[];
    }
    const questionRecords = (questions ?? []).map((item, index) => this.withId({ ...item, id: item.id ?? `question-${index}` }));
    const answerRecords = (questions ?? []).map((item, index) => this.withId({
      id: `${String(item.id ?? `question-${index}`)}-answer`,
      questionId: item.id ?? `question-${index}`,
      answer: item['answer'] ?? ''
    }));
    const noteRecords = Array.isArray(notes)
      ? notes.map((item, index) => this.withId({ ...(item as DataRecord), id: (item as DataRecord).id ?? `note-${index}` }))
      : notes && typeof notes === 'object'
        ? Object.entries(notes as Record<string, unknown>).map(([id, value]) =>
          this.withId({ id, content: value }))
        : [];
    const settings = Object.keys(localStorage)
      .filter(key => key.startsWith('hub-') ||
        (key.startsWith('interview-quiz.') && key !== 'interview-quiz.questions.v1') ||
        key === 'quiz-dark-mode')
      .map(id => ({ id, value: localStorage.getItem(id) ?? '' }));

    return {
      tutorials: (tutorials ?? []).map((item, index) => this.withId({
        ...item,
        id: String(item.id ?? item['tid'] ?? `tutorial-${index}`)
      })),
      notes: noteRecords,
      questions: questionRecords,
      answers: answerRecords,
      quizzes: (savedQuizQuestions ?? quizGroups.flat()).map((item, index) =>
        this.withId({ ...item, id: String(item.id ?? `quiz-${index}`) })),
      categories: (categories ?? []).map((item, index) => this.withId({
        ...item,
        id: item.id || String(item['name'] ?? `category-${index}`)
      })),
      userSettings: settings,
      jsonFiles: jsonFiles ?? []
    };
  }

  private mergeBrowserData(collections: SyncCollectionData): SyncCollectionData {
    return this.mergeCollections(collections, this.readBrowserCollections());
  }

  private mergeCollections(base: SyncCollectionData, saved: SyncCollectionData): SyncCollectionData {
    return Object.fromEntries(COLLECTIONS.map(collection => [
      collection,
      this.mergeRecords(base[collection] ?? [], saved?.[collection] ?? [])
    ]));
  }

  private mergeRecords(base: DataRecord[], saved: DataRecord[]): DataRecord[] {
    const records = new Map<string, DataRecord>();
    base.forEach(record => records.set(record.id, record));
    saved.forEach(record => records.set(record.id, record));
    return [...records.values()];
  }

  private readBrowserCollections(): SyncCollectionData {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_DATA_KEY) ?? '{}') as SyncCollectionData;
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch (error) {
      throw new Error(`Local JSON data is invalid: ${String(error)}`);
    }
  }

  private saveBrowserCollections(collections: SyncCollectionData): void {
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(collections));
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
  }

  private fromBase64(value: string): Uint8Array {
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
  }

  private httpStatus(error: unknown): number | undefined {
    return typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : undefined;
  }

  private errorDescription(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.error?.message ?? error.error?.message;
      return typeof message === 'string' ? message : `${error.status} ${error.message}`;
    }
    return error instanceof Error ? error.message : String(error);
  }
}
