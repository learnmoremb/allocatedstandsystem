import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; text: string; kind: 'success' | 'error' | 'info' }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private id = 0;

  show(text: string, kind: Toast['kind'] = 'info') {
    const t = { id: ++this.id, text, kind };
    this.toasts.update((l) => [...l, t]);
    setTimeout(() => this.dismiss(t.id), kind === 'error' ? 6000 : 3500);
  }
  success(text: string) { this.show(text, 'success'); }
  error(text: string) { this.show(text, 'error'); }
  dismiss(id: number) { this.toasts.update((l) => l.filter((t) => t.id !== id)); }
}
