import { AbstractControl } from '@angular/forms';
import { locationName, LocationId, TRUCKS } from '../domain';
import { TripForm } from './trip-form';

/** First error message for one control, or null. */
export function controlMessage(control: AbstractControl, field: string): string | null {
  const e = control.errors;
  if (!e) return null;
  if (e['required']) return `${field} is required.`;
  if (e['min'] || e['max']) return `${field} must be between ${e['min']?.min ?? 1} and ${e['max']?.max ?? 5}.`;
  if (e['notPositive']) return `${field} must be greater than 0.`;
  if (e['invalidDateTime']) return 'Enter a valid date and time.';
  if (e['notInFuture']) return 'Pickup time must be later than now.';
  return `${field} is invalid.`;
}

export function capacityMessage(form: TripForm): string | null {
  const err = form.errors?.['overCapacity'] as { capacity: number; actual: number } | undefined;
  if (!err) return null;
  const { truckCategory, truckCount } = form.getRawValue();
  const label = truckCategory ? TRUCKS[truckCategory].label : '';
  return `${err.actual} T exceeds the ${err.capacity} T capacity of ${truckCount} × ${label}. Reduce the weight or add trucks.`;
}

export function duplicateMessage(form: TripForm): string | null {
  const dups = form.errors?.['duplicateLocations'] as LocationId[] | undefined;
  if (!dups?.length) return null;
  return `${dups.map(locationName).join(', ')} appears more than once. Each stop must be unique.`;
}

/**
 * Plain-language checklist of what still blocks a quote. Shown next to the
 * disabled "Get quote" button so the user knows WHY it is disabled.
 */
export function quoteBlockers(form: TripForm): string[] {
  const c = form.controls;
  const blockers: string[] = [];
  if (c.pickup.invalid) blockers.push('Choose a pickup location');
  c.dropoffs.controls.forEach((d, i) => {
    if (d.invalid) blockers.push(`Choose drop-off ${i + 1}`);
  });
  const dup = duplicateMessage(form);
  if (dup) blockers.push(dup);
  if (c.truckCategory.invalid) blockers.push('Select a truck type');
  if (c.truckCount.invalid) blockers.push('Select the number of trucks');
  if (c.cargoWeightTonnes.invalid) blockers.push('Enter a cargo weight greater than 0');
  const cap = capacityMessage(form);
  if (cap) blockers.push('Cargo exceeds truck capacity');
  if (c.pickupDateTime.hasError('required')) blockers.push('Pick a pickup date and time');
  else if (c.pickupDateTime.invalid) blockers.push('Choose a pickup time later than now');
  return blockers;
}
