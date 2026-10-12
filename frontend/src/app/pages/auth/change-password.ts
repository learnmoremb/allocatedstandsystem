import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { User } from '../../core/models';

@Component({
  selector: 'app-change-password',
  imports: [FormsModule],
  template: `
    <div class="auth-page">
      <div class="auth-hero">
        <span class="brand-mark lg">SA</span>
        <h1>Set your own password</h1>
        <p>Your account was set up, or your password was reset, by an administrator. Choose a new password that only you know before continuing.</p>
      </div>
      <form class="card auth-card" (ngSubmit)="submit()">
        <h2>Change password</h2>
        <p class="muted">Signed in as <strong>{{ auth.user()?.email }}</strong></p>
        @if (error()) { <div class="alert alert-error">{{ error() }}</div> }
        <label>Temporary password <input type="password" name="cur" [(ngModel)]="currentPassword" required autocomplete="current-password" /></label>
        <label>New password <input type="password" name="new" [(ngModel)]="newPassword" required minlength="6" autocomplete="new-password" /></label>
        <label>Confirm new password <input type="password" name="confirm" [(ngModel)]="confirm" required autocomplete="new-password" /></label>
        <button class="btn btn-primary block" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Set password and continue' }}</button>
        <p class="center"><button type="button" class="link" (click)="auth.logout()">Log out</button></p>
      </form>
    </div>
  `,
})
export class ChangePassword {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  currentPassword = '';
  newPassword = '';
  confirm = '';
  busy = signal(false);
  error = signal('');

  submit() {
    if (this.newPassword.length < 6) return this.error.set('New password must be at least 6 characters');
    if (this.newPassword !== this.confirm) return this.error.set('New passwords do not match');
    this.busy.set(true);
    this.error.set('');
    this.api.put<{ user: User }>('/auth/me/password', { currentPassword: this.currentPassword, newPassword: this.newPassword }).subscribe({
      next: (r) => {
        this.auth.setUser(r.user);
        this.toast.success('Password changed');
        this.router.navigateByUrl(this.auth.landing(r.user));
      },
      error: (e) => { this.error.set(errorMessage(e)); this.busy.set(false); },
    });
  }
}
