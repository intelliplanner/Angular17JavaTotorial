import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { getAuthApiUrl } from '../auth-api-url';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleNonceResponse {
  nonce: string;
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        nonce?: string;
        callback: (response: GoogleCredentialResponse) => void;
      }): void;
      renderButton(
        element: HTMLElement,
        options: { theme: string; size: string; text: string; shape: string; width: number }
      ): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('googleButton', { static: true }) googleButton!: ElementRef<HTMLDivElement>;

  errorMessage = '';
  isGoogleSubmitting = false;
  private isDestroyed = false;
  private nonce = '';

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) { }

  login(username: string, password: string): void {
    if (username === 'admin' && password === 'admin') {
      sessionStorage.setItem('isLoggedIn', 'true');
      this.router.navigateByUrl('/dashboard');
      return;
    }

    sessionStorage.setItem('isLoggedIn', 'false');
    this.errorMessage = 'Invalid username or password.';
  }

  ngAfterViewInit(): void {
    if (!environment.googleClientId) {
      this.errorMessage = 'Google sign-in is not configured. Add the Google OAuth client ID to the app environment.';
      return;
    }

    if (!getAuthApiUrl()) {
      this.errorMessage = 'Google sign-in is not configured for this deployment. Configure the authentication API URL.';
      this.initializeGoogleButton();
      return;
    }

    this.http.get<GoogleNonceResponse>(
      `${getAuthApiUrl()}/auth/google/nonce`,
      { withCredentials: true }
    ).subscribe({
      next: response => {
        if (!response.nonce) {
          this.errorMessage = 'The authentication server returned an invalid Google sign-in challenge. Restart the backend and try again.';
          this.initializeGoogleButton();
          return;
        }
        this.nonce = response.nonce;
        this.initializeGoogleButton();
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.errorMessage = 'The authentication server is outdated. Restart it from this project and try again.';
        } else if (error.status === 0) {
          this.errorMessage = 'Cannot reach the authentication server. Start the backend and check its URL and CORS settings.';
        } else {
          this.errorMessage = error.error?.message || 'Could not initialize Google sign-in. Check the authentication server.';
        }
        this.initializeGoogleButton();
      }
    });
  }

  private initializeGoogleButton(): void {
    this.loadGoogleIdentity().then(() => {
      if (this.isDestroyed || !window.google) {
        return;
      }

      const options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        nonce?: string;
      } = {
        client_id: environment.googleClientId,
        callback: response => this.onGoogleCredential(response)
      };
      if (this.nonce) {
        options.nonce = this.nonce;
      }

      window.google.accounts.id.initialize(options);
      window.google.accounts.id.renderButton(this.googleButton.nativeElement, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: Math.min(this.googleButton.nativeElement.clientWidth || 380, 380)
      });
    }).catch(() => {
      if (!this.isDestroyed) {
        this.errorMessage = 'Could not load Google sign-in. Check your connection and try again.';
      }
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
  }

  private loadGoogleIdentity(): Promise<void> {
    if (window.google) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const scriptId = 'google-identity-services';
      const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
      const script = existingScript || document.createElement('script');

      script.addEventListener('load', () => window.google ? resolve() : reject(new Error('Google Identity Services unavailable')), { once: true });
      script.addEventListener('error', () => reject(new Error('Google Identity Services failed to load')), { once: true });

      if (!existingScript) {
        script.id = scriptId;
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    });
  }

  private onGoogleCredential(response: GoogleCredentialResponse): void {
    if (!getAuthApiUrl()) {
      this.errorMessage = 'The Google button is ready, but sign-in cannot finish until the authentication backend is deployed and configured.';
      return;
    }
    if (!this.nonce) {
      this.errorMessage = 'Google sign-in could not connect to the authentication backend. Please try again later.';
      return;
    }

    this.errorMessage = '';
    this.isGoogleSubmitting = true;
    this.http.post<{ authenticated: boolean }>(
      `${getAuthApiUrl()}/auth/google/verify`,
      { credential: response.credential, nonce: this.nonce },
      { withCredentials: true }
    ).subscribe({
      next: result => {
        this.isGoogleSubmitting = false;
        if (!result.authenticated) {
          this.errorMessage = 'Google sign-in could not be verified. Please try again.';
          return;
        }

        sessionStorage.setItem('isLoggedIn', 'true');
        this.router.navigateByUrl('/dashboard');
      },
      error: (error: HttpErrorResponse) => {
        this.isGoogleSubmitting = false;
        this.errorMessage = error.error?.message || 'Could not complete Google sign-in. Please try again.';
      }
    });
  }
}
