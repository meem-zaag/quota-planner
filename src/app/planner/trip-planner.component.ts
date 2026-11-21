import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { CLOCK } from '../core/clock';
import { DraftService } from '../drafts/draft.service';
import { EMPTY_DRAFT } from '../drafts/draft.model';
import { deriveQuoteView } from '../quote/quote-view';
import { QuoteStore } from '../quote/quote.store';
import { QuotePanelComponent } from './quote-panel/quote-panel.component';
import { RouteEditorComponent } from './route-editor/route-editor.component';
import { ShipmentDetailsComponent } from './shipment-details/shipment-details.component';
import { applyDraft, createTripForm, toDraft, toTripRequest } from './trip-form';
import { quoteBlockers } from './trip-form.messages';

/** How often the pickup time is re-checked against the clock while the page is open. */
export const PICKUP_RECHECK_MS = 30_000;

interface Notice {
  readonly tone: 'info' | 'warning' | 'danger';
  readonly message: string;
  readonly details?: readonly string[];
}

/**
 * Smart/container component: owns the form, the QuoteStore and draft handling.
 * Child components are presentational sections.
 */
@Component({
  selector: 'app-trip-planner',
  standalone: true,
  imports: [RouteEditorComponent, ShipmentDetailsComponent, QuotePanelComponent, DatePipe],
  providers: [QuoteStore], // one store per planner instance
  templateUrl: './trip-planner.component.html',
  styleUrl: './trip-planner.component.css',
})
export class TripPlannerComponent {
  private readonly clock = inject(CLOCK);
  private readonly drafts = inject(DraftService);
  private readonly store = inject(QuoteStore);

  readonly form = createTripForm(this.clock);

  /**
   * Bumped on every form event (value, status, touched…). Reading it inside a
   * computed() makes that computed re-evaluate whenever the form changes,
   * bridging Reactive Forms (RxJS) into signals.
   */
  private readonly formVersion = signal(0);

  readonly currentTrip = computed(() => (this.formVersion(), toTripRequest(this.form)));
  readonly blockers = computed(() => (this.formVersion(), quoteBlockers(this.form)));
  readonly quoteView = computed(() => deriveQuoteView(this.store.state(), this.currentTrip()));

  // --- Draft state ----------------------------------------------------------
  private readonly savedSnapshot = signal<string | null>(null);
  readonly savedAt = signal<Date | null>(null);
  readonly notice = signal<Notice | null>(null);
  readonly hasSavedDraft = computed(() => this.savedSnapshot() !== null);
  readonly hasUnsavedChanges = computed(
    () => (this.formVersion(), JSON.stringify(toDraft(this.form)) !== (this.savedSnapshot() ?? JSON.stringify(EMPTY_DRAFT))),
  );
  readonly storageAvailable = this.drafts.isAvailable;

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.form.events.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.formVersion.update((v) => v + 1));

    this.restoreDraft();

    // A pickup time can expire while the user is on the page; re-check it periodically.
    interval(PICKUP_RECHECK_MS)
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => this.form.controls.pickupDateTime.updateValueAndValidity());
  }

  requestQuote(): void {
    // Validate the pickup time against the clock NOW, not when it was typed.
    this.form.controls.pickupDateTime.updateValueAndValidity();
    const trip = toTripRequest(this.form);
    if (trip === null) {
      this.form.markAllAsTouched();
      return;
    }
    this.store.request(trip);
  }

  saveDraft(): void {
    const draft = toDraft(this.form);
    try {
      const savedAt = this.drafts.save(draft);
      this.savedSnapshot.set(JSON.stringify(draft));
      this.savedAt.set(savedAt);
      this.notice.set(null);
    } catch {
      this.notice.set({ tone: 'danger', message: 'The draft could not be saved. Browser storage may be full or disabled.' });
    }
  }

  startOver(): void {
    this.drafts.clear();
    this.store.reset();
    applyDraft(this.form, EMPTY_DRAFT);
    this.savedSnapshot.set(null);
    this.savedAt.set(null);
    this.notice.set({ tone: 'info', message: 'Draft cleared. You can start a new trip.' });
  }

  dismissNotice(): void {
    this.notice.set(null);
  }

  private restoreDraft(): void {
    const { draft, savedAt, issues } = this.drafts.load();
    if (draft) {
      applyDraft(this.form, draft); // re-runs all validators against the current time
      // If values were repaired, storage still holds the bad data → show as unsaved
      // so the user can save the cleaned-up version.
      this.savedSnapshot.set(issues.length > 0 ? 'repaired' : JSON.stringify(draft));
      this.savedAt.set(savedAt);
      // Surface a restored pickup time that has since passed.
      if (draft.pickupDateTime) this.form.controls.pickupDateTime.markAsTouched();
    }

    if (issues.length > 0) {
      this.notice.set({
        tone: 'warning',
        message: draft ? 'Your draft was restored, but some saved values were invalid and were reset:' : issues[0],
        details: draft ? issues : undefined,
      });
    } else if (draft) {
      this.notice.set({ tone: 'info', message: 'Your saved draft was restored. Request a quote to price it.' });
    }
  }
}
