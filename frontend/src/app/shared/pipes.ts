import { Pipe, PipeTransform } from '@angular/core';
import { LABELS } from '../core/models';

@Pipe({ name: 'label' })
export class LabelPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    if (!v) return '';
    return LABELS[v] ?? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ');
  }
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(v: number | null | undefined): string {
    return '$' + (v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
