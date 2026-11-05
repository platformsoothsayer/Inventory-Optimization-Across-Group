import type { Store } from "./types";

export const ROAD_FACTOR = 1.3;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function roadKm(a: Store, b: Store): number {
  return haversineKm(a, b) * ROAD_FACTOR;
}

/** Days in transit with zero chance of sale: 3 days locally, 4 beyond 150 km, 5 beyond 300 km. */
export function transitDays(km: number): number {
  return 3 + (km > 150 ? 1 : 0) + (km > 300 ? 1 : 0);
}

export function sharesBrand(a: Store, b: Store, brand: string): boolean {
  return a.brands.includes(brand) && b.brands.includes(brand);
}
