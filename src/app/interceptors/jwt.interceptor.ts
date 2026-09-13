import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ApiAuthService } from '../services/api-auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(ApiAuthService);
  const token = authService.getToken();

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req);
};
