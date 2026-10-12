import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { User } from '../../core/models';

@Component({
  selector: 'app-profile',
  imports: [FormsModule],
  template: `
    <div class="page-head"><h1>My profile</h1></div>
    <div class="grid-2 align-start">
      <form class="card form" (ngSubmit)="save()">
        <h3>Details</h3>
        <label>Full name <input name="fullName" [(ngModel)]="p.fullName" required /></label>
        <label>Email <input [value]="auth.user()?.email" disabled /></label>
        @if (auth.user()?.nationalId) { <label>National ID <input [value]="auth.user()?.nationalId" disabled /></label> }
        <label>Phone <input name="phone" [(ngModel)]="p.phone" /></label>
        <label>Address <input name="address" [(ngModel)]="p.address" /></label>
        <button class="btn btn-primary">Save</button>
      </form>
      <form class="card form" (ngSubmit)="changePw()">
        <h3>Change password</h3>
        <label>Current password <input type="password" name="cur" [(ngModel)]="pw.currentPassword" required /></label>
        <label>New password <input type="password" name="new" [(ngModel)]="pw.newPassword" required minlength="6" /></label>
        <button class="btn">Update password</button>
      </form>
    </div>
  `,
})
export class Profile {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  p = { fullName: this.auth.user()?.fullName || '', phone: this.auth.user()?.phone || '', address: this.auth.user()?.address || '' };
  pw = { currentPassword: '', newPassword: '' };

  save() {
    this.api.put<User>('/auth/me', this.p).subscribe({
      next: (u) => { this.auth.setUser(u); this.toast.success('Profile saved'); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
  changePw() {
    this.api.put<{ user: User }>('/auth/me/password', this.pw).subscribe({
      next: (r) => { this.auth.setUser(r.user); this.toast.success('Password updated'); this.pw = { currentPassword: '', newPassword: '' }; },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
