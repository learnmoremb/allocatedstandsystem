import { Component, inject, input, signal, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Allocation, Infrastructure, Payment, STAGES } from '../../core/models';
import { Badge } from '../../shared/badge';
import { LabelPipe, MoneyPipe } from '../../shared/pipes';
import { StageTracker } from '../../shared/stage-tracker';

@Component({
  selector: 'app-allocation-detail',
  imports: [DatePipe, FormsModule, RouterLink, Badge, LabelPipe, MoneyPipe, StageTracker],
  template: `
    <a class="back" [routerLink]="[auth.base(), 'allocations']">← Back to {{ auth.isStaff() ? 'allocations' : 'my stands' }}</a>
    @if (a(); as a) {
      <div class="page-head">
        <div>
          <h1>Stand {{ a.stand.standNumber }} · {{ a.stand.area }}</h1>
          <p class="muted">Allocation {{ a.allocationNumber }} · allocated {{ a.allocatedAt | date: 'mediumDate' }}
            @if (auth.isStaff()) { · to <strong>{{ a.user.fullName }}</strong> ({{ a.user.nationalId }}) }</p>
        </div>
        <app-badge [value]="a.status" />
      </div>

      @if (a.status === 'cancelled') { <div class="alert alert-error">This allocation was cancelled. {{ a.cancelReason }}</div> }

      <div class="card">
        <h3>Allocation & payment stage</h3>
        <app-stage-tracker [stage]="a.stage" [cancelled]="a.status === 'cancelled'" />
        <div class="stats-4">
          <div><small class="muted">Stand price</small><strong>{{ a.totalAmount | money }}</strong></div>
          <div><small class="muted">Deposit required</small><strong>{{ a.depositAmount | money }}</strong></div>
          <div><small class="muted">Paid (approved)</small><strong class="ok">{{ a.amountPaid | money }}</strong></div>
          <div><small class="muted">Balance</small><strong [class.warn]="a.balance > 0">{{ a.balance | money }}</strong></div>
        </div>
        <div class="progress lg"><span [style.width.%]="a.percentPaid"></span></div>
        <small class="muted">{{ a.percentPaid }}% paid</small>

        @if (auth.isStaff() && a.status !== 'cancelled') {
          <div class="staff-actions">
            <label>Move to stage
              <select [(ngModel)]="newStage" name="stage">@for (s of stages; track s.key) { <option [value]="s.key">{{ s.label }}</option> }</select>
            </label>
            <label class="grow">Note <input [(ngModel)]="stageNote" name="note" placeholder="Optional message to the stand holder" /></label>
            <button class="btn btn-primary" (click)="setStage()">Update stage</button>
            @if (a.status === 'active') { <button class="btn btn-danger" (click)="cancel()">Cancel allocation</button> }
          </div>
        }
      </div>

      <div class="grid-wide align-start">
        <div class="card">
          <div class="row between"><h3>Payment history</h3>
            @if (!auth.isStaff() && a.status === 'active' && a.balance > 0) {
              <button class="btn btn-primary sm" (click)="showPay.set(!showPay())">{{ showPay() ? 'Close' : '+ Submit receipt' }}</button>
            }
          </div>

          @if (showPay()) {
            <form class="form sub-card" (ngSubmit)="submitPayment()">
              <p class="muted">Pay at the council or bank, then upload your receipt as proof. The council will verify and approve it.</p>
              <div class="grid-2">
                <label>Amount paid <input type="number" step="0.01" min="0.01" name="amount" [(ngModel)]="pay.amount" required /></label>
                <label>Payment date <input type="date" name="date" [(ngModel)]="pay.paymentDate" required /></label>
                <label>Method
                  <select name="method" [(ngModel)]="pay.method">
                    <option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option>
                    <option value="mobile_money">Mobile money</option><option value="card">Card</option><option value="other">Other</option>
                  </select>
                </label>
                <label>Receipt / reference no. <input name="ref" [(ngModel)]="pay.reference" required /></label>
              </div>
              <label>Receipt file (PDF, JPG, PNG — max 5MB)
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" (change)="onFile($event)" required />
              </label>
              <button class="btn btn-primary" [disabled]="busy()">{{ busy() ? 'Uploading…' : 'Submit proof of payment' }}</button>
            </form>
          }

          <div class="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Ref</th><th>Status</th><th></th></tr></thead>
              <tbody>
                @for (p of payments(); track p._id) {
                  <tr>
                    <td>{{ p.paymentDate | date: 'mediumDate' }}</td>
                    <td>{{ p.amount | money }}</td>
                    <td>{{ p.method | label }}</td>
                    <td>{{ p.reference }}</td>
                    <td><app-badge [value]="p.status" />
                      @if (p.reviewNote) { <div class="muted small">{{ p.reviewNote }}</div> }</td>
                    <td class="nowrap">
                      @if (p.receipt) { <button class="link" (click)="api.openFile('/payments/' + p._id + '/receipt')">Receipt</button> }
                      @if (auth.isStaff() && p.status === 'pending') {
                        <button class="link ok" (click)="review(p, true)">Approve</button>
                        <button class="link danger" (click)="review(p, false)">Reject</button>
                      }
                    </td>
                  </tr>
                } @empty { <tr><td colspan="6" class="muted center">No payments recorded yet.</td></tr> }
              </tbody>
            </table>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <h3>Status timeline</h3>
            <ul class="timeline">
              @for (h of a.stageHistory.slice().reverse(); track $index) {
                <li><strong>{{ h.stage | label }}</strong><span>{{ h.note }}</span>
                  <small class="muted">{{ h.at | date: 'medium' }}{{ h.changedBy ? ' · ' + h.changedBy.fullName : '' }}</small></li>
              }
            </ul>
          </div>
          <div class="card">
            <h3>Planned infrastructure in {{ a.stand.area }}</h3>
            @for (i of infra(); track i._id) {
              <div class="infra-row">
                <div class="row between"><strong>{{ i.title }}</strong><app-badge [value]="i.status" /></div>
                <small class="muted">{{ i.type | label }}{{ i.expectedCompletion ? ' · expected ' + (i.expectedCompletion | date: 'MMM y') : '' }}</small>
                <div class="progress"><span [style.width.%]="i.progress"></span></div>
              </div>
            } @empty { <p class="muted">No projects planned for this area yet.</p> }
          </div>
          <div class="card">
            <h3>Stand details</h3>
            <dl class="dl">
              <dt>Size</dt><dd>{{ a.stand.sizeSqm }} m²</dd>
              <dt>Land use</dt><dd>{{ a.stand.landUse | label }}</dd>
              <dt>Deposit</dt><dd>{{ a.stand.depositPercent }}%</dd>
              @if (a.stand.description) { <dt>Notes</dt><dd>{{ a.stand.description }}</dd> }
            </dl>
          </div>
        </div>
      </div>
    } @else { <div class="card empty">Loading…</div> }
  `,
})
export class AllocationDetail {
  id = input.required<string>();
  auth = inject(AuthService);
  api = inject(ApiService);
  private toast = inject(ToastService);

  a = signal<Allocation | null>(null);
  payments = signal<Payment[]>([]);
  infra = signal<Infrastructure[]>([]);
  showPay = signal(false);
  busy = signal(false);
  stages = STAGES;
  newStage = '';
  stageNote = '';
  file: File | null = null;
  pay = { amount: null as number | null, paymentDate: new Date().toISOString().slice(0, 10), method: 'bank_transfer', reference: '' };

  constructor() {
    effect(() => this.load(this.id()));
  }

  load(id = this.id()) {
    this.api.get<{ allocation: Allocation; payments: Payment[]; infrastructure: Infrastructure[] }>(`/allocations/${id}`).subscribe({
      next: (r) => {
        this.a.set(r.allocation);
        this.payments.set(r.payments);
        this.infra.set(r.infrastructure);
        this.newStage = r.allocation.stage;
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  onFile(ev: Event) { this.file = (ev.target as HTMLInputElement).files?.[0] ?? null; }

  submitPayment() {
    if (!this.file) return this.toast.error('Please attach your receipt');
    const fd = new FormData();
    fd.append('allocationId', this.a()!._id);
    fd.append('amount', String(this.pay.amount));
    fd.append('paymentDate', this.pay.paymentDate);
    fd.append('method', this.pay.method);
    fd.append('reference', this.pay.reference);
    fd.append('receipt', this.file);
    this.busy.set(true);
    this.api.post('/payments', fd).subscribe({
      next: () => {
        this.toast.success('Receipt submitted — awaiting council approval');
        this.showPay.set(false);
        this.busy.set(false);
        this.file = null;
        this.pay = { ...this.pay, amount: null, reference: '' };
        this.load();
      },
      error: (e) => { this.toast.error(errorMessage(e)); this.busy.set(false); },
    });
  }

  review(p: Payment, approve: boolean) {
    const note = approve ? '' : prompt('Reason for rejecting this payment:');
    if (!approve && !note) return;
    this.api.patch(`/payments/${p._id}/${approve ? 'approve' : 'reject'}`, { note }).subscribe({
      next: () => { this.toast.success(approve ? 'Payment approved' : 'Payment rejected'); this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  setStage() {
    this.api.patch(`/allocations/${this.a()!._id}/stage`, { stage: this.newStage, note: this.stageNote }).subscribe({
      next: () => { this.toast.success('Stage updated'); this.stageNote = ''; this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  cancel() {
    const reason = prompt('Reason for cancelling this allocation (the stand will become available again):');
    if (!reason) return;
    this.api.patch(`/allocations/${this.a()!._id}/cancel`, { reason }).subscribe({
      next: () => { this.toast.success('Allocation cancelled'); this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
