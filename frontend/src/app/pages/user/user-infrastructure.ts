import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { Infrastructure } from '../../core/models';
import { Badge } from '../../shared/badge';
import { LabelPipe } from '../../shared/pipes';

@Component({
  selector: 'app-user-infrastructure',
  imports: [DatePipe, Badge, LabelPipe],
  template: `
    <div class="page-head">
      <div><h1>Planned infrastructure</h1><p class="muted">Roads, water, sewer and other services planned for each area.</p></div>
      <label class="check"><input type="checkbox" [checked]="mine()" (change)="toggle()" /> Only areas where I hold a stand</label>
    </div>
    <div class="card-grid">
      @for (i of list(); track i._id) {
        <div class="card">
          <div class="row between"><h3>{{ i.title }}</h3><app-badge [value]="i.status" /></div>
          <p class="muted">📍 {{ i.area }} · {{ i.type | label }}</p>
          @if (i.description) { <p class="small">{{ i.description }}</p> }
          <div class="progress"><span [style.width.%]="i.progress"></span></div>
          <small class="muted">{{ i.progress }}% complete
            @if (i.expectedCompletion) { · expected {{ i.expectedCompletion | date: 'mediumDate' }} }</small>
        </div>
      } @empty { <div class="card empty">No infrastructure projects found.</div> }
    </div>
  `,
})
export class UserInfrastructure {
  private api = inject(ApiService);
  list = signal<Infrastructure[]>([]);
  mine = signal(false);
  constructor() { this.load(); }
  toggle() { this.mine.update((v) => !v); this.load(); }
  load() { this.api.get<Infrastructure[]>('/infrastructure', { mine: this.mine() || undefined }).subscribe((l) => this.list.set(l)); }
}
