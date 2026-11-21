import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, map, of, switchMap } from 'rxjs';
import { QuoteBreakdown, TripRequest } from '../domain';
import { QuoteService, QuoteValidationError } from './quote.service';

/**
 * Raw state of the most recent quote request. Every non-idle state carries the
 * exact trip it was produced for, so the UI can tell whether it still matches
 * the form (see quote-view.ts).
 */
export type QuoteState =
  | { readonly status: 'idle' }
  | { readonly status: 'pending'; readonly requestId: number; readonly trip: TripRequest }
  | { readonly status: 'success'; readonly requestId: number; readonly trip: TripRequest; readonly quote: QuoteBreakdown }
  | { readonly status: 'error'; readonly requestId: number; readonly trip: TripRequest; readonly problems: readonly string[] };

interface QuoteJob {
  readonly requestId: number;
  readonly trip: TripRequest;
}

/**
 * Owns quote requests for one planner page (provided at component level).
 *
 * Race-condition strategy — "latest request wins":
 *  1. Every request gets an increasing id and the state immediately becomes
 *     'pending' for THAT request, so the spinner always reflects the latest one.
 *  2. Requests flow through switchMap, which unsubscribes from (cancels) the
 *     previous in-flight request when a new one arrives. An older, slower
 *     response therefore can never overwrite a newer one.
 *  3. As a second guard, a result is only applied if its id is still the latest.
 */
@Injectable()
export class QuoteStore {
  private readonly quoteService = inject(QuoteService);
  private readonly jobs$ = new Subject<QuoteJob | null>();
  private latestRequestId = 0;

  private readonly _state = signal<QuoteState>({ status: 'idle' });
  readonly state = this._state.asReadonly();

  constructor() {
    this.jobs$
      .pipe(
        switchMap((job) => (job === null ? EMPTY : this.run(job))),
        takeUntilDestroyed(),
      )
      .subscribe((next) => {
        if (next.status !== 'idle' && next.requestId === this.latestRequestId) {
          this._state.set(next);
        }
      });
  }

  /** Starts a new quote for `trip`, superseding any request still in flight. */
  request(trip: TripRequest): void {
    const requestId = ++this.latestRequestId;
    this._state.set({ status: 'pending', requestId, trip });
    this.jobs$.next({ requestId, trip });
  }

  /** Cancels anything pending and returns to the empty state. */
  reset(): void {
    this.latestRequestId++;
    this.jobs$.next(null);
    this._state.set({ status: 'idle' });
  }

  private run({ requestId, trip }: QuoteJob) {
    return this.quoteService.requestQuote(trip).pipe(
      map((quote): QuoteState => ({ status: 'success', requestId, trip, quote })),
      catchError((err: unknown) =>
        of<QuoteState>({
          status: 'error',
          requestId,
          trip,
          problems: err instanceof QuoteValidationError ? err.problems : ['Could not calculate a quote. Please try again.'],
        }),
      ),
    );
  }
}
