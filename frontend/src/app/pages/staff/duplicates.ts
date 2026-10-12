import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { DuplicateReport } from '../../core/models';
import { Badge } from '../../shared/badge';
import { LabelPipe } from '../../shared/pipes';

@Component({
  selector: 'app-duplicates',
  imports: [DatePipe, PercentPipe, FormsModule, Badge, LabelPipe],
  template: `
    <div class="page-head">
      <div><h1>Duplicate allocation check</h1>
        <p class="muted">Record linkage compares stand numbers, names (fuzzy Jaro-Winkler + Soundex), national IDs and phone numbers to find double bookings — even when records are spelled or formatted differently.</p></div>
    </div>

    <div class="grid-2 align-start">
      <div class="card form">
        <h3>Upload allocation register (CSV)</h3>
        <p class="muted small">Required column: stand number. Recommended: area, full name, national ID, phone, allocation date. Common header names (e.g. “Stand No”, “Suburb”, “Name”, “ID Number”) are recognised.</p>
        <input type="file" accept=".csv" (change)="file = $any($event.target).files?.[0]" />
        <label class="check"><input type="checkbox" [(ngModel)]="compare" /> Also compare against allocations recorded in this system</label>
        <div class="row gap wrap">
          <button class="btn btn-primary" [disabled]="busy()" (click)="upload()">{{ busy() ? 'Analysing…' : 'Analyse file' }}</button>
          <button class="btn btn-ghost" (click)="api.download('/duplicates/template', 'allocations-template.csv')">Download template</button>
        </div>
      </div>
      <div class="card form">
        <h3>Scan system records</h3>
        <p class="muted small">Runs the same linkage over every active allocation in the database to find one person holding several stands under different accounts.</p>
        <div><button class="btn" [disabled]="busy()" (click)="scan()">Scan system allocations</button></div>
      </div>
    </div>

    @if (report(); as r) {
      <div class="card">
        <div class="row between wrap">
          <h3>Results — {{ r.fileName }}</h3>
          <small class="muted">{{ r.totalRecords }} records analysed · {{ r.createdAt | date: 'medium' }}</small>
        </div>
        <div class="stats-row">
          <button class="card stat" [class.sel]="type() === 'double_allocation'" (click)="toggleType('double_allocation')"><small>Double allocations</small><strong class="danger">{{ r.summary.doubleAllocations }}</strong></button>
          <button class="card stat" [class.sel]="type() === 'conflict_with_system'" (click)="toggleType('conflict_with_system')"><small>Conflicts with system</small><strong class="danger">{{ r.summary.conflictsWithSystem }}</strong></button>
          <button class="card stat" [class.sel]="type() === 'same_person_multiple_stands'" (click)="toggleType('same_person_multiple_stands')"><small>Same person, many stands</small><strong class="warn">{{ r.summary.samePersonMultipleStands }}</strong></button>
          <button class="card stat" [class.sel]="type() === 'duplicate_record'" (click)="toggleType('duplicate_record')"><small>Duplicate rows</small><strong>{{ r.summary.duplicateRecords }}</strong></button>
        </div>
        @if (!r.findings?.length) { <div class="alert alert-ok">✓ No duplicates or double bookings found.</div> }
        @for (f of findings(); track $index) {
          <div class="finding sev-{{ f.severity }}">
            <div class="row between wrap">
              <div class="row gap wrap"><app-badge [value]="f.severity" /><strong>{{ f.type | label }}</strong></div>
              <small class="muted">confidence {{ f.score | percent }}</small>
            </div>
            <p>{{ f.reason }}</p>
            <div class="table-wrap">
              <table class="compact">
                <thead><tr><th>Source</th><th>Row</th><th>Stand</th><th>Area</th><th>Name</th><th>National ID</th><th>Phone</th><th>Date</th></tr></thead>
                <tbody>
                  @for (rec of f.records; track $index) {
                    <tr><td><span class="chip">{{ rec.source === 'system' ? 'System' : 'CSV' }}</span></td><td>{{ rec.row }}</td><td>{{ rec.standNumber }}</td><td>{{ rec.area }}</td>
                      <td>{{ rec.fullName }}</td><td>{{ rec.nationalId }}</td><td>{{ rec.phone }}</td><td>{{ rec.allocationDate }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>
    }

    <div class="card">
      <h3>Previous reports</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Source</th><th>Records</th><th>Double</th><th>Conflicts</th><th>Same person</th><th>Dup rows</th><th>By</th><th></th></tr></thead>
          <tbody>
            @for (h of history(); track h._id) {
              <tr>
                <td>{{ h.createdAt | date: 'short' }}</td><td>{{ h.fileName }}</td><td>{{ h.totalRecords }}</td>
                <td>{{ h.summary.doubleAllocations }}</td><td>{{ h.summary.conflictsWithSystem }}</td><td>{{ h.summary.samePersonMultipleStands }}</td><td>{{ h.summary.duplicateRecords }}</td>
                <td>{{ h.createdBy?.fullName }}</td>
                <td class="nowrap"><button class="link" (click)="open(h._id)">Open</button><button class="link danger" (click)="remove(h._id)">Delete</button></td>
              </tr>
            } @empty { <tr><td colspan="9" class="muted center">No reports yet.</td></tr> }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class Duplicates {
  api = inject(ApiService);
  private toast = inject(ToastService);
  file: File | null = null;
  compare = true;
  busy = signal(false);
  report = signal<DuplicateReport | null>(null);
  history = signal<DuplicateReport[]>([]);
  type = signal('');
  findings = computed(() => (this.report()?.findings || []).filter((f) => !this.type() || f.type === this.type()));

  constructor() { this.loadHistory(); }
  loadHistory() { this.api.get<DuplicateReport[]>('/duplicates').subscribe((h) => this.history.set(h)); }
  toggleType(t: string) { this.type.update((v) => (v === t ? '' : t)); }

  private done = (r: DuplicateReport) => {
    this.busy.set(false);
    this.type.set('');
    this.report.set(r);
    this.loadHistory();
    this.toast.show(r.findings?.length ? `${r.findings.length} potential issue(s) found` : 'No duplicates found', r.findings?.length ? 'error' : 'success');
  };
  private fail = (e: any) => { this.busy.set(false); this.toast.error(errorMessage(e)); };

  upload() {
    if (!this.file) return this.toast.error('Choose a CSV file first');
    const fd = new FormData();
    fd.append('file', this.file);
    fd.append('compareWithSystem', String(this.compare));
    this.busy.set(true);
    this.api.post<DuplicateReport>('/duplicates/csv', fd).subscribe({ next: this.done, error: this.fail });
  }
  scan() {
    this.busy.set(true);
    this.api.post<DuplicateReport>('/duplicates/scan-system').subscribe({ next: this.done, error: this.fail });
  }
  open(id: string) { this.api.get<DuplicateReport>(`/duplicates/${id}`).subscribe((r) => { this.type.set(''); this.report.set(r); }); }
  remove(id: string) {
    this.api.delete(`/duplicates/${id}`).subscribe(() => { if (this.report()?._id === id) this.report.set(null); this.loadHistory(); });
  }
}
