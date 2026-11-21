import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Clock } from '../core/clock';
import {
  LocationId,
  MAX_TRUCKS,
  MIN_TRUCKS,
  TripRequest,
  TruckCategory,
  findDuplicateLocations,
  fleetCapacityTonnes,
  isStrictlyFuture,
  parseLocalDateTime,
} from '../domain';
import { EMPTY_DRAFT, TripDraft } from '../drafts/draft.model';

/** Strongly typed form — `form.value.truckCount` is `number | null`, not `any`. */
export type TripForm = FormGroup<{
  pickup: FormControl<LocationId | null>;
  dropoffs: FormArray<FormControl<LocationId | null>>;
  truckCategory: FormControl<TruckCategory | null>;
  truckCount: FormControl<number | null>;
  cargoWeightTonnes: FormControl<number | null>;
  pickupDateTime: FormControl<string>;
  loadingAssistance: FormControl<boolean>;
  unloadingAssistance: FormControl<boolean>;
}>;

// ---------------------------------------------------------------------------
// Validators (thin adapters over the pure rules in /domain)
// ---------------------------------------------------------------------------

/**
 * Pickup must be strictly later than "now". Note that Angular only re-runs a
 * validator when the value changes, so the page also calls
 * updateValueAndValidity() on this control when a quote is requested and on a
 * timer — otherwise a time that was valid when typed could silently expire.
 */
export function futureDateTimeValidator(clock: Clock): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null; // `required` reports empty values
    if (parseLocalDateTime(value) === null) return { invalidDateTime: true };
    return isStrictlyFuture(value, clock.now()) ? null : { notInFuture: true };
  };
}

/** Group validator: the same location may not appear twice anywhere in the trip. */
export const uniqueLocationsValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const { pickup, dropoffs } = (group as TripForm).getRawValue();
  const duplicates = findDuplicateLocations([pickup, ...dropoffs]);
  return duplicates.length > 0 ? { duplicateLocations: duplicates } : null;
};

/** Group validator: cargo must fit in (capacity per truck × truck count). */
export const capacityValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const { truckCategory, truckCount, cargoWeightTonnes } = (group as TripForm).getRawValue();
  if (truckCategory === null || truckCount === null || cargoWeightTonnes === null) return null;
  const capacity = fleetCapacityTonnes(truckCategory, truckCount);
  return cargoWeightTonnes > capacity ? { overCapacity: { capacity, actual: cargoWeightTonnes } } : null;
};

/** Positive (> 0) number. Validators.min(0) would wrongly allow 0. */
export const positiveNumberValidator: ValidatorFn = (control: AbstractControl<number | null>) => {
  const v = control.value;
  if (v === null || (v as unknown) === '') return null;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? null : { notPositive: true };
};

// ---------------------------------------------------------------------------
// Construction & conversion
// ---------------------------------------------------------------------------

export function createDropoffControl(value: LocationId | null = null): FormControl<LocationId | null> {
  return new FormControl<LocationId | null>(value, Validators.required);
}

export function createTripForm(clock: Clock, draft: TripDraft = EMPTY_DRAFT): TripForm {
  return new FormGroup(
    {
      pickup: new FormControl<LocationId | null>(draft.pickup, Validators.required),
      dropoffs: new FormArray(draft.dropoffs.map((d) => createDropoffControl(d))),
      truckCategory: new FormControl<TruckCategory | null>(draft.truckCategory, Validators.required),
      truckCount: new FormControl<number | null>(draft.truckCount, [
        Validators.required,
        Validators.min(MIN_TRUCKS),
        Validators.max(MAX_TRUCKS),
      ]),
      cargoWeightTonnes: new FormControl<number | null>(draft.cargoWeightTonnes, [
        Validators.required,
        positiveNumberValidator,
      ]),
      pickupDateTime: new FormControl<string>(draft.pickupDateTime, {
        nonNullable: true,
        validators: [Validators.required, futureDateTimeValidator(clock)],
      }),
      loadingAssistance: new FormControl<boolean>(draft.loadingAssistance, { nonNullable: true }),
      unloadingAssistance: new FormControl<boolean>(draft.unloadingAssistance, { nonNullable: true }),
    },
    { validators: [uniqueLocationsValidator, capacityValidator] },
  );
}

/** Replaces the form contents with a draft (rebuilding the drop-off rows). */
export function applyDraft(form: TripForm, draft: TripDraft): void {
  const dropoffs = form.controls.dropoffs;
  dropoffs.clear({ emitEvent: false });
  draft.dropoffs.forEach((d) => dropoffs.push(createDropoffControl(d), { emitEvent: false }));
  form.reset({ ...draft, dropoffs: [...draft.dropoffs] });
}

/** Snapshot of the form as a (possibly incomplete) draft. */
export function toDraft(form: TripForm): TripDraft {
  return form.getRawValue();
}

/** The form as a complete trip — or null when the form is not valid. */
export function toTripRequest(form: TripForm): TripRequest | null {
  if (!form.valid) return null;
  const v = form.getRawValue();
  if (v.pickup === null || v.truckCategory === null || v.truckCount === null || v.cargoWeightTonnes === null) {
    return null;
  }
  if (v.dropoffs.some((d) => d === null)) return null;
  return {
    pickup: v.pickup,
    dropoffs: v.dropoffs as LocationId[],
    truckCategory: v.truckCategory,
    truckCount: v.truckCount,
    cargoWeightTonnes: v.cargoWeightTonnes,
    pickupDateTime: v.pickupDateTime,
    loadingAssistance: v.loadingAssistance,
    unloadingAssistance: v.unloadingAssistance,
  };
}
