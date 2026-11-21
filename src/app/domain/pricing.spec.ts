import { routeDistanceKm, distanceBetween } from './locations';
import { TripRequest } from './models';
import { calculateQuote } from './pricing';

const baseTrip: TripRequest = {
  pickup: 'A',
  dropoffs: ['B', 'C'],
  truckCategory: 'medium',
  truckCount: 2,
  cargoWeightTonnes: 5,
  pickupDateTime: '2030-01-01T10:00',
  loadingAssistance: true,
  unloadingAssistance: false,
};

describe('pricing', () => {
  it('matches the verification example from the brief (A→B→C, 2 Medium, loading only)', () => {
    expect(calculateQuote(baseTrip)).toEqual({
      distanceKm: 27,
      farePerTruck: 2295,
      transportCost: 4590,
      serviceCost: 1200,
      totalQuote: 5790,
    });
  });

  it('applies the minimum fare per truck when the distance-based fare is lower', () => {
    // A→B = 12 km × 50 BDT = 600 BDT, below the Mini minimum of 1,200.
    const quote = calculateQuote({
      ...baseTrip,
      dropoffs: ['B'],
      truckCategory: 'mini',
      truckCount: 3,
      cargoWeightTonnes: 1,
      loadingAssistance: false,
    });
    expect(quote.farePerTruck).toBe(1200);
    expect(quote.transportCost).toBe(3600);
    expect(quote.serviceCost).toBe(0);
    expect(quote.totalQuote).toBe(3600);
  });

  it('charges both services per truck', () => {
    const quote = calculateQuote({ ...baseTrip, truckCount: 3, unloadingAssistance: true });
    expect(quote.serviceCost).toBe((600 + 400) * 3);
  });

  it('sums legs in the order given, with no return leg, and distances are symmetric', () => {
    expect(distanceBetween('C', 'A')).toBe(distanceBetween('A', 'C'));
    expect(routeDistanceKm(['A', 'B', 'C'])).toBe(12 + 15);
    expect(routeDistanceKm(['A', 'C', 'B'])).toBe(18 + 15);
    expect(routeDistanceKm(['E', 'D', 'C', 'B'])).toBe(17 + 22 + 15);
  });
});
