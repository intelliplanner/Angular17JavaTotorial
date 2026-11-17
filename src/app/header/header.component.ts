import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { DataRecord, DataService } from '../services/data.service';
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
  isFirebaseBootstrap = false;
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
    this.closeMenu();
  }

  private applyTheme(): void {
    document.documentElement.dataset['theme'] = this.darkMode ? 'dark' : 'light';
  }

  private async loadFirebaseTheme(): Promise<void> {
    if (!this.dataService.isFirebaseEnabled()) return;
    try {
      const settings = await this.dataService.list<DataRecord>('userSettings').toPromise() ?? [];
      const value = settings.find(item => item.id === 'quiz-dark-mode')?.['value'];
      if (value !== undefined) {
        const normalized = typeof value === 'string' ? JSON.parse(value) as unknown : value;
        this.darkMode = normalized === true || normalized === 'true';
        this.applyTheme();
      }
    } catch (error) {
      console.error('Could not load the saved color theme:', error);
    }
  }
}
