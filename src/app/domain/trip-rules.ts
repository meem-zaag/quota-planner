import { isLocationId } from './locations';
import { isStrictlyFuture } from './local-date-time';
import { LocationId, TripRequest } from './models';
import { fleetCapacityTonnes, isTruckCategory } from './trucks';

export const MIN_DROPOFFS = 1;
export const MAX_DROPOFFS = 3;
export const MIN_TRUCKS = 1;
export const MAX_TRUCKS = 5;

/** Returns every location ID that appears more than once in the route. */
export function findDuplicateLocations(stops: readonly (LocationId | null)[]): LocationId[] {
  const seen = new Set<LocationId>();
  const duplicates = new Set<LocationId>();
  for (const stop of stops) {
    if (stop === null) continue;
    if (seen.has(stop)) duplicates.add(stop);
    seen.add(stop);
  }
  return [...duplicates];
}

export function isValidTruckCount(count: unknown): count is number {
  return typeof count === 'number' && Number.isInteger(count) && count >= MIN_TRUCKS && count <= MAX_TRUCKS;
}

export function isValidCargoWeight(weight: unknown): weight is number {
  return typeof weight === 'number' && Number.isFinite(weight) && weight > 0;
}

/**
 * Full business-rule check of a trip. Returns a list of human-readable problems
 * (empty = valid). The QuoteService calls this as a last line of defence, so an
 * invalid trip can never be priced even if the UI were bypassed.
 */
export function validateTrip(trip: TripRequest, now: Date): string[] {
  const errors: string[] = [];
  const stops = [trip.pickup, ...trip.dropoffs];

  if (!stops.every(isLocationId)) errors.push('Route contains an unknown location.');
  if (trip.dropoffs.length < MIN_DROPOFFS || trip.dropoffs.length > MAX_DROPOFFS) {
    errors.push(`Choose between ${MIN_DROPOFFS} and ${MAX_DROPOFFS} drop-off locations.`);
  }
  if (findDuplicateLocations(stops).length > 0) errors.push('A location cannot appear twice in one trip.');
  if (!isTruckCategory(trip.truckCategory)) errors.push('Unknown truck category.');
  if (!isValidTruckCount(trip.truckCount)) errors.push(`Truck count must be ${MIN_TRUCKS}-${MAX_TRUCKS}.`);
  if (!isValidCargoWeight(trip.cargoWeightTonnes)) errors.push('Cargo weight must be a positive number.');
  if (
    isTruckCategory(trip.truckCategory) &&
    isValidTruckCount(trip.truckCount) &&
    isValidCargoWeight(trip.cargoWeightTonnes) &&
    trip.cargoWeightTonnes > fleetCapacityTonnes(trip.truckCategory, trip.truckCount)
  ) {
    errors.push('Cargo weight exceeds the capacity of the selected trucks.');
  }
  if (!isStrictlyFuture(trip.pickupDateTime, now)) errors.push('Pickup time must be in the future.');

  return errors;
}
