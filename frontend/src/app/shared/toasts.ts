import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toasts',
  template: `
    <div class="toasts">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast toast-{{ t.kind }}" (click)="toast.dismiss(t.id)">{{ t.text }}</div>
      }
    </div>
  `,
})
export class Toasts {
  toast = inject(ToastService);
}
