// Doppler Weather Radar sites used in the prototype. Coordinates are APPROXIMATE and
// are shown on the map only for orientation — tooltips say so.

export interface RadarSite {
  id: string
  name: string
  lat: number
  lon: number
}

export const RADARS: Record<string, RadarSite> = {
  kolkata: { id: 'kolkata', name: 'Kolkata', lat: 22.57, lon: 88.35 },
  paradip: { id: 'paradip', name: 'Paradip', lat: 20.26, lon: 86.67 },
  gopalpur: { id: 'gopalpur', name: 'Gopalpur', lat: 19.26, lon: 84.91 },
  sambalpur: { id: 'sambalpur', name: 'Sambalpur', lat: 21.47, lon: 83.97 },
  patna: { id: 'patna', name: 'Patna', lat: 25.59, lon: 85.14 },
  delhi: { id: 'delhi', name: 'Delhi', lat: 28.59, lon: 77.22 },
  mumbai: { id: 'mumbai', name: 'Mumbai (Veravali)', lat: 19.12, lon: 72.87 },
  kochi: { id: 'kochi', name: 'Kochi', lat: 9.97, lon: 76.28 },
  sohra: { id: 'sohra', name: 'Sohra (Cherrapunji)', lat: 25.27, lon: 91.73 },
  hyderabad: { id: 'hyderabad', name: 'Hyderabad', lat: 17.39, lon: 78.49 },
  nagpur: { id: 'nagpur', name: 'Nagpur', lat: 21.15, lon: 79.09 },
  patiala: { id: 'patiala', name: 'Patiala', lat: 30.34, lon: 76.39 },
}
