import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { getAuthApiUrl } from '../auth-api-url';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnDestroy {
  isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  darkMode = localStorage.getItem('quiz-dark-mode') === 'true';
  isMenuOpen = false;
  private readonly navigationSubscription: Subscription;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    this.applyTheme();
    this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.updateLoginState());
  }

  toggleTheme(): void {
    this.darkMode = !this.darkMode;
    localStorage.setItem('quiz-dark-mode', String(this.darkMode));
    this.applyTheme();
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  login(): void {
    this.updateLoginState();
  }

  logout(): void {
    sessionStorage.removeItem('isLoggedIn');
    this.isLoggedIn = false;
    this.router.navigateByUrl('/login');

    const authApiUrl = getAuthApiUrl();
    if (authApiUrl) {
      this.http.post(`${authApiUrl}/auth/logout`, {}, { withCredentials: true }).subscribe({
        error: error => console.error('Could not clear the server sign-in session:', error)
      });
    }
  }

  ngOnDestroy(): void {
    this.navigationSubscription.unsubscribe();
  }

  private updateLoginState(): void {
    this.isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    this.closeMenu();
  }

  private applyTheme(): void {
    document.documentElement.dataset['theme'] = this.darkMode ? 'dark' : 'light';
  }
}
