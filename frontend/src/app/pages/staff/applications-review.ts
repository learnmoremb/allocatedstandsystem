import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService, errorMessage } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Application } from '../../core/models';
import { Badge } from '../../shared/badge';
import { MoneyPipe } from '../../shared/pipes';

@Component({
  selector: 'app-applications-review',
  imports: [DatePipe, Badge, MoneyPipe],
  template: `
    <div class="page-head"><div><h1>Stand applications</h1><p class="muted">Approving an application allocates the stand. A stand can only ever be allocated once.</p></div></div>
    <div class="tabs">
      @for (s of statuses; track s) { <button [class.active]="status() === s" (click)="setStatus(s)">{{ s || 'all' }}</button> }
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Applicant</th><th>National ID</th><th>Stand</th><th>Price</th><th>Competing</th><th>Status</th><th></th></tr></thead>
        <tbody>
          @for (a of list(); track a._id) {
            <tr>
              <td>{{ a.createdAt | date: 'mediumDate' }}</td>
              <td><strong>{{ a.applicant?.fullName }}</strong><div class="muted small">{{ a.applicant?.email }}</div>
                @if (a.motivation) { <div class="small">“{{ a.motivation }}”</div> }</td>
              <td>{{ a.applicant?.nationalId }}</td>
              <td>{{ a.stand?.standNumber }} · {{ a.stand?.area }}
                @if (a.stand?.status !== 'available') { <div><app-badge [value]="a.stand.status" /></div> }</td>
              <td>{{ a.stand?.price | money }}</td>
              <td>@if ((a.competingApplications || 0) > 1) { <span class="chip warn">{{ a.competingApplications }} applicants</span> }</td>
              <td><app-badge [value]="a.status" />@if (a.reviewNote) { <div class="muted small">{{ a.reviewNote }}</div> }</td>
              <td class="nowrap">
                @if (a.status === 'pending') {
                  <button class="btn sm btn-primary" (click)="approve(a)">Approve & allocate</button>
                  <button class="btn sm btn-ghost" (click)="reject(a)">Reject</button>
                }
              </td>
            </tr>
          } @empty { <tr><td colspan="8" class="muted center">No applications.</td></tr> }
        </tbody>
      </table>
    </div>

    @if (dupWarning(); as w) {
      <div class="modal-bg" (click)="dupWarning.set(null)">
        <div class="card modal" (click)="$event.stopPropagation()">
          <h3>⚠️ Possible duplicate person</h3>
          <p>{{ w.app.applicant.fullName }} closely matches someone who already holds a stand:</p>
          @for (m of w.details; track $index) {
            <div class="sub-card">
              <strong>{{ m.holder.fullName }}</strong> ({{ m.holder.nationalId || 'no ID' }}, {{ m.holder.email }}) —
              stand {{ m.stand?.standNumber }}, {{ m.stand?.area }}<br />
              <small class="muted">Match {{ m.score * 100 }}%: {{ m.reasons.join(', ') }}</small>
            </div>
          }
          <p class="muted">Allocating anyway may give the same person two stands.</p>
          <div class="row gap">
            <button class="btn btn-danger" (click)="approve(w.app, true)">Allocate anyway</button>
            <button class="btn btn-ghost" (click)="dupWarning.set(null)">Cancel</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ApplicationsReview {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  list = signal<Application[]>([]);
  status = signal('pending');
  statuses = ['pending', 'approved', 'rejected', 'withdrawn', ''];
  dupWarning = signal<{ app: Application; details: any[] } | null>(null);

  constructor() { this.load(); }
  setStatus(s: string) { this.status.set(s); this.load(); }
  load() { this.api.get<Application[]>('/applications', { status: this.status() }).subscribe((l) => this.list.set(l)); }

  approve(a: Application, override = false) {
    this.dupWarning.set(null);
    this.api.patch(`/applications/${a._id}/approve`, { override }).subscribe({
      next: () => { this.toast.success(`Stand ${a.stand.standNumber} allocated to ${a.applicant.fullName}`); this.load(); },
      error: (e) => {
        if (e.error?.code === 'POSSIBLE_DUPLICATE_PERSON') this.dupWarning.set({ app: a, details: e.error.details });
        else { this.toast.error(errorMessage(e)); this.load(); }
      },
    });
  }
  reject(a: Application) {
    const note = prompt('Reason for rejection (shared with the applicant):') ?? undefined;
    if (note === undefined) return;
    this.api.patch(`/applications/${a._id}/reject`, { note }).subscribe({
      next: () => { this.toast.success('Application rejected'); this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
