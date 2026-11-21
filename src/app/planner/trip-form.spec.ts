import { Clock } from '../core/clock';
import { applyDraft, createTripForm, toTripRequest } from './trip-form';
import { quoteBlockers } from './trip-form.messages';

describe('trip form', () => {
  let now: Date;
  const clock: Clock = { now: () => now };

  const fill = () => {
    const form = createTripForm(clock);
    form.patchValue({
      pickup: 'A',
      dropoffs: ['B'],
      truckCategory: 'medium',
      truckCount: 2,
      cargoWeightTonnes: 5,
      pickupDateTime: '2026-11-21T14:00',
    });
    return form;
  };

  beforeEach(() => (now = new Date(2026, 10, 21, 12, 0)));

  it('produces a trip request only when valid', () => {
    const form = createTripForm(clock);
    expect(toTripRequest(form)).toBeNull();
    expect(quoteBlockers(form).length).toBeGreaterThan(0);

    const filled = fill();
    expect(filled.valid).toBeTrue();
    expect(toTripRequest(filled)?.dropoffs).toEqual(['B']);
  });

  it('flags cargo above truck capacity × count', () => {
    const form = fill();
    form.controls.cargoWeightTonnes.setValue(6.5); // 2 × 3 t = 6 t
    expect(form.hasError('overCapacity')).toBeTrue();
    form.controls.truckCount.setValue(3);
    expect(form.hasError('overCapacity')).toBeFalse();
  });

  it('flags the same location used as pickup and drop-off', () => {
    const form = fill();
    form.controls.dropoffs.at(0).setValue('A');
    expect(form.getError('duplicateLocations')).toEqual(['A']);
  });

  it('re-validates pickup time against the current clock, not only on edit', () => {
    const form = fill();
    expect(form.valid).toBeTrue();
    now = new Date(2026, 10, 21, 14, 5); // time passes, value unchanged
    expect(form.valid).toBeTrue(); // Angular has not re-run the validator yet…
    form.controls.pickupDateTime.updateValueAndValidity();
    expect(form.controls.pickupDateTime.hasError('notInFuture')).toBeTrue();
    expect(form.valid).toBeFalse();
  });

  it('rebuilds drop-off rows when a draft is applied', () => {
    const form = fill();
    applyDraft(form, { ...form.getRawValue(), dropoffs: ['C', 'D', 'E'] });
    expect(form.controls.dropoffs.length).toBe(3);
    expect(form.controls.dropoffs.value).toEqual(['C', 'D', 'E']);
  });
});
