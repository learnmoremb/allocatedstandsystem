import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { User } from '../../core/models';
import { Badge } from '../../shared/badge';

const EMPTY = { fullName: '', email: '', password: '', role: 'council', nationalId: '', phone: '' };

@Component({
  selector: 'app-users-manage',
  imports: [DatePipe, FormsModule, Badge],
  template: `
    <div class="page-head">
      <div><h1>User management</h1><p class="muted">Create council officer and administrator accounts, change roles and disable access.</p></div>
      <button class="btn btn-primary" (click)="form.set({ ...empty })">+ New user</button>
    </div>
    @if (form()) {
      <form class="card form" (ngSubmit)="create()">
        <h3>New user</h3>
        <div class="grid-3">
          <label>Full name <input name="n" [(ngModel)]="form().fullName" required /></label>
          <label>Email <input type="email" name="e" [(ngModel)]="form().email" required /></label>
          <label>Temporary password <input name="p" [(ngModel)]="form().password" required minlength="6" /></label>
          <label>Role <select name="r" [(ngModel)]="form().role"><option value="council">Council officer</option><option value="admin">Administrator</option><option value="user">General user</option></select></label>
          <label>National ID <input name="i" [(ngModel)]="form().nationalId" /></label>
          <label>Phone <input name="ph" [(ngModel)]="form().phone" /></label>
        </div>
        <div class="row gap"><button class="btn btn-primary">Create</button><button type="button" class="btn btn-ghost" (click)="form.set(null)">Cancel</button></div>
      </form>
    }
    <div class="filters">
      <input placeholder="Search…" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <div class="tabs inline">@for (r of roles; track r) { <button [class.active]="role() === r" (click)="role.set(r)">{{ r || 'all' }}</button> }</div>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>National ID</th><th>Role</th><th>Joined</th><th>Status</th><th></th></tr></thead>
        <tbody>
          @for (u of shown(); track u._id) {
            <tr [class.dim]="!u.isActive">
              <td>{{ u.fullName }}</td><td>{{ u.email }}</td><td>{{ u.nationalId }}</td>
              <td>
                @if (u._id === auth.user()?._id) { <app-badge [value]="u.role" /> }
                @else {
                  <select [ngModel]="u.role" (ngModelChange)="update(u, { role: $event })">
                    <option value="user">General user</option><option value="council">Council</option><option value="admin">Admin</option>
                  </select>
                }
              </td>
              <td>{{ u.createdAt | date: 'mediumDate' }}</td>
              <td><app-badge [value]="u.isActive ? 'active' : 'disabled'" />
                @if (u.mustChangePassword) { <div><span class="chip warn small">Must change password</span></div> }</td>
              <td class="nowrap">
                @if (u._id !== auth.user()?._id) {
                  <button class="link" [class.danger]="u.isActive" (click)="update(u, { isActive: !u.isActive })">{{ u.isActive ? 'Disable' : 'Enable' }}</button>
                  <button class="link" (click)="resetPw(u)">Reset password</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class UsersManage {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  empty = EMPTY;
  list = signal<User[]>([]);
  form = signal<any>(null);
  q = signal('');
  role = signal('');
  roles = ['', 'admin', 'council', 'user'];
  shown = computed(() => {
    const q = this.q().toLowerCase();
    return this.list().filter((u) => (!this.role() || u.role === this.role()) && (!q || [u.fullName, u.email, u.nationalId].some((v) => v?.toLowerCase().includes(q))));
  });

  constructor() { this.load(); }
  load() { this.api.get<User[]>('/users').subscribe((l) => this.list.set(l)); }
  create() {
    this.api.post('/users', this.form()).subscribe({
      next: () => { this.toast.success('User created — they must change the password at first login'); this.form.set(null); this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
  update(u: User, patch: Partial<User> & { password?: string }, done = 'User updated') {
    this.api.patch(`/users/${u._id}`, patch).subscribe({
      next: () => { this.toast.success(done); this.load(); },
      error: (e) => { this.toast.error(errorMessage(e)); this.load(); },
    });
  }
  resetPw(u: User) {
    const pw = prompt(`New password for ${u.fullName} (min 6 characters):`);
    if (pw && pw.length >= 6) this.update(u, { password: pw }, 'Password reset — they must change it at next login');
  }
}
