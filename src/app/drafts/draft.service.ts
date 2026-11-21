import { Injectable, InjectionToken, inject } from '@angular/core';
import { CLOCK } from '../core/clock';
import { DRAFT_VERSION, StoredDraft, TripDraft } from './draft.model';
import { ParsedDraft, parseDraft } from './draft-parser';

export const DRAFT_STORAGE_KEY = 'quote-planner.draft';

/** Injected so tests can use an in-memory Storage instead of the real one. */
export const DRAFT_STORAGE = new InjectionToken<Storage | null>('DRAFT_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null; // e.g. storage blocked by browser privacy settings
    }
  },
});

/**
 * Persists a single draft in localStorage. Only the trip inputs are stored —
 * never a quote — so a restored draft can't revive an old estimate.
 */
@Injectable({ providedIn: 'root' })
export class DraftService {
  private readonly storage = inject(DRAFT_STORAGE);
  private readonly clock = inject(CLOCK);

  get isAvailable(): boolean {
    return this.storage !== null;
  }

  load(): ParsedDraft {
    let raw: string | null = null;
    try {
      raw = this.storage?.getItem(DRAFT_STORAGE_KEY) ?? null;
    } catch {
      return { draft: null, savedAt: null, issues: ['Saved drafts are unavailable in this browser.'] };
    }
    const parsed = parseDraft(raw);
    if (parsed.draft === null && raw !== null) {
      this.clear(); // don't keep showing the same corrupted data on every load
    }
    return parsed;
  }

  /** @returns the save time, or throws if storage is unavailable or full. */
  save(trip: TripDraft): Date {
    if (!this.storage) throw new Error('Local storage is not available.');
    const savedAt = this.clock.now();
    const stored: StoredDraft = { version: DRAFT_VERSION, savedAt: savedAt.toISOString(), trip };
    this.storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(stored));
    return savedAt;
  }

  clear(): void {
    try {
      this.storage?.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      /* nothing to clear */
    }
  }
}
