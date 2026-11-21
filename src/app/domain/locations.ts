import { LocationId, TripLocation } from './models';

export const LOCATIONS: readonly TripLocation[] = [
  { id: 'A', name: 'Baily Road' },
  { id: 'B', name: 'Shahbagh' },
  { id: 'C', name: 'Bijoy Sarani' },
  { id: 'D', name: 'Banani' },
  { id: 'E', name: 'Uttara' },
];

const LOCATION_IDS: ReadonlySet<string> = new Set(LOCATIONS.map((l) => l.id));

/** Type guard: narrows unknown data (e.g. from localStorage) to a LocationId. */
export function isLocationId(value: unknown): value is LocationId {
  return typeof value === 'string' && LOCATION_IDS.has(value);
}

export function locationName(id: LocationId): string {
  return LOCATIONS.find((l) => l.id === id)?.name ?? id;
}

/**
 * Symmetric distances. Stored once per unordered pair, keyed with the IDs sorted
 * alphabetically ("A-B"), so A→B and B→A resolve to the same entry.
 */
const DISTANCES_KM: Readonly<Record<string, number>> = {
  'A-B': 12,
  'A-C': 18,
  'A-D': 26,
  'A-E': 30,
  'B-C': 15,
  'B-D': 29,
  'B-E': 24,
  'C-D': 22,
  'C-E': 28,
  'D-E': 17,
};

function pairKey(a: LocationId, b: LocationId): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function distanceBetween(a: LocationId, b: LocationId): number {
  if (a === b) {
    throw new Error(`No distance between a location and itself (${a}).`);
  }
  const km = DISTANCES_KM[pairKey(a, b)];
  if (km === undefined) {
    throw new Error(`Unknown distance for ${a}-${b}.`);
  }
  return km;
}

/**
 * Total distance of an ordered route: the sum of each consecutive leg.
 * There is no return leg to the pickup.
 */
export function routeDistanceKm(stops: readonly LocationId[]): number {
  let total = 0;
  for (let i = 1; i < stops.length; i++) {
    total += distanceBetween(stops[i - 1], stops[i]);
  }
  return total;
}
