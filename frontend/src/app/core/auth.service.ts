import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { ApiService } from './api.service';
import { Role, User } from './models';

const TOKEN_KEY = 'sas_token';
const USER_KEY = 'sas_user';

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (key === TOKEN_KEY ? (v as T) : JSON.parse(v)) : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  readonly token = signal<string | null>(read<string>(TOKEN_KEY));
  readonly user = signal<User | null>(read<User>(USER_KEY));
  readonly role = computed(() => this.user()?.role ?? null);
  readonly isStaff = computed(() => this.role() === 'admin' || this.role() === 'council');
  /** URL prefix for the role's dashboard area */
  readonly base = computed(() => (this.role() ? `/${this.role()}` : '/login'));

  login(email: string, password: string) {
    return this.api.post<{ token: string; user: User }>('/auth/login', { email, password }).pipe(tap((r) => this.setSession(r)));
  }

  register(data: any) {
    return this.api.post<{ token: string; user: User }>('/auth/register', data).pipe(tap((r) => this.setSession(r)));
  }

  refreshMe() {
    return this.api.get<User>('/auth/me').pipe(tap((u) => this.setUser(u)));
  }

  setUser(u: User) {
    this.user.set(u);
    try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch {}
  }

  private setSession(r: { token: string; user: User }) {
    this.token.set(r.token);
    try { localStorage.setItem(TOKEN_KEY, r.token); } catch {}
    this.setUser(r.user);
  }

  homeFor(role: Role | null) {
    return role ? `/${role}/dashboard` : '/login';
  }

  /** Where to send a signed-in user: the password screen if a change is pending, else their dashboard. */
  landing(user: User | null = this.user()) {
    return user?.mustChangePassword ? '/change-password' : this.homeFor(user?.role ?? null);
  }

  requirePasswordChange() {
    const u = this.user();
    if (u && !u.mustChangePassword) this.setUser({ ...u, mustChangePassword: true });
    this.router.navigateByUrl('/change-password');
  }

  logout() {
    this.token.set(null);
    this.user.set(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {}
    this.router.navigateByUrl('/login');
  }
}
