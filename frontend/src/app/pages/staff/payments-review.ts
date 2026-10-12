import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Payment } from '../../core/models';
import { Badge } from '../../shared/badge';
import { LabelPipe, MoneyPipe } from '../../shared/pipes';

@Component({
  selector: 'app-payments-review',
  imports: [DatePipe, RouterLink, Badge, LabelPipe, MoneyPipe],
  template: `
    <div class="page-head"><div><h1>Payment approvals</h1><p class="muted">Verify each receipt against council records before approving. Approved amounts update the stand's payment stage automatically.</p></div></div>
    <div class="tabs">
      @for (s of statuses; track s) { <button [class.active]="status() === s" (click)="setStatus(s)">{{ s || 'all' }}</button> }
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Submitted</th><th>Payer</th><th>Stand / allocation</th><th>Amount</th><th>Method / ref</th><th>Paid on</th><th>Receipt</th><th>Status</th><th></th></tr></thead>
        <tbody>
          @for (p of list(); track p._id) {
            <tr>
              <td>{{ p.createdAt | date: 'short' }}</td>
              <td>{{ p.user?.fullName }}<div class="muted small">{{ p.user?.nationalId }}</div></td>
              <td><a [routerLink]="[auth.base(), 'allocations', p.allocation?._id]">{{ p.allocation?.stand?.standNumber }} · {{ p.allocation?.stand?.area }}</a>
                <div class="muted small">Paid {{ p.allocation?.amountPaid | money }} / {{ p.allocation?.totalAmount | money }}</div></td>
              <td><strong>{{ p.amount | money }}</strong></td>
              <td>{{ p.method | label }}<div class="muted small">{{ p.reference }}</div></td>
              <td>{{ p.paymentDate | date: 'mediumDate' }}</td>
              <td>@if (p.receipt) { <button class="link" (click)="api.openFile('/payments/' + p._id + '/receipt')">View</button> }</td>
              <td><app-badge [value]="p.status" />@if (p.reviewedBy) { <div class="muted small">by {{ p.reviewedBy.fullName }}</div> }</td>
              <td class="nowrap">
                @if (p.status === 'pending') {
                  <button class="btn sm btn-primary" (click)="review(p, true)">Approve</button>
                  <button class="btn sm btn-ghost" (click)="review(p, false)">Reject</button>
                }
              </td>
            </tr>
          } @empty { <tr><td colspan="9" class="muted center">No payments.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class PaymentsReview {
  auth = inject(AuthService);
  api = inject(ApiService);
  private toast = inject(ToastService);
  list = signal<Payment[]>([]);
  status = signal('pending');
  statuses = ['pending', 'approved', 'rejected', ''];
  constructor() { this.load(); }
  setStatus(s: string) { this.status.set(s); this.load(); }
  load() { this.api.get<Payment[]>('/payments', { status: this.status() }).subscribe((l) => this.list.set(l)); }
  review(p: Payment, approve: boolean) {
    const note = approve ? '' : prompt('Reason for rejecting (shared with the payer):');
    if (!approve && !note) return;
    this.api.patch<any>(`/payments/${p._id}/${approve ? 'approve' : 'reject'}`, { note }).subscribe({
      next: (r) => { this.toast.success(approve ? `Approved — stage now: ${r.allocation.stage.replace(/_/g, ' ')}` : 'Payment rejected'); this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
