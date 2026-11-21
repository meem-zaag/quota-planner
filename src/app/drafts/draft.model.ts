import { LocationId, TruckCategory } from '../domain';

/**
 * A possibly incomplete trip, exactly as the form holds it. Unlike TripRequest,
 * every field may be empty because drafts can be saved before the trip is valid.
 */
export interface TripDraft {
  readonly pickup: LocationId | null;
  readonly dropoffs: readonly (LocationId | null)[];
  readonly truckCategory: TruckCategory | null;
  readonly truckCount: number | null;
  readonly cargoWeightTonnes: number | null;
  readonly pickupDateTime: string;
  readonly loadingAssistance: boolean;
  readonly unloadingAssistance: boolean;
}

export const DRAFT_VERSION = 1;

/** What is written to localStorage. Versioned so the format can evolve safely. */
export interface StoredDraft {
  readonly version: typeof DRAFT_VERSION;
  readonly savedAt: string; // ISO timestamp
  readonly trip: TripDraft;
}

export const EMPTY_DRAFT: TripDraft = {
  pickup: null,
  dropoffs: [null],
  truckCategory: null,
  truckCount: 1,
  cargoWeightTonnes: null,
  pickupDateTime: '',
  loadingAssistance: false,
  unloadingAssistance: false,
};
