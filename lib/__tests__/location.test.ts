/**
 * location.test.ts — Tests for lib/location.ts's getCurrentTaskLocation.
 *
 * Verifies the three branches: permission granted + fix succeeds, permission
 * denied, and a native call throwing.
 */
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

import * as Location from 'expo-location';
import { getCurrentTaskLocation } from '@/lib/location';

describe('getCurrentTaskLocation', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns ok with lat/lng when permission is granted and the fix succeeds', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 59.9, longitude: 10.7 },
    });
    const result = await getCurrentTaskLocation();
    expect(result).toEqual({ status: 'ok', location: { lat: 59.9, lng: 10.7 } });
  });

  it('returns denied when permission is refused', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    const result = await getCurrentTaskLocation();
    expect(result).toEqual({ status: 'denied' });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('returns error when the native call throws', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValue(new Error('native failure'));
    const result = await getCurrentTaskLocation();
    expect(result).toEqual({ status: 'error' });
  });
});
