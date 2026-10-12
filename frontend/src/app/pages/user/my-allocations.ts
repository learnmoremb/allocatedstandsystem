import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Allocation } from '../../core/models';
import { Badge } from '../../shared/badge';
import { MoneyPipe } from '../../shared/pipes';

@Component({
  selector: 'app-my-allocations',
  imports: [RouterLink, Badge, MoneyPipe],
  template: `
    <div class="page-head"><h1>My stands</h1></div>
    <div class="card-grid">
      @for (a of list(); track a._id) {
        <a class="card stand-card clickable" [routerLink]="['/user/allocations', a._id]">
          <div class="row between"><h3>Stand {{ a.stand.standNumber }}</h3><app-badge [value]="a.status" /></div>
          <p class="muted">📍 {{ a.stand.area }} · {{ a.allocationNumber }}</p>
          <p>Stage: <app-badge [value]="a.stage" /></p>
          <div class="progress"><span [style.width.%]="a.percentPaid"></span></div>
          <small class="muted">{{ a.amountPaid | money }} of {{ a.totalAmount | money }} paid</small>
        </a>
      } @empty { <div class="card empty">No stands allocated to you yet.</div> }
    </div>
  `,
})
export class MyAllocations {
  list = signal<Allocation[]>([]);
  constructor() { inject(ApiService).get<Allocation[]>('/allocations/mine').subscribe((l) => this.list.set(l)); }
}
