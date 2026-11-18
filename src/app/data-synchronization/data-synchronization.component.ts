import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { AdminUserService, UserProfileSyncResult } from '../services/admin-user.service';
import { DataCollection, DataRecord, DataService, FirebaseConfig, SyncCollectionData } from '../services/data.service';
import { environment } from '../../environments/environment';

const COLLECTIONS: DataCollection[] = [
  'tutorials', 'notes', 'questions', 'answers', 'quizzes', 'categories', 'userSettings', 'jsonFiles'
];

interface CollectionResult {
  total: number;
  synced: number;
  skipped: number;
  failed: number;
}

@Component({
  selector: 'app-data-synchronization',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="sync-page">
      <header class="sync-heading">
        <p class="eyebrow">SETTINGS</p>
        <h1>Data Synchronization</h1>
        <p>Manage local JSON data and export or import backups.</p>
      </header>

      <div *ngIf="message" class="notice" [class.error]="hasError" role="status">{{ message }}</div>
      <div *ngIf="!environmentEnabled" class="notice">
        Firebase is disabled by the deployment environment. Login and application data use local JSON storage.
      </div>

      <section *ngIf="environmentEnabled" class="sync-card" aria-labelledby="setup-title">
        <div class="card-title">
          <div><p class="eyebrow">STEP 1 · CONNECTION</p><h2 id="setup-title">Firebase Setup</h2></div>
          <span class="status" [class.connected]="firebaseEnabled">{{ firebaseEnabled ? 'Connected' : 'Not connected' }}</span>
        </div>
        <p class="hint">The configured Firebase project is prefilled below. Sign in before testing access; validating read/write access requires an administrator profile. The Web API key identifies the project but does not grant Firestore permissions.</p>
        <div class="config-grid">
          <label>API key<input [(ngModel)]="config.apiKey" autocomplete="off" type="password" placeholder="Firebase Web API key"></label>
          <label>Project Name<input [(ngModel)]="projectName" autocomplete="off" placeholder="Demo Project"></label>
          <label>Project ID<input [(ngModel)]="config.projectId" autocomplete="off" placeholder="your-project-id"></label>
          <label>App ID<input [(ngModel)]="config.appId" autocomplete="off" placeholder="1:123456:web:abc123"></label>
          <label>Auth domain<input [(ngModel)]="config.authDomain" autocomplete="off" placeholder="your-project.firebaseapp.com"></label>
          <label>Storage bucket<input [(ngModel)]="config.storageBucket" autocomplete="off" placeholder="your-project.appspot.com"></label>
          <label>Messaging sender ID<input [(ngModel)]="config.messagingSenderId" autocomplete="off" placeholder="Numeric sender ID"></label>
        </div>
        <div class="actions">
          <button type="button" class="secondary" [disabled]="busy" (click)="testConnection()">Test Connection</button>
          <button type="button" class="secondary" [disabled]="busy || firebaseEnabled" (click)="saveConfiguration()">Save Configuration</button>
          <button type="button" class="primary" [disabled]="busy || firebaseEnabled" (click)="connectFirebase()">Connect Firebase</button>
          <button *ngIf="firebaseEnabled && !environmentEnabled" type="button" class="secondary" [disabled]="busy" (click)="disconnectFirebase()">Disable Firebase</button>
        </div>
      </section>

      <section class="sync-card" aria-labelledby="sync-title">
        <div class="card-title">
          <div><p class="eyebrow">STEP 2 · DATA</p><h2 id="sync-title">{{ environmentEnabled ? 'JSON → Firebase Sync' : 'JSON Backup & Restore' }}</h2></div>
        </div>
        <p *ngIf="environmentEnabled" class="hint">Tutorials, questions and answers, quizzes, and every JSON asset file are included. Existing document IDs are skipped; failed records can be retried.</p>
        <p *ngIf="!environmentEnabled" class="hint">Firebase synchronization is unavailable in this build. Import and export operate on local JSON data.</p>
        <div *ngIf="environmentEnabled" class="collection-grid">
          <label *ngFor="let collection of collections" class="collection-option">
            <input type="checkbox" [(ngModel)]="selected[collection]">
            <span>{{ collectionLabels[collection] }}</span>
            <small>{{ results[collection]?.total ?? '—' }} records</small>
          </label>
        </div>
        <div *ngIf="environmentEnabled && busy" class="progress-wrap" aria-live="polite">
          <div class="progress-label"><span>{{ progressLabel }}</span><strong>{{ completedRecords }} / {{ totalRecords }}</strong></div>
          <progress [value]="completedRecords" [max]="totalRecords || 1"></progress>
        </div>
        <div class="actions">
          <button *ngIf="environmentEnabled" type="button" class="primary" [disabled]="busy || !firebaseEnabled" (click)="sync(true)">Sync All</button>
          <button *ngIf="environmentEnabled" type="button" class="secondary" [disabled]="busy || !firebaseEnabled" (click)="syncJsonFiles()">Sync All JSON Files</button>
          <button *ngIf="environmentEnabled" type="button" class="secondary" [disabled]="busy || !firebaseEnabled || !hasSelectedCollection" (click)="sync(false)">Sync Selected Collections</button>
          <button *ngIf="environmentEnabled" type="button" class="secondary" [disabled]="busy || !firebaseEnabled || !failedRecords.length" (click)="retryFailed()">Retry Failed Records</button>
          <button type="button" class="secondary" [disabled]="busy" (click)="exportBackup()">Export JSON Backup</button>
          <label class="file-button" [class.disabled]="busy">Import JSON Backup<input type="file" accept="application/json,.json" [disabled]="busy" (change)="importBackup($event)"></label>
        </div>
        <div *ngIf="environmentEnabled && hasResults" class="results" aria-live="polite">
          <h3>Synchronization statistics</h3>
          <div class="result-grid">
            <div *ngFor="let collection of collections">
              <span>{{ collectionLabels[collection] }} Synced</span><strong>{{ results[collection]?.synced ?? 0 }}</strong>
            </div>
            <div class="failed-total"><span>Failed Records</span><strong>{{ failedCount }}</strong></div>
          </div>
        </div>
      </section>

      <section *ngIf="environmentEnabled" class="sync-card" aria-labelledby="user-sync-title">
        <div class="card-title">
          <div><p class="eyebrow">STEP 3 · USERS</p><h2 id="user-sync-title">User Profile Synchronization</h2></div>
        </div>
        <p class="hint">Optional sync from the server-side <code>data/users.json</code>. Only usernames, roles, and permissions are uploaded; password hashes and salts are excluded. This sync requires an existing Firebase UID in each local record; Firebase username login does not use this sync.</p>
        <div class="actions">
          <button type="button" class="secondary" [disabled]="busy || !firebaseEnabled" (click)="syncUserProfiles()">Sync User Profiles</button>
        </div>
        <div *ngIf="userSyncResult" class="results" aria-live="polite">
          <h3>User profile sync statistics</h3>
          <div class="result-grid">
            <div><span>Users Synced</span><strong>{{ userSyncResult.synced }}</strong></div>
            <div><span>Total Users</span><strong>{{ userSyncResult.total }}</strong></div>
            <div class="failed-total"><span>Failed Records</span><strong>0</strong></div>
          </div>
        </div>
      </section>
    </main>
  `,
  styles: [`
    :host{display:block;color:#203746}
    .sync-page{max-width:1060px;margin:36px auto;padding:0 20px 56px}
    .sync-heading{margin-bottom:24px}.sync-heading h1{margin:0;color:#173b4e;font-size:2rem;font-weight:750}
    .sync-heading>p:last-child,.hint{color:#607586;line-height:1.55}.eyebrow{margin:0 0 7px;color:#278079;font-size:.7rem;font-weight:800;letter-spacing:.11em}
    .sync-card{margin-top:20px;padding:24px;border:1px solid #e0e9ed;border-radius:14px;background:#fff;box-shadow:0 8px 26px #24404c0b}
    .card-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.card-title h2{margin:0;font-size:1.3rem}
    .status{padding:6px 10px;border-radius:20px;background:#fff3e8;color:#9a571d;font-size:.78rem;font-weight:700}.status.connected{background:#e8f7f1;color:#207452}
    .config-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.config-grid label{display:grid;gap:6px;color:#435b6b;font-size:.82rem;font-weight:650}
    input:not([type=checkbox]):not([type=file]){min-width:0;padding:10px 11px;border:1px solid #d5e0e5;border-radius:8px;color:#263f4c;background:#fff;font:inherit;font-weight:400}
    .collection-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:18px 0}
    .collection-option{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;padding:12px;border:1px solid #e2e9ec;border-radius:9px;color:#354e5c}
    .collection-option small{color:#758996}.collection-option input{accent-color:#287e77}
    .actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}
    button,.file-button{display:inline-flex;align-items:center;justify-content:center;min-height:39px;padding:8px 13px;border:1px solid #d5e0e5;border-radius:8px;background:#fff;color:#35515f;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer}
    button.primary{border-color:#1d6e69;background:#1d6e69;color:#fff}.file-button{position:relative;overflow:hidden}.file-button input{position:absolute;inset:0;width:100%;opacity:0;cursor:pointer}
    button:disabled,.file-button.disabled{opacity:.55;cursor:not-allowed}.progress-wrap{margin-top:20px}.progress-label{display:flex;justify-content:space-between;margin-bottom:7px;color:#4f6977;font-size:.82rem}
    progress{width:100%;height:12px;accent-color:#218278}.results{margin-top:24px;padding-top:18px;border-top:1px solid #e5ecef}.results h3{margin:0 0 12px;font-size:1rem}
    .result-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px}.result-grid>div{display:flex;justify-content:space-between;gap:8px;padding:11px;border-radius:8px;background:#f4f8f8;color:#5a707d;font-size:.78rem}.result-grid strong{color:#176c65}
    .result-grid .failed-total strong{color:#ae3f3f}.notice{margin:16px 0;padding:12px 14px;border-radius:8px;background:#e8f6f1;color:#216b4b}.notice.error{background:#fff0ee;color:#a33d32}
    [data-theme=dark] :host{color:#dbe5e9}[data-theme=dark] .sync-card{border-color:#384b57;background:#1e303b}
    [data-theme=dark] .sync-heading h1,[data-theme=dark] .card-title h2{color:#e6eff3}[data-theme=dark] .hint,[data-theme=dark] .sync-heading>p:last-child{color:#adbec7}
    [data-theme=dark] input:not([type=checkbox]):not([type=file]),[data-theme=dark] button,[data-theme=dark] .file-button{border-color:#40535e;background:#243843;color:#dce7ec}
    [data-theme=dark] button.primary{background:#236e69}[data-theme=dark] .collection-option{border-color:#40535e;color:#dce7ec}
    [data-theme=dark] .result-grid>div{background:#263b45;color:#c3d1d8}
    @media(max-width:620px){.sync-page{margin-top:24px;padding:0 14px 40px}.sync-card{padding:18px}.config-grid{grid-template-columns:1fr}}
  `]
})
export class DataSynchronizationComponent implements OnInit {
  readonly collections = COLLECTIONS;
  readonly environmentEnabled = true;//environment.enableFirebase;
  readonly collectionLabels: Record<DataCollection, string> = {
    tutorials: 'Tutorials',
    notes: 'Notes',
    questions: 'Questions',
    answers: 'Answers',
    quizzes: 'Quizzes',
    categories: 'Categories',
    userSettings: 'User Settings',
    jsonFiles: 'Source JSON Files'
  };
  config: FirebaseConfig = {
    apiKey: environment.adminFirebaseConfig.apiKey,
    authDomain: environment.adminFirebaseConfig.authDomain,
    projectId: environment.adminFirebaseConfig.projectId,
    storageBucket: environment.adminFirebaseConfig.storageBucket,
    messagingSenderId: environment.adminFirebaseConfig.messagingSenderId,
    appId: environment.adminFirebaseConfig.appId
  };
  projectName = environment.adminFirebaseConfig.projectId;
  selected: Record<DataCollection, boolean> = {
    tutorials: true,
    notes: true,
    questions: true,
    answers: true,
    quizzes: true,
    categories: true,
    userSettings: true,
    jsonFiles: true
  };
  results: Partial<Record<DataCollection, CollectionResult>> = {};
  failedRecords: Array<{ collection: DataCollection; record: DataRecord }> = [];
  busy = false;
  message = '';
  hasError = false;
  progressLabel = '';
  completedRecords = 0;
  totalRecords = 0;
  hasResults = false;
  userSyncResult: UserProfileSyncResult | null = null;
  firebaseEnabled = this.dataService.isFirebaseEnabled();

  constructor(
    private readonly dataService: DataService,
    private readonly authService: AuthService,
    private readonly adminUserService: AdminUserService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const saved = await this.dataService.loadSavedFirebaseConfig();
      if (saved) {
        this.config = saved;
        this.projectName = saved.projectId;
      }
    } catch (error) {
      this.showMessage(this.errorMessage('Could not load saved Firebase configuration', error), true);
    }
  }

  get hasSelectedCollection(): boolean {
    return this.collections.some(collection => this.selected[collection]);
  }

  get failedCount(): number {
    return this.failedRecords.length;
  }

  async testConnection(): Promise<void> {
    if (!this.environmentEnabled) {
      this.showMessage('Firebase is disabled by the deployment environment.', true);
      return;
    }
    this.busy = true;
    this.message = '';
    try {
      await this.dataService.validateFirebaseConnection(this.config).toPromise();
      this.showMessage('Firebase connection and Firestore access were validated.');
    } catch (error) {
      this.showMessage(this.errorMessage('Firebase connection failed', error), true);
    } finally {
      this.busy = false;
    }
  }

  async saveConfiguration(): Promise<void> {
    this.busy = true;
    try {
      await this.dataService.saveFirebaseConfig(this.config);
      this.showMessage('Firebase configuration saved with AES-GCM encryption in browser storage.');
    } catch (error) {
      this.showMessage(this.errorMessage('Could not save Firebase configuration', error), true);
    } finally {
      this.busy = false;
    }
  }

  async connectFirebase(): Promise<void> {
    if (!this.environmentEnabled) {
      this.showMessage('Firebase is disabled by the deployment environment.', true);
      return;
    }
    this.busy = true;
    this.message = '';
    try {
      await this.dataService.validateFirebaseConnection(this.config).toPromise();
      await this.dataService.saveFirebaseConfig(this.config);
      const user = this.authService.user;
      const connectedAt = new Date().toISOString();
      await this.dataService.registerConnectedProject(this.config, {
        id: this.config.projectId,
        projectName: this.projectName.trim() || this.config.projectId,
        projectId: this.config.projectId,
        connectedAt,
        lastSyncDate: null,
        appVersion: environment.appVersion,
        userEmail: user?.username ?? '',
        userIdentifier: user?.username ?? '',
        firebaseEnabled: true,
        status: 'Connected'
      }).toPromise();
      this.dataService.enableFirebase();
      this.firebaseEnabled = true;
      console.info('Firebase project connection registered:', this.config.projectId, user?.username ?? 'unknown user');
      this.showMessage('Firebase connected. You can now synchronize selected JSON collections.');
    } catch (error) {
      this.showMessage(this.errorMessage('Could not connect Firebase', error), true);
    } finally {
      this.busy = false;
    }
  }

  disconnectFirebase(): void {
    try {
      this.dataService.disableFirebase();
      this.firebaseEnabled = false;
      this.showMessage('Firebase is disabled. Data operations will use JSON storage.');
    } catch (error) {
      this.showMessage(this.errorMessage('Could not disable Firebase', error), true);
    }
  }

  async sync(all: boolean): Promise<void> {
    const selected = this.collections.filter(collection => all || this.selected[collection]);
    await this.syncCollections(selected);
  }

  async syncJsonFiles(): Promise<void> {
    await this.syncCollections(['jsonFiles']);
  }

  async syncUserProfiles(): Promise<void> {
    if (!this.environmentEnabled) {
      this.showMessage('Firebase is disabled by the deployment environment.', true);
      return;
    }
    this.busy = true;
    this.userSyncResult = null;
    this.message = '';
    try {
      const result = await this.adminUserService.syncUserProfiles().toPromise();
      if (!result) throw new Error('The server returned no user profile synchronization statistics.');
      this.userSyncResult = result;
      this.showMessage(`User profiles synchronized: ${result.synced} of ${result.total}. Password hashes and salts were excluded.`);
    } catch (error) {
      this.showMessage(`${this.errorMessage('User profile synchronization failed', error)} Retry is safe if some profiles were already written.`, true);
    } finally {
      this.busy = false;
    }
  }

  private async syncCollections(selected: DataCollection[]): Promise<void> {
    if (!this.environmentEnabled) {
      this.showMessage('Firebase is disabled by the deployment environment.', true);
      return;
    }
    this.busy = true;
    this.hasResults = true;
    this.failedRecords = [];
    this.completedRecords = 0;
    this.results = {};
    this.message = '';
    try {
      const source = await this.dataService.readLocalCollections().toPromise();
      this.totalRecords = selected.reduce((total, collection) => total + (source[collection]?.length ?? 0), 0);
      for (const collection of selected) {
        const records = source[collection] ?? [];
        const result: CollectionResult = { total: records.length, synced: 0, skipped: 0, failed: 0 };
        this.results[collection] = result;
        for (const record of records) {
          this.progressLabel = `Syncing ${this.collectionLabels[collection]}`;
          try {
            const outcome = await this.dataService.syncRecord(collection, record).toPromise();
            if (outcome === 'created') result.synced++;
            else result.skipped++;
          } catch (error) {
            result.failed++;
            this.failedRecords.push({ collection, record });
            console.error(`Could not sync ${collection} record "${record.id}":`, error);
          }
          this.completedRecords++;
        }
      }
      if (this.totalRecords > 0) {
        await this.dataService.updateConnectedProjectSyncDate(
          this.config.projectId,
          new Date().toISOString()
        ).toPromise();
      }
      const failures = this.failedCount;
      console.info('JSON-to-Firestore synchronization completed:', {
        projectId: this.config.projectId,
        collections: this.results,
        failedRecords: failures
      });
      this.showMessage(failures
        ? `Synchronization finished with ${failures} failed record(s). Use Retry Failed Records to try again.`
        : 'Synchronization completed successfully.');
    } catch (error) {
      this.showMessage(this.errorMessage('Could not read local JSON data', error), true);
    } finally {
      this.progressLabel = '';
      this.busy = false;
    }
  }

  async retryFailed(): Promise<void> {
    const retry = [...this.failedRecords];
    this.failedRecords = [];
    this.busy = true;
    this.completedRecords = 0;
    this.totalRecords = retry.length;
    for (const item of retry) {
      this.progressLabel = `Retrying ${this.collectionLabels[item.collection]}`;
      const result = this.results[item.collection];
      try {
        const outcome = await this.dataService.syncRecord(item.collection, item.record).toPromise();
        if (result) {
          result.failed = Math.max(0, result.failed - 1);
          if (outcome === 'created') result.synced++;
          else result.skipped++;
        }
      } catch (error) {
        this.failedRecords.push(item);
        console.error(`Retry failed for ${item.collection} record "${item.record.id}":`, error);
      }
      this.completedRecords++;
    }
    this.busy = false;
    this.progressLabel = '';
    this.showMessage(this.failedCount
      ? `Retry finished with ${this.failedCount} failed record(s).`
      : 'All failed records were retried successfully.', this.failedCount > 0);
  }

  async exportBackup(): Promise<void> {
    this.busy = true;
    try {
      const data = this.firebaseEnabled
        ? await this.exportFirebaseCollections()
        : await this.dataService.readLocalCollections().toPromise();
      this.downloadJson(data, `application-backup-${new Date().toISOString().slice(0, 10)}.json`);
      this.showMessage('JSON backup exported.');
    } catch (error) {
      this.showMessage(this.errorMessage('Could not export JSON backup', error), true);
    } finally {
      this.busy = false;
    }
  }

  async importBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.busy = true;
    try {
      const value: unknown = JSON.parse(await file.text());
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Backup must be a JSON object with collection arrays.');
      }
      const data = value as Record<string, unknown>;
      const collections = this.collections.filter(collection => collection in data);
      if (!collections.length || collections.some(collection =>
        !Array.isArray(data[collection]) || (data[collection] as unknown[]).some(record =>
          !record || typeof record !== 'object' || Array.isArray(record)
        )
      )) {
        throw new Error('Backup contains no supported collection arrays or has an invalid record.');
      }
      for (const collection of collections) {
        const records = data[collection] as DataRecord[];
        for (const record of records) {
          const normalized = { ...record, id: String(record.id ?? crypto.randomUUID()) };
          if (this.firebaseEnabled) {
            await this.dataService.syncRecord(collection, normalized).toPromise();
          } else {
            await this.dataService.importJsonRecord(collection, normalized).toPromise();
          }
        }
      }
      this.showMessage(`Imported ${collections.length} collection(s) from the JSON backup.`);
    } catch (error) {
      this.showMessage(this.errorMessage('Could not import JSON backup', error), true);
    } finally {
      this.busy = false;
      input.value = '';
    }
  }

  private showMessage(message: string, isError = false): void {
    this.message = message;
    this.hasError = isError;
  }

  private errorMessage(prefix: string, error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const response = error.error as { error?: { message?: unknown }; message?: unknown } | null;
      const responseMessage = response?.error?.message ?? response?.message;
      const status = error.status
        ? `HTTP ${error.status}`
        : 'Network request failed (status 0)';
      const detail = typeof responseMessage === 'string' ? `${status}: ${responseMessage}` : status;
      return `${prefix}: ${detail}`;
    }

    const detail = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : typeof error === 'string'
          ? error
          : `Unknown error (${String(error)})`;
    return `${prefix}: ${detail}`;
  }

  private downloadJson(data: SyncCollectionData, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private async exportFirebaseCollections(): Promise<SyncCollectionData> {
    const data: SyncCollectionData = {};
    for (const collection of this.collections) {
      data[collection] = await this.dataService.list(collection).toPromise() ?? [];
    }
    return data;
  }
}
