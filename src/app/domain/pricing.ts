import { routeDistanceKm } from './locations';
import { QuoteBreakdown, TripRequest } from './models';
import { SERVICE_FEES, TRUCKS } from './trucks';

/**
 * Implements the pricing formulas from the brief exactly:
 *   1. distanceKm    = sum(consecutiveRouteDistances)
 *   2. farePerTruck  = max(distanceKm * ratePerKm, minimumFare)
 *   3. transportCost = farePerTruck * truckCount
 *   4. serviceCost   = selectedServiceFeesPerTruck * truckCount
 *   5. totalQuote    = transportCost + serviceCost
 *
 * Pure and synchronous: the async behaviour lives in QuoteService, not here.
 */
export function calculateQuote(trip: TripRequest): QuoteBreakdown {
  const truck = TRUCKS[trip.truckCategory];

  const distanceKm = routeDistanceKm([trip.pickup, ...trip.dropoffs]);
  const farePerTruck = Math.max(distanceKm * truck.ratePerKm, truck.minimumFare);
  const transportCost = farePerTruck * trip.truckCount;

  const serviceFeesPerTruck =
    (trip.loadingAssistance ? SERVICE_FEES.loading : 0) +
    (trip.unloadingAssistance ? SERVICE_FEES.unloading : 0);
  const serviceCost = serviceFeesPerTruck * trip.truckCount;

  return {
    distanceKm,
    farePerTruck,
    transportCost,
    serviceCost,
    totalQuote: transportCost + serviceCost,
  };
}
