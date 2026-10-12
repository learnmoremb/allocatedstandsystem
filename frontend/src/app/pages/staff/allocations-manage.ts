import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Allocation, STAGES, Stand, User } from '../../core/models';
import { Badge } from '../../shared/badge';
import { MoneyPipe } from '../../shared/pipes';

@Component({
  selector: 'app-allocations-manage',
  imports: [DatePipe, FormsModule, RouterLink, Badge, MoneyPipe],
  template: `
    <div class="page-head">
      <div><h1>Allocations</h1><p class="muted">Track every allocated stand through to final payment.</p></div>
      <button class="btn btn-primary" (click)="openDirect()">+ Direct allocation</button>
    </div>
    <div class="filters">
      <input placeholder="Search name, ID, stand…" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <select [ngModel]="stage()" (ngModelChange)="stage.set($event)"><option value="">All stages</option>@for (s of stages; track s.key) { <option [value]="s.key">{{ s.label }}</option> }</select>
      <select [ngModel]="status()" (ngModelChange)="status.set($event)"><option value="">All statuses</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>No.</th><th>Holder</th><th>Stand</th><th>Allocated</th><th>Paid</th><th>Balance</th><th>Stage</th><th>Status</th></tr></thead>
        <tbody>
          @for (a of shown(); track a._id) {
            <tr>
              <td><a [routerLink]="[auth.base(), 'allocations', a._id]">{{ a.allocationNumber }}</a></td>
              <td>{{ a.user?.fullName }}<div class="muted small">{{ a.user?.nationalId }}</div></td>
              <td>{{ a.stand?.standNumber }} · {{ a.stand?.area }}</td>
              <td>{{ a.allocatedAt | date: 'mediumDate' }}</td>
              <td>{{ a.amountPaid | money }}<div class="progress thin"><span [style.width.%]="a.percentPaid"></span></div></td>
              <td>{{ a.balance | money }}</td>
              <td><app-badge [value]="a.stage" /></td>
              <td><app-badge [value]="a.status" /></td>
            </tr>
          } @empty { <tr><td colspan="8" class="muted center">No allocations.</td></tr> }
        </tbody>
      </table>
    </div>

    @if (direct()) {
      <div class="modal-bg" (click)="direct.set(false)">
        <form class="card modal" (click)="$event.stopPropagation()" (ngSubmit)="allocate()">
          <h3>Allocate a stand directly</h3>
          <label>Resident
            <select name="u" [(ngModel)]="userId" required>
              <option value="">Select…</option>
              @for (u of users(); track u._id) { <option [value]="u._id">{{ u.fullName }} — {{ u.nationalId }}</option> }
            </select>
          </label>
          <label>Available stand
            <select name="s" [(ngModel)]="standId" required>
              <option value="">Select…</option>
              @for (s of freeStands(); track s._id) { <option [value]="s._id">{{ s.area }} — {{ s.standNumber }} ({{ s.price | money }})</option> }
            </select>
          </label>
          @if (dupDetails()) {
            <div class="alert alert-warn">
              <strong>Possible duplicate person:</strong>
              @for (m of dupDetails(); track $index) { <div>{{ m.holder.fullName }} already holds stand {{ m.stand?.standNumber }} ({{ m.reasons.join(', ') }})</div> }
              <label class="check"><input type="checkbox" name="ov" [(ngModel)]="override" /> Allocate anyway</label>
            </div>
          }
          <div class="row gap"><button class="btn btn-primary">Allocate</button><button type="button" class="btn btn-ghost" (click)="direct.set(false)">Cancel</button></div>
        </form>
      </div>
    }
  `,
})
export class AllocationsManage {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  stages = STAGES;
  list = signal<Allocation[]>([]);
  q = signal('');
  stage = signal('');
  status = signal('');
  direct = signal(false);
  users = signal<User[]>([]);
  freeStands = signal<Stand[]>([]);
  dupDetails = signal<any[] | null>(null);
  userId = '';
  standId = '';
  override = false;

  shown = computed(() => {
    const q = this.q().toLowerCase();
    return this.list().filter((a) =>
      (!this.stage() || a.stage === this.stage()) && (!this.status() || a.status === this.status()) &&
      (!q || [a.allocationNumber, a.user?.fullName, a.user?.nationalId, a.stand?.standNumber, a.stand?.area].some((v) => v?.toLowerCase().includes(q))));
  });

  constructor() { this.load(); }
  load() { this.api.get<Allocation[]>('/allocations').subscribe((l) => this.list.set(l)); }

  openDirect() {
    this.direct.set(true);
    this.dupDetails.set(null);
    this.override = false;
    this.api.get<User[]>('/users', { role: 'user' }).subscribe((u) => this.users.set(u.filter((x) => x.role === 'user')));
    this.api.get<Stand[]>('/stands', { status: 'available' }).subscribe((s) => this.freeStands.set(s));
  }
  allocate() {
    this.api.post('/allocations', { userId: this.userId, standId: this.standId, override: this.override }).subscribe({
      next: () => { this.toast.success('Stand allocated'); this.direct.set(false); this.load(); },
      error: (e) => {
        if (e.error?.code === 'POSSIBLE_DUPLICATE_PERSON') this.dupDetails.set(e.error.details);
        else this.toast.error(errorMessage(e));
      },
    });
  }
}
