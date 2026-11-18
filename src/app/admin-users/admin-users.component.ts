import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminUserService, ManagedUserRole } from '../services/admin-user.service';
import { DataService } from '../services/data.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="users-page">
      <header class="page-heading">
        <p class="eyebrow">SETTINGS</p>
        <h1>{{ isBootstrapMode ? 'Initial Firebase Setup' : 'User Management' }}</h1>
        <p>{{ isBootstrapMode
          ? 'Create the first Firebase administrator. Then sign out and use Firebase username/password sign-in.'
          : 'Create Firebase accounts with username and password sign-in.' }}</p>
      </header>

      <p *ngIf="message" class="notice" [class.error]="hasError" role="status">{{ message }}</p>

      <section class="user-card" aria-labelledby="create-user-heading">
        <p class="eyebrow">{{ isBootstrapMode ? 'ONE-TIME SETUP' : 'ADMINISTRATION' }}</p>
        <h2 id="create-user-heading">{{ isBootstrapMode ? 'Create first administrator' : 'Add user' }}</h2>
        <p *ngIf="!isBootstrapMode" class="description">
          Usernames are unique regardless of letter case. Passwords must be at least 8 characters and are checked
          for uniqueness among users created through this panel. Existing Firebase passwords cannot be checked.
          Firebase Authentication stores the password; the server keeps only a keyed uniqueness digest.
        </p>
        <p *ngIf="isBootstrapMode" class="description">
          This creates an administrator directly in Firebase. Bootstrap access is automatically rejected after the
          first administrator is created.
        </p>

        <p *ngIf="!firebaseEnabled" class="notice error" role="alert">
          Firebase is disabled in this deployment. Enable Firebase before creating Firebase users.
        </p>

        <form *ngIf="firebaseEnabled" (ngSubmit)="createUser()">
          <label>
            Username
            <input [(ngModel)]="username" name="username" type="text" autocomplete="off"
              minlength="3" maxlength="32" pattern="[A-Za-z0-9._-]{3,32}" required>
            <small>3–32 letters, numbers, dots, underscores, or hyphens.</small>
          </label>

          <label>
            Password
            <input [(ngModel)]="password" name="password" type="password" autocomplete="new-password"
              minlength="8" maxlength="128" required>
            <small>Use a unique password of at least 8 characters.</small>
          </label>

          <label *ngIf="!isBootstrapMode">
            Role
            <select [(ngModel)]="role" name="role" required>
              <option value="learner">Learner</option>
              <option value="admin">Administrator</option>
            </select>
          </label>

          <button type="submit" [disabled]="busy">
            {{ busy ? 'Creating user…' : isBootstrapMode ? 'Create first Firebase admin' : 'Create user' }}
          </button>
        </form>
      </section>
    </main>
  `,
  styles: [`
    :host{display:block;color:#203746}
    .users-page{max-width:760px;margin:36px auto;padding:0 20px 56px}
    .page-heading{margin-bottom:24px}.page-heading h1{margin:0;color:#173b4e;font-size:2rem;font-weight:750}
    .page-heading>p:last-child,.description{color:#607586;line-height:1.55}
    .eyebrow{margin:0 0 7px;color:#278079;font-size:.7rem;font-weight:800;letter-spacing:.11em}
    .user-card{padding:24px;border:1px solid #e0e9ed;border-radius:14px;background:#fff;box-shadow:0 8px 26px #24404c0b}
    .user-card h2{margin:0;font-size:1.3rem}.description{margin:14px 0 20px}
    form{display:grid;gap:16px}label{display:grid;gap:6px;color:#435b6b;font-size:.84rem;font-weight:700}
    input,select{width:100%;padding:10px 11px;border:1px solid #d5e0e5;border-radius:8px;color:#263f4c;background:#fff;font:inherit;font-weight:400}
    label small{color:#718591;font-size:.76rem;font-weight:400}
    button{justify-self:start;min-height:40px;padding:8px 16px;border:1px solid #1d6e69;border-radius:8px;background:#1d6e69;color:#fff;font:inherit;font-size:.84rem;font-weight:700;cursor:pointer}
    button:disabled{opacity:.55;cursor:not-allowed}
    .notice{margin:16px 0;padding:12px 14px;border-radius:8px;background:#e8f6f1;color:#216b4b}
    .notice.error{background:#fff0ee;color:#a33d32}
    [data-theme=dark] :host{color:#dbe5e9}[data-theme=dark] .user-card{border-color:#384b57;background:#1e303b}
    [data-theme=dark] .page-heading h1,[data-theme=dark] .user-card h2{color:#e6eff3}
    [data-theme=dark] .description,[data-theme=dark] .page-heading>p:last-child{color:#adbec7}
    [data-theme=dark] input,[data-theme=dark] select{border-color:#40535e;background:#243843;color:#dce7ec}
    @media(max-width:620px){.users-page{margin-top:24px;padding:0 14px 40px}.user-card{padding:18px}}
  `]
})
export class AdminUsersComponent {
  username = '';
  password = '';
  role: ManagedUserRole = 'learner';
  busy = false;
  message = '';
  hasError = false;
  readonly firebaseEnabled: boolean;
  isBootstrapMode: boolean;

  constructor(
    private readonly adminUserService: AdminUserService,
    dataService: DataService,
    authService: AuthService
  ) {
    this.firebaseEnabled = true;//dataService.isFirebaseEnabled();
    this.isBootstrapMode = authService.isFirebaseBootstrapUser();
  }

  createUser(): void {
    this.message = '';
    this.hasError = false;
    this.busy = true;
    const createUser = this.isBootstrapMode
      ? this.adminUserService.createBootstrapAdmin(this.username, this.password)
      : this.adminUserService.createUser(this.username, this.password, this.role);
    createUser.subscribe({
      next: user => {
        this.busy = false;
        this.username = '';
        this.password = '';
        this.role = 'learner';
        this.message = this.isBootstrapMode
          ? `Created the first Firebase administrator "${user.username}". Sign out and sign in with this Firebase username and password.`
          : `Created ${user.role} account "${user.username}".`;
      },
      error: (error: HttpErrorResponse | Error) => {
        this.busy = false;
        this.hasError = true;
        const apiMessage = error instanceof HttpErrorResponse
          ? error.error?.message
          : error.message;
        this.message = typeof apiMessage === 'string' ? apiMessage : 'Could not create the user.';
      }
    });
  }
}
