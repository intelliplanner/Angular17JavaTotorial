import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';

import { AuthService, AuthUser } from './auth.service';
import { authChildGuard, authGuard } from './login-guard.guard';

describe('auth guards', () => {
  let authService: jasmine.SpyObj<AuthService>;

  const learner: AuthUser = {
    username: 'test',
    role: 'learner',
    permissions: ['home', 'learn', 'practiceQuiz']
  };
  const admin: AuthUser = {
    username: 'admin',
    role: 'admin',
    permissions: ['*']
  };

  const executeGuard = (permission?: string) => TestBed.runInInjectionContext(
    () => authGuard({ data: permission ? { permission } : {} } as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
  );
  const executeChildGuard = (permission: string) => TestBed.runInInjectionContext(
    () => authChildGuard({ data: { permission } } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
  );
  const resolveGuardResult = (result: ReturnType<typeof executeGuard>) =>
    (result as Observable<boolean | UrlTree>).toPromise();

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['getSession', 'hasPermission']);
    authService.hasPermission.and.callFake((permission, user) =>
      !!user && (user.permissions.includes('*') || user.permissions.includes(permission))
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService }
      ]
    });
  });

  it('redirects unauthenticated users to login', async () => {
    authService.getSession.and.returnValue(of(null));

    const result = await resolveGuardResult(executeGuard());

    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('allows a learner to access the home permission', async () => {
    authService.getSession.and.returnValue(of(learner));

    expect(await resolveGuardResult(executeGuard('home'))).toBeTrue();
  });

  it('allows learners to practice quizzes and learn', async () => {
    authService.getSession.and.returnValue(of(learner));

    expect(await resolveGuardResult(executeChildGuard('learn'))).toBeTrue();
    expect(await resolveGuardResult(executeChildGuard('practiceQuiz'))).toBeTrue();
  });

  it('redirects a learner without permission to home', async () => {
    authService.getSession.and.returnValue(of(learner));

    const result = await resolveGuardResult(executeChildGuard('admin'));

    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/home');
  });

  it('allows administrators full access', async () => {
    authService.getSession.and.returnValue(of(admin));

    expect(await resolveGuardResult(executeChildGuard('admin'))).toBeTrue();
  });
});
