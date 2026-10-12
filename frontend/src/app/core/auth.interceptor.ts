import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authReq).pipe(
    catchError((err) => {
      if (err.status === 401 && token && !req.url.includes('/auth/login')) auth.logout();
      else if (err.status === 403 && err.error?.code === 'PASSWORD_CHANGE_REQUIRED') auth.requirePasswordChange();
      return throwError(() => err);
    })
  );
};
