import { AfterViewInit, Component, ElementRef, NgZone, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';

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
}
