import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Infrastructure } from '../../core/models';
import { Badge } from '../../shared/badge';
import { LabelPipe } from '../../shared/pipes';

const TYPES = ['roads', 'water', 'sewer', 'electricity', 'drainage', 'school', 'clinic', 'other'];
const EMPTY = { title: '', type: 'roads', area: '', description: '', status: 'planned', startDate: '', expectedCompletion: '', progress: 0, publish: true };

@Component({
  selector: 'app-infrastructure-manage',
  imports: [DatePipe, FormsModule, Badge, LabelPipe],
  template: `
    <div class="page-head">
      <div><h1>Infrastructure developments</h1><p class="muted">Every new development and update is published to the news list and stand holders in that area are notified.</p></div>
      <button class="btn btn-primary" (click)="edit(null)">+ New project</button>
    </div>
    @if (form()) {
      <form class="card form" (ngSubmit)="save()">
        <h3>{{ editingId() ? 'Update project' : 'New project' }}</h3>
        <div class="grid-3">
          <label>Title <input name="t" [(ngModel)]="form().title" required /></label>
          <label>Type <select name="ty" [(ngModel)]="form().type">@for (t of types; track t) { <option [value]="t">{{ t | label }}</option> }</select></label>
          <label>Area <input name="a" [(ngModel)]="form().area" required list="infra-areas" /></label>
          <label>Status <select name="s" [(ngModel)]="form().status"><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="on_hold">On hold</option></select></label>
          <label>Start date <input type="date" name="sd" [(ngModel)]="form().startDate" /></label>
          <label>Expected completion <input type="date" name="ec" [(ngModel)]="form().expectedCompletion" /></label>
        </div>
        <datalist id="infra-areas">@for (a of areas(); track a) { <option [value]="a"></option> }</datalist>
        <label>Progress: {{ form().progress }}% <input type="range" min="0" max="100" name="p" [(ngModel)]="form().progress" /></label>
        <label>Description <textarea rows="3" name="d" [(ngModel)]="form().description"></textarea></label>
        @if (editingId()) { <label class="check"><input type="checkbox" name="pub" [(ngModel)]="form().publish" /> Publish this update to the news list</label> }
        <div class="row gap"><button class="btn btn-primary">Save</button><button type="button" class="btn btn-ghost" (click)="form.set(null)">Cancel</button></div>
      </form>
    }
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Project</th><th>Area</th><th>Type</th><th>Status</th><th>Progress</th><th>Expected</th><th></th></tr></thead>
        <tbody>
          @for (i of list(); track i._id) {
            <tr>
              <td><strong>{{ i.title }}</strong><div class="muted small">{{ i.description }}</div></td>
              <td>{{ i.area }}</td><td>{{ i.type | label }}</td><td><app-badge [value]="i.status" /></td>
              <td><div class="progress thin"><span [style.width.%]="i.progress"></span></div><small>{{ i.progress }}%</small></td>
              <td>{{ i.expectedCompletion | date: 'mediumDate' }}</td>
              <td class="nowrap"><button class="link" (click)="edit(i)">Update</button><button class="link danger" (click)="remove(i)">Delete</button></td>
            </tr>
          } @empty { <tr><td colspan="7" class="muted center">No projects.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class InfrastructureManage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  types = TYPES;
  list = signal<Infrastructure[]>([]);
  areas = signal<string[]>([]);
  form = signal<any>(null);
  editingId = signal<string | null>(null);

  constructor() {
    this.load();
    this.api.get<string[]>('/stands/areas').subscribe((a) => this.areas.set(a));
  }
  load() { this.api.get<Infrastructure[]>('/infrastructure').subscribe((l) => this.list.set(l)); }
  edit(i: Infrastructure | null) {
    this.editingId.set(i?._id ?? null);
    const d = (v?: string) => (v ? v.slice(0, 10) : '');
    this.form.set(i ? { ...i, startDate: d(i.startDate), expectedCompletion: d(i.expectedCompletion), publish: true } : { ...EMPTY });
  }
  save() {
    const id = this.editingId();
    const body = { ...this.form(), startDate: this.form().startDate || undefined, expectedCompletion: this.form().expectedCompletion || undefined };
    (id ? this.api.put(`/infrastructure/${id}`, body) : this.api.post('/infrastructure', body)).subscribe({
      next: () => { this.toast.success('Saved and shared on the news list'); this.form.set(null); this.load(); },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }
  remove(i: Infrastructure) {
    if (!confirm(`Delete "${i.title}"?`)) return;
    this.api.delete(`/infrastructure/${i._id}`).subscribe(() => this.load());
  }
}
