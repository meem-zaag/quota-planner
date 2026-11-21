# Interview notes

## 60-second walkthrough

"It's an Angular 18 standalone app in four layers. `domain/` is plain TypeScript: the pricing
formulas and trip rules, with no Angular in it. `quote/` simulates an async pricing API and
manages request state. `drafts/` persists the form to localStorage and treats what it reads back
as untrusted. `planner/` holds the typed Reactive Form and the UI components. The two hard parts
are race conditions and staleness. `switchMap` plus request ids means the latest request wins,
and every quote remembers the exact inputs it was priced for, so if the form no longer matches,
the UI shows 'Out of date' instead of a price."

## Request flow (click "Get quote")

1. `TripPlannerComponent.requestQuote()` re-validates the pickup time against `CLOCK.now()`.
2. `toTripRequest(form)` returns a complete `TripRequest`, or `null` → mark all fields touched and stop.
3. `QuoteStore.request(trip)`: `latestRequestId++`, state = `pending` (for this id), push to `jobs$`.
4. `switchMap` unsubscribes from the previous job (cancelling its timer) and subscribes to
   `QuoteService.requestQuote(trip)`.
5. The service validates with `validateTrip` (the same rules as the form), waits 300–1200 ms, then runs `calculateQuote`.
6. The result is applied only if its `requestId === latestRequestId`.
7. `deriveQuoteView(state, currentTrip)` → `ready` only if the trips match, otherwise `outdated`.

## Likely questions

**Why both switchMap and a request id?** `switchMap` already cancels older requests. The id check
makes the guarantee explicit and independent of the operator, for example if someone later changes
it to `mergeMap` to allow parallel requests.

**How do tests avoid waiting for real timeouts?** The delay comes from the injectable `QUOTE_LATENCY`
function. Tests supply exact delays (e.g. `[1200, 300]`) and use `fakeAsync` + `tick()`,
which advance virtual time instantly.

**What happens if the user edits while a quote is pending?** The spinner stays (it belongs to the
latest request) with a warning. When the result arrives, its trip doesn't match the form, so it
is shown as "Out of date" and no amounts are displayed.

**Why is "Get quote" still enabled during a pending request?** The brief allows requesting again at
once. The new request supersedes the old one.

**How is "pickup time must be in the future" enforced?** By a control validator that uses the injected
clock. Validators only run when values change, so the control is also re-validated on request,
every 30 s and on draft restore. The service checks again too.

**Why a group validator for capacity and duplicates?** They depend on several controls. A group
validator re-runs when any child changes.

**How does drag and drop work?** CDK `cdkDropList`/`cdkDrag`. On drop, the actual `FormControl` is
moved inside the `FormArray` (`removeAt` + `insert`), so its value and touched state go with it.
`track ctrl` makes Angular move DOM nodes instead of recreating them.

**How do you handle malformed drafts?** Two levels. Unreadable or wrongly shaped data is discarded (and
removed from storage). A bad individual field is reset, and the user sees a list of what was
changed. Type guards (`isLocationId`, `isTruckCategory`) narrow `unknown` values safely.

**Why not store the quote in the draft?** A stored quote could become invalid (time passes, rules
change). The brief also says a restored draft must not make an old quote valid.

**Why is money not stored as floating point?** All inputs (km, rates, fees) are integers, so every
amount is an exact integer number of BDT. With fractional rates I would calculate in paisa (integers).

## Possible requirement changes and where they'd go

| Change                                    | Where                                                        |
| ----------------------------------------- | ------------------------------------------------------------ |
| New truck category or price change        | `domain/trucks.ts` only; the union type forces updates elsewhere |
| More locations / distances                | `domain/locations.ts`                                        |
| Return leg to pickup                      | `routeDistanceKm` in `domain/locations.ts` (+ a test)        |
| Max 5 drop-offs                           | `MAX_DROPOFFS` in `domain/trip-rules.ts`                     |
| Real backend API                          | Swap the `QuoteService` body for `HttpClient`; the store and UI stay the same |
| Show the old quote dimmed when outdated   | `quote-panel` template, `outdated` case (the data is already there) |
| Auto-save drafts                          | `form.events` + `debounceTime` → `DraftService.save`         |
| Several saved drafts                      | Change the key to a list, bump `DRAFT_VERSION`, migrate v1 in the parser |
| Weekend surcharge                         | `calculateQuote` takes the date; add a line to `QuoteBreakdown` |
