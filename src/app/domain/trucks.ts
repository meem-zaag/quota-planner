import { TruckCategory, TruckSpec } from './models';

export const TRUCKS: Readonly<Record<TruckCategory, TruckSpec>> = {
  mini: { category: 'mini', label: 'Mini', capacityTonnes: 1.5, ratePerKm: 50, minimumFare: 1200 },
  medium: { category: 'medium', label: 'Medium', capacityTonnes: 3, ratePerKm: 85, minimumFare: 2000 },
  large: { category: 'large', label: 'Large', capacityTonnes: 7, ratePerKm: 145, minimumFare: 3500 },
};

export const TRUCK_LIST: readonly TruckSpec[] = Object.values(TRUCKS);

/** Optional services, priced per truck (BDT). */
export const SERVICE_FEES = {
  loading: 600,
  unloading: 400,
} as const;

export function isTruckCategory(value: unknown): value is TruckCategory {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TRUCKS, value);
}

/** Maximum cargo the selected fleet can carry. */
export function fleetCapacityTonnes(category: TruckCategory, truckCount: number): number {
  return TRUCKS[category].capacityTonnes * truckCount;
}
