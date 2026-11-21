import { InjectionToken } from '@angular/core';

/**
 * Abstraction over "the current time". Production uses the real clock; tests
 * provide a fixed one so time-based rules (pickup must be in the future) are
 * deterministic.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = new InjectionToken<Clock>('CLOCK', {
  providedIn: 'root',
  factory: () => ({ now: () => new Date() }),
});
