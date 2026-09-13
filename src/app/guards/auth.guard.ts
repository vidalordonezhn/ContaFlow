import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiAuthService } from '../services/api-auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(ApiAuthService);
  const router = inject(Router);

  if (authService.currentUser()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const loginGuard: CanActivateFn = (route, state) => {
  const authService = inject(ApiAuthService);
  const router = inject(Router);

  if (authService.currentUser()) {
    return router.createUrlTree(['/usuarios']);
  }

  return true;
};
