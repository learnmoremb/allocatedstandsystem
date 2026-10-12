import { Component, computed, input } from '@angular/core';
import { STAGES, Stage } from '../core/models';

@Component({
  selector: 'app-stage-tracker',
  template: `
    <ol class="stepper" [class.cancelled]="cancelled()">
      @for (s of stages; track s.key; let i = $index) {
        <li [class.done]="i < current()" [class.current]="i === current()">
          <span class="dot">{{ i < current() ? '✓' : i + 1 }}</span>
          <span class="step-label">{{ s.label }}</span>
        </li>
      }
    </ol>
  `,
})
export class StageTracker {
  stage = input.required<Stage>();
  cancelled = input(false);
  stages = STAGES;
  current = computed(() => {
    const i = STAGES.findIndex((s) => s.key === this.stage());
    return this.stage() === 'completed' ? STAGES.length : i;
  });
}
