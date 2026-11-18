import { AfterViewInit, Component, ElementRef, NgZone, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        nonce: string;
        callback: (response: GoogleCredentialResponse) => void;
      }): void;
      renderButton(element: HTMLElement, options: {
        theme: 'outline';
        size: 'large';
        text: 'continue_with';
        shape: 'rectangular';
        width: string;
      }): void;
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
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements AfterViewInit {
  @ViewChild('googleSignInButton')
  private googleSignInButton!: ElementRef<HTMLDivElement>;

  errorMessage = '';
  googleErrorMessage = '';
  isSubmitting = false;
  isLocalFirebaseBootstrap = false;
  readonly firebaseLoginEnabled = environment.enableFirebase;
  readonly googleLoginEnabled = !!environment.googleClientId;
  private googleScriptPromise?: Promise<GoogleIdentityApi>;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly zone: NgZone
  ) { }

  ngAfterViewInit(): void {
    if (this.googleLoginEnabled) {
      this.prepareGoogleSignIn();
    }
  }

  login(username: string, password: string): void {
    this.errorMessage = '';
    this.isSubmitting = true;

    const request = this.isLocalFirebaseBootstrap
      ? this.authService.loginWithLocalFirebaseBootstrap(username, password)
      : this.authService.login(username, password);

    request.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigateByUrl('/home');
      },
      error: (error: HttpErrorResponse | Error) => {
        this.isSubmitting = false;
        const apiMessage = error instanceof HttpErrorResponse ? error.error?.message : error.message;
        this.errorMessage = error instanceof HttpErrorResponse && error.status === 401
          ? 'Invalid username or password.'
          : typeof apiMessage === 'string' && apiMessage.length > 0
            ? apiMessage
            : error instanceof HttpErrorResponse && error.status === 0
              ? 'Cannot reach the authentication server. Check that it is running and configured.'
              : 'Unable to sign in.';
      }
    });
  }

  toggleFirebaseBootstrapLogin(): void {
    this.isLocalFirebaseBootstrap = !this.isLocalFirebaseBootstrap;
    this.errorMessage = '';
  }

  retryGoogleSignIn(): void {
    this.prepareGoogleSignIn();
  }

  private prepareGoogleSignIn(): void {
    this.googleErrorMessage = '';
    this.authService.getGoogleSignInNonce().subscribe({
      next: nonce => {
        this.loadGoogleIdentityApi().then(google => {
          google.accounts.id.initialize({
            client_id: environment.googleClientId,
            nonce,
            callback: response => this.zone.run(() => this.completeGoogleSignIn(response, nonce))
          });
          const element = this.googleSignInButton.nativeElement;
          element.replaceChildren();
          google.accounts.id.renderButton(element, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: '320'
          });
        }).catch(error => {
          this.googleErrorMessage = error instanceof Error
            ? error.message
            : 'Could not load Google sign-in. Please try again.';
        });
      },
      error: error => {
        this.googleErrorMessage = this.signInErrorMessage(error);
      }
    });
  }

  private completeGoogleSignIn(response: GoogleCredentialResponse, nonce: string): void {
    if (!response.credential) {
      this.googleErrorMessage = 'Google did not return a sign-in credential. Please try again.';
      return;
    }

    this.isSubmitting = true;
    this.googleErrorMessage = '';
    this.authService.loginWithGoogle(response.credential, nonce).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigateByUrl('/home');
      },
      error: error => {
        this.isSubmitting = false;
        this.googleErrorMessage = this.signInErrorMessage(error);
      }
    });
  }

  private signInErrorMessage(error: HttpErrorResponse | Error): string {
    const apiMessage = error instanceof HttpErrorResponse ? error.error?.message : error.message;
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return 'Google sign-in could not be verified. Please try again.';
    }
    return typeof apiMessage === 'string' && apiMessage.length > 0
      ? apiMessage
      : error instanceof HttpErrorResponse && error.status === 0
        ? 'Cannot reach the authentication server. Check that it is running and configured.'
        : 'Unable to sign in with Google.';
  }

  private loadGoogleIdentityApi(): Promise<GoogleIdentityApi> {
    if (window.google) {
      return Promise.resolve(window.google);
    }
    if (this.googleScriptPromise) {
      return this.googleScriptPromise;
    }

    this.googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google) {
          resolve(window.google);
          return;
        }
        this.googleScriptPromise = undefined;
        reject(new Error('Google sign-in did not initialize. Please try again.'));
      };
      script.onerror = () => {
        this.googleScriptPromise = undefined;
        reject(new Error('Could not load Google sign-in. Check your internet connection.'));
      };
      document.head.appendChild(script);
    });
    return this.googleScriptPromise;
  }
}
