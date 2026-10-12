import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Allocation, AppNotification, Application, Infrastructure, News } from '../../core/models';
import { Badge } from '../../shared/badge';
import { MoneyPipe } from '../../shared/pipes';
import { StageTracker } from '../../shared/stage-tracker';

interface UserDash {
  allocations: Allocation[]; applications: Application[]; pendingPayments: number;
  news: News[]; infrastructure: Infrastructure[]; notifications: AppNotification[]; areas: string[];
}

@Component({
  selector: 'app-user-dashboard',
  imports: [DatePipe, RouterLink, Badge, MoneyPipe, StageTracker],
  template: `
    <div class="page-head">
      <div><h1>Welcome, {{ auth.user()?.fullName }}</h1><p class="muted">Your stand allocation at a glance.</p></div>
      <a class="btn btn-primary" routerLink="/user/stands">Browse available stands</a>
    </div>
    @if (d(); as d) {
      @for (a of d.allocations; track a._id) {
        <div class="card">
          <div class="row between wrap">
            <div><h3>Stand {{ a.stand.standNumber }} · {{ a.stand.area }}</h3>
              <small class="muted">{{ a.allocationNumber }}</small></div>
            <a class="btn sm" [routerLink]="['/user/allocations', a._id]">View details & pay</a>
          </div>
          <app-stage-tracker [stage]="a.stage" />
          <div class="stats-4">
            <div><small class="muted">Total</small><strong>{{ a.totalAmount | money }}</strong></div>
            <div><small class="muted">Paid</small><strong class="ok">{{ a.amountPaid | money }}</strong></div>
            <div><small class="muted">Balance</small><strong [class.warn]="a.balance > 0">{{ a.balance | money }}</strong></div>
            <div><small class="muted">Progress</small><strong>{{ a.percentPaid }}%</strong></div>
          </div>
          <div class="progress"><span [style.width.%]="a.percentPaid"></span></div>
          @if (d.pendingPayments) { <p class="muted small">⏳ {{ d.pendingPayments }} receipt(s) awaiting council approval</p> }
        </div>
      } @empty {
        <div class="card empty">
          <h3>You have no stand allocated yet</h3>
          <p class="muted">Check the news for land open for allocation and apply for a stand.</p>
        </div>
      }

      <div class="grid-2 align-start">
        <div class="card">
          <div class="row between"><h3>Latest news</h3><a routerLink="/user/news">All news →</a></div>
          @for (n of d.news; track n._id) {
            <div class="list-row">
              <div><app-badge [value]="n.category" /> <strong>{{ n.title }}</strong>
                @if (n.area && d.areas.includes(n.area)) { <span class="chip warn">Affects your stand</span> }</div>
              <small class="muted">{{ n.createdAt | date: 'mediumDate' }}</small>
            </div>
          } @empty { <p class="muted">No news yet.</p> }
        </div>
        <div class="stack">
          <div class="card">
            <div class="row between"><h3>My applications</h3><a routerLink="/user/applications">All →</a></div>
            @for (ap of d.applications; track ap._id) {
              <div class="list-row"><span>Stand {{ ap.stand.standNumber }} · {{ ap.stand.area }}</span><app-badge [value]="ap.status" /></div>
            } @empty { <p class="muted">No applications.</p> }
          </div>
          <div class="card">
            <div class="row between"><h3>Infrastructure in my area</h3><a routerLink="/user/infrastructure">All →</a></div>
            @for (i of d.infrastructure; track i._id) {
              <div class="infra-row">
                <div class="row between"><span>{{ i.title }} <small class="muted">({{ i.area }})</small></span><app-badge [value]="i.status" /></div>
                <div class="progress"><span [style.width.%]="i.progress"></span></div>
              </div>
            } @empty { <p class="muted">Projects appear here once you hold a stand in an area with planned works.</p> }
          </div>
          <div class="card">
            <h3>Recent notifications</h3>
            @for (n of d.notifications; track n._id) {
              <div class="list-row col"><strong>{{ n.title }}</strong><small class="muted">{{ n.message }}</small></div>
            } @empty { <p class="muted">Nothing yet.</p> }
          </div>
        </div>
      </div>
    }
  `,
})
export class UserDashboard {
  auth = inject(AuthService);
  d = signal<UserDash | null>(null);
  constructor() {
    inject(ApiService).get<UserDash>('/dashboard/user').subscribe((d) => this.d.set(d));
  }
}
