import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/api.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-hero">
        <span class="brand-mark lg">SA</span>
        <h1>Create your resident account</h1>
        <p>Your national ID links your applications and allocations. Only one account is allowed per national ID.</p>
      </div>
      <form class="card auth-card" (ngSubmit)="submit()">
        <h2>Register</h2>
        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
        <label>Full name <input name="fullName" [(ngModel)]="f.fullName" required /></label>
        <label>National ID <input name="nationalId" [(ngModel)]="f.nationalId" required placeholder="e.g. 63-123456A78" /></label>
        <div class="grid-2">
          <label>Email <input type="email" name="email" [(ngModel)]="f.email" required /></label>
          <label>Phone <input name="phone" [(ngModel)]="f.phone" /></label>
        </div>
        <label>Address <input name="address" [(ngModel)]="f.address" /></label>
        <div class="grid-2">
          <label>Password <input type="password" name="password" [(ngModel)]="f.password" required minlength="6" /></label>
          <label>Confirm password <input type="password" name="confirm" [(ngModel)]="confirm" required /></label>
        </div>
        <button class="btn btn-primary block" [disabled]="busy()">{{ busy() ? 'Creating…' : 'Create account' }}</button>
        <p class="muted center">Already registered? <a routerLink="/login">Sign in</a></p>
      </form>
    </div>
  `,
})
export class Register {
  private auth = inject(AuthService);
  private router = inject(Router);
  f = { fullName: '', nationalId: '', email: '', phone: '', address: '', password: '' };
  confirm = '';
  busy = signal(false);
  error = signal('');

  submit() {
    if (this.f.password !== this.confirm) return this.error.set('Passwords do not match');
    this.busy.set(true);
    this.error.set('');
    this.auth.register(this.f).subscribe({
      next: () => this.router.navigateByUrl('/user/dashboard'),
      error: (e) => {
        this.error.set(errorMessage(e));
        this.busy.set(false);
      },
    });
  }
}
