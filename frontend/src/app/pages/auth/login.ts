import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/api.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-hero">
        <span class="brand-mark lg">SA</span>
        <h1>Stand Allocation Tracking System</h1>
        <p>Apply for council land, track your allocation status and payments, and stay informed on planned infrastructure in your area.</p>
      </div>
      <form class="card auth-card" (ngSubmit)="submit()">
        <h2>Sign in</h2>
        <p class="muted"></p>
        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
        <label>Email <input type="email" name="email" [(ngModel)]="email" required autocomplete="username" /></label>
        <label>Password <input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" /></label>
        <button class="btn btn-primary block" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
        <p class="muted center">New resident? <a routerLink="/register">Create an account</a></p>
      </form>
    </div>
  `,
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);
  email = '';
  password = '';
  busy = signal(false);
  error = signal('');

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: (r) => this.router.navigateByUrl(this.auth.landing(r.user)),
      error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); },
    });
  }
}
