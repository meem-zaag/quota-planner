import {
  LocationId,
  TruckCategory,
  MAX_DROPOFFS,
  isLocationId,
  isTruckCategory,
  isValidTruckCount,
  parseLocalDateTime,
} from '../domain';
import { DRAFT_VERSION, EMPTY_DRAFT, TripDraft } from './draft.model';

export interface ParsedDraft {
  /** The recovered draft, or null if nothing usable was stored. */
  readonly draft: TripDraft | null;
  readonly savedAt: Date | null;
  /** Human-readable notes about anything that was discarded or reset. */
  readonly issues: readonly string[];
}

const NOTHING: ParsedDraft = { draft: null, savedAt: null, issues: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Turns raw localStorage text into a safe TripDraft.
 *
 * Saved data is treated as UNTRUSTED input (it may be hand-edited, from an older
 * version, or corrupted). Strategy:
 *  - Unreadable JSON or the wrong overall shape → discard the whole draft.
 *  - A bad individual field → reset only that field and report it, so the user
 *    keeps as much of their work as possible.
 * The result never contains unknown location IDs, duplicate locations,
 * out-of-range truck counts or wrong types.
 */
export function parseDraft(raw: string | null): ParsedDraft {
  if (raw === null || raw === '') return NOTHING;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...NOTHING, issues: ['The saved draft could not be read and was discarded.'] };
  }

  if (!isRecord(data) || data['version'] !== DRAFT_VERSION || !isRecord(data['trip'])) {
    return { ...NOTHING, issues: ['The saved draft was in an unrecognised format and was discarded.'] };
  }

  const trip = data['trip'];
  const issues: string[] = [];

  // --- Locations: known IDs only, no duplicates, 1..MAX drop-off rows -------
  const used = new Set<LocationId>();
  const takeLocation = (value: unknown, label: string): LocationId | null => {
    if (value === null || value === undefined || value === '') return null;
    if (!isLocationId(value)) {
      issues.push(`${label} referred to an unknown location and was cleared.`);
      return null;
    }
    if (used.has(value)) {
      issues.push(`${label} duplicated another stop and was cleared.`);
      return null;
    }
    used.add(value);
    return value;
  };

  const pickup = takeLocation(trip['pickup'], 'Pickup');

  let rawDropoffs: unknown[] = Array.isArray(trip['dropoffs']) ? trip['dropoffs'] : [];
  if (!Array.isArray(trip['dropoffs']) && trip['dropoffs'] !== undefined) {
    issues.push('Drop-off locations were invalid and were cleared.');
  }
  if (rawDropoffs.length > MAX_DROPOFFS) {
    issues.push(`Only the first ${MAX_DROPOFFS} drop-off locations were kept.`);
    rawDropoffs = rawDropoffs.slice(0, MAX_DROPOFFS);
  }
  const dropoffs = rawDropoffs.map((d, i) => takeLocation(d, `Drop-off ${i + 1}`));
  if (dropoffs.length === 0) dropoffs.push(null);

  // --- Trucks ----------------------------------------------------------------
  let truckCategory: TruckCategory | null = null;
  if (isTruckCategory(trip['truckCategory'])) {
    truckCategory = trip['truckCategory'];
  } else if (trip['truckCategory'] != null) {
    issues.push('Truck category was not recognised and was cleared.');
  }

  let truckCount: number | null = EMPTY_DRAFT.truckCount;
  if (isValidTruckCount(trip['truckCount'])) {
    truckCount = trip['truckCount'];
  } else if (trip['truckCount'] != null) {
    issues.push('Number of trucks was out of range and was reset to 1.');
  }

  // --- Cargo: any finite number is kept (the form flags e.g. 0 as invalid) ---
  let cargoWeightTonnes: number | null = null;
  if (typeof trip['cargoWeightTonnes'] === 'number' && Number.isFinite(trip['cargoWeightTonnes'])) {
    cargoWeightTonnes = trip['cargoWeightTonnes'];
  } else if (trip['cargoWeightTonnes'] != null) {
    issues.push('Cargo weight was invalid and was cleared.');
  }

  // --- Pickup time: must be a well-formed value; "in the past" is NOT fixed
  // here — the form re-validates it against the current time on restore. ------
  let pickupDateTime = '';
  const rawTime = trip['pickupDateTime'];
  if (typeof rawTime === 'string' && parseLocalDateTime(rawTime) !== null) {
    pickupDateTime = rawTime;
  } else if (rawTime != null && rawTime !== '') {
    issues.push('Pickup date/time was invalid and was cleared.');
  }

  const bool = (value: unknown) => value === true;

  const savedAtRaw = data['savedAt'];
  const savedAtDate = typeof savedAtRaw === 'string' ? new Date(savedAtRaw) : null;
  const savedAt = savedAtDate && !Number.isNaN(savedAtDate.getTime()) ? savedAtDate : null;

  return {
    draft: {
      pickup,
      dropoffs,
      truckCategory,
      truckCount,
      cargoWeightTonnes,
      pickupDateTime,
      loadingAssistance: bool(trip['loadingAssistance']),
      unloadingAssistance: bool(trip['unloadingAssistance']),
    },
    savedAt,
    issues,
  };
}
