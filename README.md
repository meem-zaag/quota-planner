# Multi-Stop Trip Quote Planner

A browser-only Angular 18 single-page app for configuring a multi-stop truck trip, requesting an
asynchronous fare estimate, and saving an unfinished draft locally. No backend, map or external API.

## Environment

| Tool        | Version used                                                   |
| ----------- | -------------------------------------------------------------- |
| Node.js     | 22 LTS recommended (`.nvmrc`); Angular 18 supports 18.19+, 20.11+, 22 |
| npm         | 10+                                                            |
| Angular     | 18.2 (CLI 18.2.21), TypeScript 5.5                             |
| Angular CDK | 18.2 (drag & drop)                                             |
| Tests       | Karma + Jasmine, Chrome / ChromeHeadless                       |

> Also tested on Node 24. It works, but the Angular CLI prints an "unsupported Node version" warning.

## Setup, run and test

```bash
npm install
npm start            # dev server at http://localhost:4200
npm test             # Karma in watch mode (opens Chrome)
npm run test:ci      # single headless run, used for verification
npm run build        # production build to dist/
```

## Using the app

1. **Route**: choose a pickup and 1–3 drop-offs. Drag rows by the ⠿ handle to reorder them (arrow
   buttons are also available for keyboard users). A location already used elsewhere is disabled.
2. **Trucks & cargo**: pick a truck type, 1–5 trucks and the total weight. The available capacity is shown.
3. **Schedule & services**: a pickup date/time later than now, plus optional loading/unloading help.
4. **Get quote**: shows distance, transport subtotal, services subtotal and total. While the form is
   invalid the button is disabled and a checklist explains what is missing.
5. **Save draft / Start over**: in the header. Drafts survive refresh and are restored on load.

Each section card can be collapsed by clicking its header. A collapsed card shows a one-line
summary, or "Needs attention" if it contains errors.

Verification example from the brief: A → B → C, 2 × Medium, 5 T, loading only → **27 km,
4,590 + 1,200 = 5,790 BDT**.

## Project structure

```
src/app/
  domain/            Pure TypeScript, no Angular: types, locations/distances, trucks,
                     pricing formulas, trip rules, local date-time helpers
  core/clock.ts      Injectable clock (CLOCK token), so time-based rules are testable
  quote/
    quote.service    Async client-side "API": validates, then resolves after 300–1200 ms
    quote.store      Request state machine (idle/pending/success/error), latest request wins
    quote-view       Pure function: store state + current form → what the panel may show
  drafts/
    draft-parser     Treats saved JSON as untrusted; repairs or discards it
    draft.service    localStorage persistence (injectable storage)
  planner/
    trip-form        Typed Reactive Form, validators, form ↔ domain conversion
    trip-form.messages  User-facing error and checklist text
    trip-planner     Container component: wires form, store and drafts together
    route-editor / shipment-details / quote-panel   UI sections
  shared/
    select              Custom dropdown (ControlValueAccessor + CDK Overlay)
    date-time-picker    Custom calendar + time picker (same value format as datetime-local)
    collapsible-card    Section card with collapsible body and summary
```

## Main technical decisions

- **Layered design.** Business rules live in `domain/` as pure functions. The form validators,
  the QuoteService and the draft parser all reuse them, so a rule is defined once. The service
  re-validates every trip (defence in depth), so an invalid quote is impossible even if the UI is bypassed.
- **Typed Reactive Forms.** `FormGroup<{...}>` with a `FormArray` for drop-offs. Cross-field
  rules (duplicate locations, capacity) are group validators.
- **Pickup time vs the clock.** Angular re-runs validators only when a value changes. The pickup
  control is therefore re-validated when a quote is requested, every 30 s while the page is open,
  and when a draft is restored. "Now" comes from an injected `CLOCK`.
- **Async and race conditions.** `QuoteService.requestQuote()` returns a cold Observable
  (`defer` + `timer`), with the delay from an injectable `QUOTE_LATENCY` function. `QuoteStore`
  sends requests through `switchMap`, which cancels any earlier in-flight request, and also
  tags each request with an increasing id (a result is applied only if its id is still the
  latest). The loading state is set synchronously for the newest request, so an older request
  can neither overwrite a newer quote nor clear its spinner.
- **Never show a stale estimate as valid.** Each quote state stores the exact trip it was
  computed for. `deriveQuoteView()` compares it with the form's current trip: on any difference
  the panel shows "Out of date" and hides the amounts. If the user edits while a request is
  pending, a warning says the result will be out of date.
- **Drafts.** Stored as versioned JSON `{version, savedAt, trip}`. Only inputs are stored, never a
  quote, so a restored draft always needs a fresh estimate. The parser discards unreadable or
  wrongly shaped data and repairs individual bad fields (unknown IDs, duplicates, out-of-range
  truck counts, wrong types), listing what it changed. Past pickup times are kept but flagged as invalid.
- **Signals + RxJS.** RxJS handles async streams (timers, cancellation). Signals hold UI state.
  Form events are bridged into signals through a `formVersion` counter.
- **Plain CSS with design tokens** (CSS variables) instead of a UI library. This keeps
  dependencies minimal (only the official Angular CDK is added). The theme is a dark teal
  primary on white, and focus states change the border colour instead of drawing glow rings.
- **Custom dropdown and date-time picker.** Native `<select>` menus and the `datetime-local`
  popup are drawn by the browser and can't be styled. Both replacements implement
  `ControlValueAccessor`, so they plug into `[formControl]` like native inputs. They use the CDK
  Overlay for positioning and outside-click handling, and follow the combobox/listbox ARIA pattern with
  keyboard support. The picker emits the same `YYYY-MM-DDTHH:mm` string, so validators, drafts
  and tests didn't change.

## Significant issues encountered

- **Validators don't re-run as time passes.** A pickup time valid when typed could expire
  unnoticed. Fixed by explicit re-validation on request, on a timer and on restore (covered by tests).
- **Choosing between cancelling and ignoring stale responses.** `switchMap` cancels them. The
  request-id check is kept as a second, explicit guarantee.
- **Repaired drafts.** After repairing a malformed draft, the UI first showed "saved" even though
  storage still held the bad data. It now shows "Unsaved changes" so the cleaned version can be saved.
- **Native form submit.** A `<form>` without the forms directives would reload the page on Enter.
  The layout uses a plain container instead.
- **Node 24** isn't officially supported by Angular 18, so Node 22 is pinned in `.nvmrc`.

## How correctness was verified

- **33 automated tests** (`npm run test:ci`):
  - Pricing: the brief's verification example (5,790 BDT), minimum fare, per-truck services,
    symmetric distances, ordered legs with no return leg.
  - Rules: duplicates, capacity boundary (exactly at capacity is allowed), strictly-future time,
    impossible dates, truck count range.
  - Async (`fakeAsync` + `tick`, no real waiting): pending → success; a later fast request beats
    an earlier slow one; an older response can't clear the newer spinner; validation at request
    time; out-of-date detection; reset cancels pending.
  - Drafts: invalid JSON, wrong shape/version, unknown IDs, duplicates, wrong types,
    out-of-range counts, save/load round trip, corrupted data removed.
  - Component integration: full UI flow to 5,790 BDT, editing while pending, expired pickup
    time, refresh restoring a draft without a quote.
- **Manual browser checks**: the verification example, mouse drag-and-drop reordering (quote
  becomes "Out of date", distance updates to 33 km), save → refresh → restore, a hand-corrupted
  localStorage draft, capacity and past-time messages.

## AI tools disclosure

I built this with Claude Code (Anthropic's AI coding assistant, Claude Opus 5.5). Most of the code,
the tests and the first draft of this README were written by it. I worked through the brief with it
one step at a time, and committed after each step so I could roll back if something went wrong.

The product decisions were mine. I wanted a minimal white UI, so I asked for a dark teal accent, plain
borders instead of focus glows, collapsible sections, and "T" for tonnes. I also asked for a custom
dropdown and date picker, because the browser's native ones looked out of place and the date
picker blended into the page.

I didn't want to submit code I couldn't explain, so I went through the parts that matter most:

- the pricing formulas and trip rules in `domain/`;
- how the quote store makes sure only the latest request is shown, and how a quote gets marked
  "Out of date" (`quote/quote.store.ts`, `quote/quote-view.ts`);
- how the draft parser deals with broken saved data (`drafts/draft-parser.ts`);
- the form validators, especially re-checking the pickup time when a quote is requested
  (`planner/trip-form.ts`).

I ran `npm run test:ci` (36 tests, all passing) and `npm run build` myself, and then tried the app by
hand. I checked the example from the brief (A → B → C, 2 × Medium, 5 T, loading only comes to
5,790 BDT), and reordered drop-offs by dragging. I changed the trip while a quote was still loading
and clicked "Get quote" several times quickly. I also tried overloading the trucks and setting a
pickup time that had already passed, saved and restored a draft, and used "Start over". Finally, I
put a corrupted draft into localStorage to see that the app recovered and explained what it reset.
