import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CLOCK } from '../core/clock';
import { TripRequest } from '../domain';
import { deriveQuoteView } from './quote-view';
import { QUOTE_LATENCY } from './quote.service';
import { QuoteStore } from './quote.store';

const tripAB: TripRequest = {
  pickup: 'A',
  dropoffs: ['B'],
  truckCategory: 'medium',
  truckCount: 1,
  cargoWeightTonnes: 2,
  pickupDateTime: '2026-11-21T13:00',
  loadingAssistance: false,
  unloadingAssistance: false,
};
const tripABC: TripRequest = { ...tripAB, dropoffs: ['B', 'C'] };

describe('QuoteStore (async + state consistency)', () => {
  let store: QuoteStore;
  let latencies: number[];
  let now: Date;

  beforeEach(() => {
    latencies = [];
    now = new Date(2026, 10, 21, 12, 0);
    TestBed.configureTestingModule({
      providers: [
        QuoteStore,
        // Each request takes the next delay from the queue — fully deterministic.
        { provide: QUOTE_LATENCY, useValue: () => latencies.shift() ?? 500 },
        { provide: CLOCK, useValue: { now: () => now } },
      ],
    });
    store = TestBed.inject(QuoteStore);
  });

  it('shows pending, then the quote, without waiting for real time', fakeAsync(() => {
    latencies.push(800);
    store.request(tripAB);
    expect(store.state().status).toBe('pending');

    tick(799);
    expect(store.state().status).toBe('pending');
    tick(1);
    const state = store.state();
    expect(state.status).toBe('success');
    expect(state.status === 'success' && state.quote.distanceKm).toBe(12);
  }));

  it('lets the latest request win even when an earlier one finishes later', fakeAsync(() => {
    latencies.push(1200, 300); // first request is slow, second is fast
    store.request(tripAB);
    store.request(tripABC);

    // The spinner reflects the LATEST request.
    const pending = store.state();
    expect(pending.status === 'pending' && pending.requestId).toBe(2);

    tick(300);
    const afterFast = store.state();
    expect(afterFast.status === 'success' && afterFast.trip).toEqual(tripABC);

    tick(900); // the slow, older request would have completed now
    const afterSlow = store.state();
    expect(afterSlow.status === 'success' && afterSlow.trip).toEqual(tripABC);
    expect(afterSlow.status === 'success' && afterSlow.quote.distanceKm).toBe(27);
  }));

  it('does not let an older completed request clear the newer pending indicator', fakeAsync(() => {
    latencies.push(300, 1000); // first request is fast, second is slow
    store.request(tripAB);
    store.request(tripABC);

    tick(300); // first would have finished — it was cancelled
    expect(store.state().status).toBe('pending');

    tick(700);
    expect(store.state().status).toBe('success');
  }));

  it('validates the pickup time against the clock at request time', fakeAsync(() => {
    now = new Date(2026, 10, 21, 13, 30); // pickup 13:00 is now in the past
    store.request(tripAB);
    tick(1000);
    const state = store.state();
    expect(state.status).toBe('error');
    expect(state.status === 'error' && state.problems).toContain('Pickup time must be in the future.');
  }));

  it('marks a quote as outdated once the form no longer matches its inputs', fakeAsync(() => {
    store.request(tripAB);
    tick(1200);
    expect(deriveQuoteView(store.state(), tripAB).kind).toBe('ready');
    expect(deriveQuoteView(store.state(), { ...tripAB, truckCount: 2 }).kind).toBe('outdated');
    expect(deriveQuoteView(store.state(), null).kind).toBe('outdated');
  }));

  it('reset cancels a pending request', fakeAsync(() => {
    store.request(tripAB);
    store.reset();
    tick(1200);
    expect(store.state().status).toBe('idle');
  }));
});
