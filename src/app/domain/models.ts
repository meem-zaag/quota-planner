/**
 * Core domain types. Plain TypeScript only — no Angular imports in /domain.
 */

/** Location IDs are a closed union, so a typo like 'F' is a compile-time error. */
export type LocationId = 'A' | 'B' | 'C' | 'D' | 'E';

export interface TripLocation {
  readonly id: LocationId;
  readonly name: string;
}

export type TruckCategory = 'mini' | 'medium' | 'large';

export interface TruckSpec {
  readonly category: TruckCategory;
  readonly label: string;
  readonly capacityTonnes: number;
  readonly ratePerKm: number;
  readonly minimumFare: number;
}

/**
 * A complete, validated trip — the input to a quote.
 * `pickupDateTime` is a local date-time string as produced by <input type="datetime-local">,
 * e.g. "2026-11-22T09:30".
 */
export interface TripRequest {
  readonly pickup: LocationId;
  readonly dropoffs: readonly LocationId[];
  readonly truckCategory: TruckCategory;
  readonly truckCount: number;
  readonly cargoWeightTonnes: number;
  readonly pickupDateTime: string;
  readonly loadingAssistance: boolean;
  readonly unloadingAssistance: boolean;
}

/** The result of pricing a trip. All money values are in BDT. */
export interface QuoteBreakdown {
  readonly distanceKm: number;
  readonly farePerTruck: number;
  readonly transportCost: number;
  readonly serviceCost: number;
  readonly totalQuote: number;
}
