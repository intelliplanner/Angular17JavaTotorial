import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  errorMessage = '';
  isSubmitting = false;
  isLocalFirebaseBootstrap = false;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) { }

  get firebaseLoginEnabled(): boolean {
    return this.authService.isFirebaseLoginEnabled();
  }

  login(username: string, password: string): void {
    this.errorMessage = '';
    this.isSubmitting = true;
    const login = this.isLocalFirebaseBootstrap
      ? this.authService.loginWithLocalFirebaseBootstrap(username, password)
      : this.authService.login(username, password);
    login.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigateByUrl(this.isLocalFirebaseBootstrap ? '/settings/users' : '/home');
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        const providerMessage = error.error?.error?.message ?? error.error?.message;
        const code = typeof error.error?.code === 'string'
          ? error.error.code
          : typeof providerMessage === 'string'
            ? providerMessage.split(':')[0]
            : '';
        this.errorMessage = error.status === 401 ||
          ['INVALID_LOGIN_CREDENTIALS', 'EMAIL_NOT_FOUND', 'INVALID_PASSWORD'].includes(code)
          ? 'Invalid username or password.'
          : code === 'USER_DISABLED'
            ? 'This Firebase account is disabled.'
            : code === 'OPERATION_NOT_ALLOWED'
              ? 'Enable the Firebase password authentication provider.'
              : code === 'FIREBASE_AUTH_UNAVAILABLE'
                ? 'The backend is missing Firebase settings. Set FIREBASE_PROJECT_ID and FIREBASE_WEB_API_KEY in the Render service environment, then redeploy or restart the backend.'
              : typeof providerMessage === 'string'
                ? providerMessage
                : error.status === 0
                  ? 'Cannot reach the authentication service. Check the network and Firebase configuration.'
                  : `Unable to sign in (HTTP ${error.status}).`;
      }
    });
  }

  toggleFirebaseBootstrapLogin(): void {
    this.isLocalFirebaseBootstrap = !this.isLocalFirebaseBootstrap;
    this.errorMessage = '';
  }
}
