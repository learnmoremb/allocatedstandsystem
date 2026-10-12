import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { Payment } from '../../core/models';
import { Badge } from '../../shared/badge';
import { LabelPipe, MoneyPipe } from '../../shared/pipes';

@Component({
  selector: 'app-my-payments',
  imports: [DatePipe, Badge, LabelPipe, MoneyPipe],
  template: `
    <div class="page-head"><div><h1>Payment history</h1><p class="muted">All receipts you have submitted and their approval status.</p></div></div>
    <div class="stats-row">
      <div class="card stat"><small>Approved</small><strong>{{ total('approved') | money }}</strong></div>
      <div class="card stat"><small>Awaiting approval</small><strong>{{ total('pending') | money }}</strong></div>
      <div class="card stat"><small>Rejected</small><strong>{{ total('rejected') | money }}</strong></div>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Payment date</th><th>Stand</th><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th><th>Note</th><th></th></tr></thead>
        <tbody>
          @for (p of list(); track p._id) {
            <tr>
              <td>{{ p.paymentDate | date: 'mediumDate' }}</td>
              <td>{{ p.allocation?.stand?.standNumber }} · {{ p.allocation?.stand?.area }}</td>
              <td>{{ p.amount | money }}</td><td>{{ p.method | label }}</td><td>{{ p.reference }}</td>
              <td><app-badge [value]="p.status" /></td><td class="small">{{ p.reviewNote }}</td>
              <td>@if (p.receipt) { <button class="link" (click)="api.openFile('/payments/' + p._id + '/receipt')">Receipt</button> }</td>
            </tr>
          } @empty { <tr><td colspan="8" class="muted center">No payments yet.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class MyPayments {
  api = inject(ApiService);
  list = signal<Payment[]>([]);
  private sums = computed(() => {
    const s: Record<string, number> = {};
    for (const p of this.list()) s[p.status] = (s[p.status] || 0) + p.amount;
    return s;
  });
  total = (st: string) => this.sums()[st] || 0;
  constructor() { this.api.get<Payment[]>('/payments/mine').subscribe((l) => this.list.set(l)); }
}
