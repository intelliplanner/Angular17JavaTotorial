import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnDestroy {
  readonly loginEnabled = environment.loginEnabled;
  readonly settingsEnabled = environment.settingsEnabled;
  isLoggedIn = false;
  isAdmin = !this.loginEnabled;
  darkMode = localStorage.getItem('quiz-dark-mode') === 'true';
  isMenuOpen = false;
  isSettingsOpen = false;
  private readonly navigationSubscription: Subscription;

  constructor(
    private readonly authService: AuthService,
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
    this.isSettingsOpen = false;
  }

  toggleSettings(): void {
    this.isSettingsOpen = !this.isSettingsOpen;
  }

  logout(): void {
    this.authService.logout().subscribe({
      error: error => console.error('Could not clear the server sign-in session:', error)
    });
    this.updateLoginState();
    this.router.navigateByUrl('/login');
  }

  ngOnDestroy(): void {
    this.navigationSubscription.unsubscribe();
  }

  private updateLoginState(): void {
    const user = this.authService.user;
    this.isLoggedIn = !!user;
    this.isAdmin = !this.loginEnabled || this.authService.hasPermission('admin', user);
    this.closeMenu();
  }

  private applyTheme(): void {
    document.documentElement.dataset['theme'] = this.darkMode ? 'dark' : 'light';
  }
}
