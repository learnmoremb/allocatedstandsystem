import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { News } from '../../core/models';
import { Badge } from '../../shared/badge';

const EMPTY = { title: '', body: '', category: 'general', area: '', pinned: false };

@Component({
  selector: 'app-news',
  imports: [DatePipe, FormsModule, Badge],
  template: `
    <div class="page-head">
      <div><h1>News & Updates</h1><p class="muted">Land openings, developments and council notices.</p></div>
      @if (auth.isStaff()) { <button class="btn btn-primary" (click)="edit(null)">+ Post update</button> }
    </div>

    @if (form()) {
      <form class="card form" (ngSubmit)="save()">
        <h3>{{ editingId() ? 'Edit update' : 'New update' }}</h3>
        <label>Title <input name="title" [(ngModel)]="form()!.title" required /></label>
        <div class="grid-3">
          <label>Category
            <select name="category" [(ngModel)]="form()!.category">
              <option value="general">General</option><option value="land_open">Land open for allocation</option>
              <option value="development">Development</option><option value="payment">Payment</option>
            </select>
          </label>
          <label>Affected area (optional) <input name="area" [(ngModel)]="form()!.area" [attr.list]="'areas'" /></label>
          <label class="check"><input type="checkbox" name="pinned" [(ngModel)]="form()!.pinned" /> Pin to top</label>
        </div>
        <datalist id="areas">@for (a of areas(); track a) { <option [value]="a"></option> }</datalist>
        <label>Message <textarea name="body" rows="5" [(ngModel)]="form()!.body" required></textarea></label>
        <div class="row gap"><button class="btn btn-primary">Publish</button><button type="button" class="btn btn-ghost" (click)="form.set(null)">Cancel</button></div>
      </form>
    }

    <div class="tabs">
      @for (c of cats; track c.v) { <button [class.active]="cat() === c.v" (click)="cat.set(c.v)">{{ c.l }}</button> }
    </div>

    <div class="stack">
      @for (n of filtered(); track n._id) {
        <article class="card news-item" [class.pinned]="n.pinned">
          <div class="row between wrap">
            <div class="row gap wrap">
              <app-badge [value]="n.category" />
              @if (n.area) { <span class="chip">📍 {{ n.area }}</span> }
              @if (n.pinned) { <span class="chip">📌 Pinned</span> }
            </div>
            <small class="muted">{{ n.createdAt | date: 'mediumDate' }}</small>
          </div>
          <h3>{{ n.title }}</h3>
          <p class="pre">{{ n.body }}</p>
          @if (auth.isStaff()) {
            <div class="row gap"><button class="link" (click)="edit(n)">Edit</button><button class="link danger" (click)="remove(n)">Delete</button></div>
          }
        </article>
      } @empty { <div class="card empty">No updates in this category yet.</div> }
    </div>
  `,
})
export class NewsPage {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  items = signal<News[]>([]);
  areas = signal<string[]>([]);
  cat = signal('');
  form = signal<any>(null);
  editingId = signal<string | null>(null);
  cats = [{ v: '', l: 'All' }, { v: 'land_open', l: 'Land open' }, { v: 'development', l: 'Developments' }, { v: 'payment', l: 'Payments' }, { v: 'general', l: 'General' }];
  filtered = computed(() => (this.cat() ? this.items().filter((n) => n.category === this.cat()) : this.items()));

  constructor() {
    this.load();
    this.api.get<string[]>('/stands/areas').subscribe((a) => this.areas.set(a));
  }
  load() { this.api.get<News[]>('/news').subscribe((n) => this.items.set(n)); }

  edit(n: News | null) {
    this.editingId.set(n?._id ?? null);
    this.form.set(n ? { title: n.title, body: n.body, category: n.category, area: n.area || '', pinned: n.pinned } : { ...EMPTY });
  }
  save() {
    const id = this.editingId();
    const req = id ? this.api.put(`/news/${id}`, this.form()) : this.api.post('/news', this.form());
    req.subscribe({
      next: () => { this.toast.success('Update published'); this.form.set(null); this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
  remove(n: News) {
    if (!confirm(`Delete "${n.title}"?`)) return;
    this.api.delete(`/news/${n._id}`).subscribe(() => { this.toast.success('Deleted'); this.load(); });
  }
}
