import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../environments/environment';

function authorize(permission?: string) {
  if (!environment.loginEnabled) {
    return true;
  }

  const router = inject(Router);
  const authService = inject(AuthService);

  return authService.getSession().pipe(map(user => {
    if (!user) {
      return router.createUrlTree(['/login']);
    }

    if (permission && !authService.hasPermission(permission, user)) {
      return router.createUrlTree(['/home']);
    }
    return true;
  }));
}

export const loginPageGuard: CanActivateFn = () =>
  environment.loginEnabled ? true : inject(Router).createUrlTree(['/home']);

export const authGuard: CanActivateFn = route => {
  const permission = route.data['permission'];
  return authorize(typeof permission === 'string' ? permission : undefined);
};

export const authChildGuard: CanActivateChildFn = childRoute => {
  const permission = childRoute.data['permission'];
  return authorize(typeof permission === 'string' ? permission : undefined);
};
