import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService, errorMessage } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Application } from '../../core/models';
import { Badge } from '../../shared/badge';
import { MoneyPipe } from '../../shared/pipes';

@Component({
  selector: 'app-my-applications',
  imports: [DatePipe, Badge, MoneyPipe],
  template: `
    <div class="page-head"><h1>My applications</h1></div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Submitted</th><th>Stand</th><th>Area</th><th>Price</th><th>Status</th><th>Council note</th><th></th></tr></thead>
        <tbody>
          @for (a of apps(); track a._id) {
            <tr>
              <td>{{ a.createdAt | date: 'mediumDate' }}</td>
              <td>{{ a.stand?.standNumber }}</td><td>{{ a.stand?.area }}</td><td>{{ a.stand?.price | money }}</td>
              <td><app-badge [value]="a.status" /></td>
              <td class="small">{{ a.reviewNote }}</td>
              <td>@if (a.status === 'pending') { <button class="link danger" (click)="withdraw(a)">Withdraw</button> }</td>
            </tr>
          } @empty { <tr><td colspan="7" class="muted center">You have not applied for any stand yet.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class MyApplications {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  apps = signal<Application[]>([]);
  constructor() { this.load(); }
  load() { this.api.get<Application[]>('/applications/mine').subscribe((a) => this.apps.set(a)); }
  withdraw(a: Application) {
    this.api.patch(`/applications/${a._id}/withdraw`).subscribe({
      next: () => { this.toast.success('Application withdrawn'); this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
