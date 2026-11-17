import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { DataRecord, DataService } from '../services/data.service';
darkMode = localStorage.getItem('quiz-dark-mode') === 'true';
  isMenuOpen = false;
  isSettingsOpen = false;
  private readonly navigationSubscription: Subscription;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly dataService: DataService
  ) {
    this.applyTheme();
    void this.loadFirebaseTheme();
this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.updateLoginState());
  }

  async toggleTheme(): Promise<void> {
    const updated = !this.darkMode;
    try {
      if (this.dataService.isFirebaseEnabled()) {
        await this.dataService.importJsonRecord('userSettings', {
          id: 'quiz-dark-mode',
          value: String(updated)
        }).toPromise();
      } else {
        localStorage.setItem('quiz-dark-mode', String(updated));
      }
      this.darkMode = updated;
      this.applyTheme();
    } catch (error) {
      console.error('Could not save the selected color theme:', error);
    }
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
    this.isFirebaseBootstrap = this.authService.isFirebaseBootstrapUser(user);
}
}
