import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Application, Stand } from '../../core/models';
import { LabelPipe, MoneyPipe } from '../../shared/pipes';

@Component({
  selector: 'app-available-stands',
  imports: [FormsModule, LabelPipe, MoneyPipe],
  template: `
    <div class="page-head"><div><h1>Stands open for allocation</h1><p class="muted">Choose a stand and submit your application to the council.</p></div></div>
    <div class="filters">
      <select [(ngModel)]="area"><option value="">All areas</option>@for (a of areas(); track a) { <option>{{ a }}</option> }</select>
      <select [(ngModel)]="use"><option value="">Any land use</option><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="industrial">Industrial</option><option value="institutional">Institutional</option></select>
    </div>
    <div class="card-grid">
      @for (s of shown(); track s._id) {
        <div class="card stand-card">
          <div class="row between"><h3>Stand {{ s.standNumber }}</h3><span class="chip">{{ s.landUse | label }}</span></div>
          <p class="muted">📍 {{ s.area }}</p>
          <dl class="dl">
            <dt>Size</dt><dd>{{ s.sizeSqm }} m²</dd>
            <dt>Price</dt><dd>{{ s.price | money }}</dd>
            <dt>Deposit</dt><dd>{{ s.depositPercent }}% ({{ (s.price * s.depositPercent) / 100 | money }})</dd>
          </dl>
          @if (s.description) { <p class="small">{{ s.description }}</p> }
          @if (appliedIds().has(s._id)) { <button class="btn block" disabled>Application pending</button> }
          @else { <button class="btn btn-primary block" (click)="selected.set(s)">Apply for this stand</button> }
        </div>
      } @empty { <div class="card empty">No stands are open for allocation right now. Watch the news page for openings.</div> }
    </div>

    @if (selected(); as s) {
      <div class="modal-bg" (click)="selected.set(null)">
        <form class="card modal" (click)="$event.stopPropagation()" (ngSubmit)="apply(s)">
          <h3>Apply for stand {{ s.standNumber }}, {{ s.area }}</h3>
          <p class="muted">Price {{ s.price | money }} · deposit {{ (s.price * s.depositPercent) / 100 | money }} payable after allocation.</p>
          <label>Motivation (optional)<textarea rows="4" name="m" [(ngModel)]="motivation" placeholder="Tell the council why you need this stand"></textarea></label>
          <div class="row gap"><button class="btn btn-primary">Submit application</button><button type="button" class="btn btn-ghost" (click)="selected.set(null)">Cancel</button></div>
        </form>
      </div>
    }
  `,
})
export class AvailableStands {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  stands = signal<Stand[]>([]);
  myApps = signal<Application[]>([]);
  selected = signal<Stand | null>(null);
  areaSig = signal('');
  useSig = signal('');
  motivation = '';
  get area() { return this.areaSig(); } set area(v: string) { this.areaSig.set(v); }
  get use() { return this.useSig(); } set use(v: string) { this.useSig.set(v); }

  areas = computed(() => [...new Set(this.stands().map((s) => s.area))].sort());
  shown = computed(() => this.stands().filter((s) => (!this.areaSig() || s.area === this.areaSig()) && (!this.useSig() || s.landUse === this.useSig())));
  appliedIds = computed(() => new Set(this.myApps().filter((a) => a.status === 'pending').map((a) => a.stand?._id)));

  constructor() {
    this.api.get<Stand[]>('/stands').subscribe((s) => this.stands.set(s));
    this.api.get<Application[]>('/applications/mine').subscribe((a) => this.myApps.set(a));
  }

  apply(s: Stand) {
    this.api.post('/applications', { standId: s._id, motivation: this.motivation }).subscribe({
      next: () => { this.toast.success('Application submitted'); this.router.navigateByUrl('/user/applications'); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
