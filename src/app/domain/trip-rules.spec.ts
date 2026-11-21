import { parseLocalDateTime, isStrictlyFuture } from './local-date-time';
import { TripRequest } from './models';
import { findDuplicateLocations, validateTrip } from './trip-rules';

const now = new Date(2026, 10, 21, 12, 0); // 21 Nov 2026, 12:00 local

const validTrip: TripRequest = {
  pickup: 'A',
  dropoffs: ['B'],
  truckCategory: 'mini',
  truckCount: 2,
  cargoWeightTonnes: 3,
  pickupDateTime: '2026-11-21T12:01',
  loadingAssistance: false,
  unloadingAssistance: false,
};

describe('trip rules', () => {
  it('accepts a valid trip', () => {
    expect(validateTrip(validTrip, now)).toEqual([]);
  });

  it('detects duplicate locations anywhere in the route', () => {
    expect(findDuplicateLocations(['A', 'B', 'A'])).toEqual(['A']);
    expect(findDuplicateLocations(['A', null, null, 'B'])).toEqual([]);
    expect(validateTrip({ ...validTrip, dropoffs: ['B', 'B'] }, now)).toContain(
      'A location cannot appear twice in one trip.',
    );
  });

  it('allows cargo exactly at capacity but rejects anything above it', () => {
    // 2 Mini trucks = 3 tonnes capacity.
    expect(validateTrip({ ...validTrip, cargoWeightTonnes: 3 }, now)).toEqual([]);
    expect(validateTrip({ ...validTrip, cargoWeightTonnes: 3.01 }, now)).toContain(
      'Cargo weight exceeds the capacity of the selected trucks.',
    );
  });

  it('requires a pickup strictly later than now', () => {
    expect(isStrictlyFuture('2026-11-21T12:00', now)).toBeFalse(); // equal is not "later"
    expect(isStrictlyFuture('2026-11-21T12:01', now)).toBeTrue();
    expect(isStrictlyFuture('not-a-date', now)).toBeFalse();
  });

  it('rejects impossible calendar dates', () => {
    expect(parseLocalDateTime('2026-02-31T10:00')).toBeNull();
    expect(parseLocalDateTime('2026-02-28T10:00')).not.toBeNull();
  });

  it('rejects out-of-range truck counts and non-positive weight', () => {
    expect(validateTrip({ ...validTrip, truckCount: 6 }, now).length).toBeGreaterThan(0);
    expect(validateTrip({ ...validTrip, truckCount: 1.5 }, now).length).toBeGreaterThan(0);
    expect(validateTrip({ ...validTrip, cargoWeightTonnes: 0 }, now).length).toBeGreaterThan(0);
  });
});
