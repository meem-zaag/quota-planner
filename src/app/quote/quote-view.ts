import { QuoteBreakdown, TripRequest } from '../domain';
import { QuoteState } from './quote.store';

/**
 * What the quote panel should show. Derived from the raw store state AND the
 * current form inputs, so an estimate is never shown as valid for inputs that
 * differ from the ones used to produce it.
 */
export type QuoteView =
  | { readonly kind: 'empty' }
  | { readonly kind: 'pending'; readonly inputsChanged: boolean }
  | { readonly kind: 'ready'; readonly quote: QuoteBreakdown; readonly trip: TripRequest }
  | { readonly kind: 'outdated'; readonly quote: QuoteBreakdown; readonly trip: TripRequest }
  | { readonly kind: 'error'; readonly problems: readonly string[] };

/** Field-by-field equality of two trips. Drop-off ORDER matters (it changes the distance). */
export function sameTrip(a: TripRequest | null, b: TripRequest | null): boolean {
  if (a === null || b === null) return false;
  return (
    a.pickup === b.pickup &&
    a.dropoffs.length === b.dropoffs.length &&
    a.dropoffs.every((d, i) => d === b.dropoffs[i]) &&
    a.truckCategory === b.truckCategory &&
    a.truckCount === b.truckCount &&
    a.cargoWeightTonnes === b.cargoWeightTonnes &&
    a.pickupDateTime === b.pickupDateTime &&
    a.loadingAssistance === b.loadingAssistance &&
    a.unloadingAssistance === b.unloadingAssistance
  );
}

/**
 * @param state       raw state from QuoteStore
 * @param currentTrip the form's current values as a trip, or null if the form
 *                    is incomplete/invalid
 */
export function deriveQuoteView(state: QuoteState, currentTrip: TripRequest | null): QuoteView {
  switch (state.status) {
    case 'idle':
      return { kind: 'empty' };
    case 'pending':
      return { kind: 'pending', inputsChanged: !sameTrip(state.trip, currentTrip) };
    case 'success':
      return sameTrip(state.trip, currentTrip)
        ? { kind: 'ready', quote: state.quote, trip: state.trip }
        : { kind: 'outdated', quote: state.quote, trip: state.trip };
    case 'error':
      return { kind: 'error', problems: state.problems };
  }
}
