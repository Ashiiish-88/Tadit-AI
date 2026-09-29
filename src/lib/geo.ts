import { GRID } from '@/config'

export interface LatLon {
  lat: number
  lon: number
}

/** Local equirectangular projection around the scenario centre, in km (x east, y north). */
export function toKm(center: LatLon, lat: number, lon: number): { x: number; y: number } {
  const kx = 111.32 * Math.cos((center.lat * Math.PI) / 180)
  return { x: (lon - center.lon) * kx, y: (lat - center.lat) * 110.57 }
}

export function toLatLon(center: LatLon, x: number, y: number): LatLon {
  const kx = 111.32 * Math.cos((center.lat * Math.PI) / 180)
  return { lat: center.lat + y / 110.57, lon: center.lon + x / kx }
}

/** Grid pixel (column i, row j) centre in km. Row 0 is the northern edge. */
export function pixelKm(i: number, j: number) {
  return {
    x: (i + 0.5) * GRID.dxKm - GRID.halfWidthKm,
    y: GRID.halfWidthKm - (j + 0.5) * GRID.dxKm,
  }
}

export function kmToPixel(x: number, y: number) {
  return {
    i: (x + GRID.halfWidthKm) / GRID.dxKm - 0.5,
    j: (GRID.halfWidthKm - y) / GRID.dxKm - 0.5,
  }
}

/** Compass bearing (deg, clockwise from north) of a vector in km. */
export function bearing(u: number, v: number) {
  return ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export function compass(deg: number) {
  return DIRS[Math.round(deg / 22.5) % 16]
}

export function fmtLat(lat: number) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`
}
export function fmtLon(lon: number) {
  return `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
}
