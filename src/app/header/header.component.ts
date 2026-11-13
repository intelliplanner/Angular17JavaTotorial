import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnDestroy {
  isLoggedIn = false;
  isAdmin = false;
  darkMode = localStorage.getItem('quiz-dark-mode') === 'true';
  isMenuOpen = false;
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
    this.isAdmin = this.authService.hasPermission('admin', user);
    this.closeMenu();
  }

  private applyTheme(): void {
    document.documentElement.dataset['theme'] = this.darkMode ? 'dark' : 'light';
  }
}
