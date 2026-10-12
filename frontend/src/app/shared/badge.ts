import { Component, computed, input } from '@angular/core';
import { LabelPipe } from './pipes';

const TONE: Record<string, string> = {
  available: 'green', approved: 'green', completed: 'green', fully_paid: 'green', active: 'blue',
  pending: 'amber', reserved: 'amber', awaiting_deposit: 'amber', planned: 'gray', on_hold: 'gray',
  rejected: 'red', cancelled: 'red', disabled: 'red', withdrawn: 'gray', allocated: 'blue', in_progress: 'blue',
  deposit_paid: 'blue', installments: 'blue', title_processing: 'violet',
  high: 'red', medium: 'amber', low: 'gray',
  land_open: 'green', development: 'violet', payment: 'amber', general: 'gray',
  admin: 'red', council: 'violet', user: 'blue',
};

@Component({
  selector: 'app-badge',
  imports: [LabelPipe],
  template: `<span class="badge" [class]="'badge badge-' + tone()">{{ value() | label }}</span>`,
})
export class Badge {
  value = input.required<string>();
  tone = computed(() => TONE[this.value()] ?? 'gray');
}
