import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { authGuard } from './login-guard.guard';

describe('authGuard', () => {
  const executeGuard = () => TestBed.runInInjectionContext(
    () => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
  );

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('redirects to login when the user has not logged in', () => {
    const result = executeGuard();

    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('allows navigation after successful login', () => {
    sessionStorage.setItem('isLoggedIn', 'true');

    expect(executeGuard()).toBeTrue();
  });

  it('does not allow navigation when login failed', () => {
    sessionStorage.setItem('isLoggedIn', 'false');

    expect(executeGuard() instanceof UrlTree).toBeTrue();
  });
});
