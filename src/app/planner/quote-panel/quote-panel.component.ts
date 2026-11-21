import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TRUCKS, locationName } from '../../domain';
import { QuoteView } from '../../quote/quote-view';

/**
 * Presentational only: renders a QuoteView and emits user intent.
 * All inputs are signals, so OnPush change detection is safe here.
 */
@Component({
  selector: 'app-quote-panel',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-panel.component.html',
  styleUrl: './quote-panel.component.css',
})
export class QuotePanelComponent {
  readonly view = input.required<QuoteView>();
  /** Reasons the current form can't be quoted (empty = ready). */
  readonly blockers = input<readonly string[]>([]);

  readonly requestQuote = output<void>();

  readonly canRequest = computed(() => this.blockers().length === 0);
  readonly isPending = computed(() => this.view().kind === 'pending');

  readonly details = computed(() => {
    const v = this.view();
    if (v.kind !== 'ready') return null;
    const truck = TRUCKS[v.trip.truckCategory];
    return {
      route: [v.trip.pickup, ...v.trip.dropoffs].map(locationName).join(' → '),
      truckLabel: truck.label,
      truckCount: v.trip.truckCount,
      minimumFareApplied: v.quote.distanceKm * truck.ratePerKm < truck.minimumFare,
      services: [v.trip.loadingAssistance && 'Loading', v.trip.unloadingAssistance && 'Unloading'].filter(Boolean).join(' + '),
    };
  });

  readonly buttonLabel = computed(() => {
    switch (this.view().kind) {
      case 'pending':
        return 'Calculating…';
      case 'ready':
      case 'outdated':
      case 'error':
        return 'Get new quote';
      default:
        return 'Get quote';
    }
  });
}
