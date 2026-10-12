import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

export const roleGuard = (...roles: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.token()) return router.parseUrl('/login');
  if (auth.user()?.mustChangePassword) return router.parseUrl('/change-password');
  if (!roles.includes(auth.role()!)) return router.parseUrl(auth.homeFor(auth.role()));
  return true;
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.token() ? inject(Router).parseUrl(auth.landing()) : true;
};

/** The change-password screen is only for signed-in users with a pending change. */
export const passwordChangeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.token()) return router.parseUrl('/login');
  return auth.user()?.mustChangePassword ? true : router.parseUrl(auth.landing());
};
