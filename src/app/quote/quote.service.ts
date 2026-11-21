import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, defer, map, throwError, timer } from 'rxjs';
import { CLOCK } from '../core/clock';
import { QuoteBreakdown, TripRequest, calculateQuote, validateTrip } from '../domain';

export const MIN_LATENCY_MS = 300;
export const MAX_LATENCY_MS = 1200;

/**
 * Returns the simulated response time for the next quote, in ms.
 * Injected so tests can choose exact delays (e.g. make a later request finish
 * first) and drive them with fakeAsync/tick instead of waiting for real time.
 */
export const QUOTE_LATENCY = new InjectionToken<() => number>('QUOTE_LATENCY', {
  providedIn: 'root',
  factory: () => () => MIN_LATENCY_MS + Math.floor(Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS + 1)),
});

/** Raised when a trip fails the business rules at request time. */
export class QuoteValidationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(problems.join(' '));
    this.name = 'QuoteValidationError';
  }
}

/**
 * Simulates a remote pricing API entirely on the client.
 */
@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly clock = inject(CLOCK);
  private readonly latency = inject(QUOTE_LATENCY);

  /**
   * Cold observable: nothing happens until subscribed, and unsubscribing
   * cancels the pending timer (this is what lets switchMap cancel stale requests).
   * The trip is validated at subscription time against the current clock.
   */
  requestQuote(trip: TripRequest): Observable<QuoteBreakdown> {
    return defer(() => {
      const problems = validateTrip(trip, this.clock.now());
      if (problems.length > 0) {
        return throwError(() => new QuoteValidationError(problems));
      }
      return timer(this.latency()).pipe(map(() => calculateQuote(trip)));
    });
  }
}
