import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { PriceSuggestion, Stand } from '../../core/models';
import { Badge } from '../../shared/badge';
import { LabelPipe, MoneyPipe } from '../../shared/pipes';

const EMPTY = { standNumber: '', area: '', sizeSqm: null, landUse: 'residential', price: null, depositPercent: 10, description: '', status: 'available', announce: true };

@Component({
  selector: 'app-stands-manage',
  imports: [FormsModule, Badge, LabelPipe, MoneyPipe],
  template: `
    <div class="page-head">
      <div><h1>Stands</h1><p class="muted">Register land and open it for allocation. Opening stands can post an announcement to the news list.</p></div>
      <div class="row gap wrap">
        <button class="btn" (click)="showImport.set(!showImport())">Import CSV</button>
        <button class="btn btn-primary" (click)="edit(null)">+ Add stand</button>
      </div>
    </div>

    @if (showImport()) {
      <div class="card form">
        <h3>Bulk import stands</h3>
        <p class="muted small">Columns: <code>standNumber,area,sizeSqm,landUse,price,depositPercent,description</code>. Stands that already exist in an area are skipped. Leave <code>price</code> empty to use the suggested price.</p>
        <input type="file" accept=".csv" (change)="importFile = $any($event.target).files?.[0]" />
        <label class="check"><input type="checkbox" [(ngModel)]="importAnnounce" /> Announce imported stands on the news list</label>
        <div><button class="btn btn-primary" (click)="doImport()">Import</button></div>
        @if (importErrors().length) {
          <div class="alert alert-warn">@for (e of importErrors(); track $index) { <div>Row {{ e.row }}: {{ e.message }}</div> }</div>
        }
      </div>
    }

    @if (form()) {
      <form class="card form" (ngSubmit)="save()">
        <h3>{{ editingId() ? 'Edit stand' : 'New stand' }}</h3>
        <div class="grid-3">
          <label>Stand number <input name="n" [(ngModel)]="form().standNumber" required /></label>
          <label>Area / suburb <input name="a" [(ngModel)]="form().area" required list="area-list" /></label>
          <label>Land use
            <select name="u" [(ngModel)]="form().landUse"><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="industrial">Industrial</option><option value="institutional">Institutional</option></select>
          </label>
          <label>Size (m²) <input type="number" name="s" [(ngModel)]="form().sizeSqm" required min="1" /></label>
          <label>Price
            <div class="row gap">
              <input type="number" name="p" [(ngModel)]="form().price" required min="0" />
              <button type="button" class="btn nowrap" (click)="suggestPrice()" [disabled]="suggesting()" title="Estimate from area, size and land use">{{ suggesting() ? '…' : '✨ Suggest' }}</button>
            </div>
            @if (suggestion(); as sg) {
              <span class="muted small">Suggested {{ sg.suggestedPrice | money }} (likely range {{ sg.low | money }} – {{ sg.high | money }}, {{ sg.pricePerSqm | money }}/m²)
                @if (!sg.knownArea) { <br />⚠ New area for the model: treat this as a rough estimate. }</span>
            }
          </label>
          <label>Deposit % <input type="number" name="d" [(ngModel)]="form().depositPercent" min="0" max="100" /></label>
          @if (editingId() && form().status !== 'allocated') {
            <label>Status <select name="st" [(ngModel)]="form().status"><option value="available">Available</option><option value="reserved">Reserved</option><option value="withdrawn">Withdrawn</option></select></label>
          }
        </div>
        <datalist id="area-list">@for (a of areas(); track a) { <option [value]="a"></option> }</datalist>
        <label>Description <textarea name="desc" rows="2" [(ngModel)]="form().description"></textarea></label>
        @if (!editingId()) { <label class="check"><input type="checkbox" name="ann" [(ngModel)]="form().announce" /> Announce on news list as open for allocation</label> }
        <div class="row gap"><button class="btn btn-primary">Save</button><button type="button" class="btn btn-ghost" (click)="form.set(null)">Cancel</button></div>
      </form>
    }

    <div class="filters">
      <select [ngModel]="area()" (ngModelChange)="area.set($event)"><option value="">All areas</option>@for (a of areas(); track a) { <option>{{ a }}</option> }</select>
      <select [ngModel]="status()" (ngModelChange)="status.set($event)"><option value="">All statuses</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="allocated">Allocated</option><option value="withdrawn">Withdrawn</option></select>
      @if (selected().size) { <button class="btn" (click)="announceSelected()">📣 Announce {{ selected().size }} selected</button> }
    </div>

    <div class="card table-wrap">
      <table>
        <thead><tr><th></th><th>Stand</th><th>Area</th><th>Use</th><th>Size</th><th>Price</th><th>Status</th><th>Allocated to</th><th></th></tr></thead>
        <tbody>
          @for (s of shown(); track s._id) {
            <tr>
              <td>@if (s.status === 'available') { <input type="checkbox" [checked]="selected().has(s._id)" (change)="toggle(s._id)" /> }</td>
              <td><strong>{{ s.standNumber }}</strong></td><td>{{ s.area }}</td><td>{{ s.landUse | label }}</td>
              <td>{{ s.sizeSqm }} m²</td><td>{{ s.price | money }}</td>
              <td><app-badge [value]="s.status" /></td>
              <td>{{ s.allocatedTo?.fullName }}</td>
              <td class="nowrap"><button class="link" (click)="edit(s)">Edit</button>
                @if (s.status !== 'allocated') { <button class="link danger" (click)="remove(s)">Delete</button> }</td>
            </tr>
          } @empty { <tr><td colspan="9" class="muted center">No stands.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class StandsManage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  list = signal<Stand[]>([]);
  form = signal<any>(null);
  editingId = signal<string | null>(null);
  area = signal('');
  status = signal('');
  selected = signal(new Set<string>());
  showImport = signal(false);
  importErrors = signal<any[]>([]);
  importFile: File | null = null;
  importAnnounce = true;
  suggestion = signal<PriceSuggestion | null>(null);
  suggesting = signal(false);

  areas = computed(() => [...new Set(this.list().map((s) => s.area))].sort());
  shown = computed(() => this.list().filter((s) => (!this.area() || s.area === this.area()) && (!this.status() || s.status === this.status())));

  constructor() { this.load(); }
  load() { this.api.get<Stand[]>('/stands').subscribe((l) => this.list.set(l)); }

  edit(s: Stand | null) {
    this.editingId.set(s?._id ?? null);
    this.form.set(s ? { ...s, allocatedTo: undefined } : { ...EMPTY });
    this.suggestion.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  suggestPrice() {
    const { area, sizeSqm, landUse } = this.form();
    if (!area || !(sizeSqm > 0)) return this.toast.error('Enter the area and size first');
    this.suggesting.set(true);
    this.api.post<PriceSuggestion>('/stands/suggest-price', { area, sizeSqm, landUse }).subscribe({
      next: (sg) => {
        this.suggestion.set(sg);
        this.form.update((f) => ({ ...f, price: sg.suggestedPrice }));
        this.suggesting.set(false);
      },
      error: (e) => { this.toast.error(errorMessage(e)); this.suggesting.set(false); },
    });
  }
  save() {
    const id = this.editingId();
    const req = id ? this.api.put(`/stands/${id}`, this.form()) : this.api.post('/stands', this.form());
    req.subscribe({
      next: () => { this.toast.success('Stand saved'); this.form.set(null); this.load(); },
      error: (e) => this.toast.error(e.status === 409 ? 'A stand with this number already exists in this area' : errorMessage(e)),
    });
  }
  remove(s: Stand) {
    if (!confirm(`Delete stand ${s.standNumber}?`)) return;
    this.api.delete(`/stands/${s._id}`).subscribe({ next: () => this.load(), error: (e) => this.toast.error(errorMessage(e)) });
  }
  toggle(id: string) {
    this.selected.update((set) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  announceSelected() {
    this.api.post('/stands/announce', { standIds: [...this.selected()] }).subscribe({
      next: () => { this.toast.success('Posted to news'); this.selected.set(new Set()); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
  doImport() {
    if (!this.importFile) return this.toast.error('Choose a CSV file');
    const fd = new FormData();
    fd.append('file', this.importFile);
    fd.append('announce', String(this.importAnnounce));
    this.api.post<{ created: number; suggested: number; errors: any[] }>('/stands/import', fd).subscribe({
      next: (r) => { this.toast.success(`${r.created} stand(s) imported` + (r.suggested ? `, ${r.suggested} priced by the model` : '')); this.importErrors.set(r.errors); this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
}
