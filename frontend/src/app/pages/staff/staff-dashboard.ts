import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { STAGES } from '../../core/models';
import { MoneyPipe } from '../../shared/pipes';

interface StaffDash {
  stands: Record<string, number>; stages: Record<string, number>; users: Record<string, number>;
  pendingApplications: number; pendingPayments: number; totalValue: number; totalCollected: number; recentPayments: any[];
}

@Component({
  selector: 'app-staff-dashboard',
  imports: [DatePipe, RouterLink, MoneyPipe],
  template: `
    <div class="page-head"><div><h1>{{ auth.role() === 'admin' ? 'Administrator' : 'Council' }} dashboard</h1>
      <p class="muted">Overview of stands, allocations and payments.</p></div></div>
    @if (d(); as d) {
      <div class="stats-row">
        <a class="card stat clickable" [routerLink]="[auth.base(), 'applications']"><small>Pending applications</small><strong>{{ d.pendingApplications }}</strong></a>
        <a class="card stat clickable" [routerLink]="[auth.base(), 'payments']"><small>Receipts to verify</small><strong>{{ d.pendingPayments }}</strong></a>
        <div class="card stat"><small>Stands available</small><strong>{{ d.stands['available'] || 0 }}</strong></div>
        <div class="card stat"><small>Stands allocated</small><strong>{{ d.stands['allocated'] || 0 }}</strong></div>
      </div>
      <div class="grid-2 align-start">
        <div class="card">
          <h3>Revenue</h3>
          <div class="stats-4 two">
            <div><small class="muted">Value of allocated stands</small><strong>{{ d.totalValue | money }}</strong></div>
            <div><small class="muted">Collected (approved)</small><strong class="ok">{{ d.totalCollected | money }}</strong></div>
          </div>
          <div class="progress lg"><span [style.width.%]="collectedPct()"></span></div>
          <small class="muted">{{ collectedPct() }}% collected · outstanding {{ d.totalValue - d.totalCollected | money }}</small>

          <h3 class="mt">Allocations by payment stage</h3>
          @for (s of stages; track s.key) {
            <div class="bar-row">
              <span>{{ s.label }}</span>
              <div class="bar"><span [style.width.%]="stagePct(s.key)"></span></div>
              <strong>{{ d.stages[s.key] || 0 }}</strong>
            </div>
          }
        </div>
        <div class="stack">
          <div class="card">
            <div class="row between"><h3>Latest receipts awaiting approval</h3><a [routerLink]="[auth.base(), 'payments']">Review →</a></div>
            @for (p of d.recentPayments; track p._id) {
              <div class="list-row"><span>{{ p.user?.fullName }} — {{ p.amount | money }}</span><small class="muted">{{ p.createdAt | date: 'short' }}</small></div>
            } @empty { <p class="muted">All caught up 🎉</p> }
          </div>
          <div class="card">
            <h3>Users</h3>
            <div class="list-row"><span>General users</span><strong>{{ d.users['user'] || 0 }}</strong></div>
            <div class="list-row"><span>Council officers</span><strong>{{ d.users['council'] || 0 }}</strong></div>
            <div class="list-row"><span>Administrators</span><strong>{{ d.users['admin'] || 0 }}</strong></div>
          </div>
          <div class="card">
            <h3>Quick actions</h3>
            <div class="row gap wrap">
              <a class="btn" [routerLink]="[auth.base(), 'stands']">Add stands</a>
              <a class="btn" [routerLink]="[auth.base(), 'news']">Post news</a>
              <a class="btn" [routerLink]="[auth.base(), 'duplicates']">Check duplicates</a>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class StaffDashboard {
  auth = inject(AuthService);
  d = signal<StaffDash | null>(null);
  stages = STAGES;
  collectedPct = computed(() => (this.d()?.totalValue ? Math.round((this.d()!.totalCollected / this.d()!.totalValue) * 100) : 0));
  private maxStage = computed(() => Math.max(1, ...Object.values(this.d()?.stages || {})));
  stagePct = (k: string) => ((this.d()?.stages[k] || 0) / this.maxStage()) * 100;
  constructor() { inject(ApiService).get<StaffDash>('/dashboard/staff').subscribe((d) => this.d.set(d)); }
}
