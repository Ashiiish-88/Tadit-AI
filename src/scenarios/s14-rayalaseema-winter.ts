import type { ScenarioConfig } from './types'
import { cell, districtKm, scatter } from './builders'

const center = { lat: 14.9, lon: 77.7 }
const motion = { speedKmh: 20, towardDeg: 55 }

export const s14: ScenarioConfig = {
  id: 's14-rayalaseema-winter',
  num: 14,
  group: 'uncommon',
  title: 'Unseasonal winter thunderstorm over Rayalaseema',
  region: 'Anantapur–Kurnool, Andhra Pradesh',
  season: 'Unseasonal · January',
  dateIso: '2026-01-20',
  nowClock: '15:00',
  story: 'A January storm over one of the driest parts of the peninsula, at the far edge of radar range.',
  note: 'Target beyond the Hyderabad radar’s range',
  center,
  radars: ['hyderabad'],
  outageRadar: null,
  districts: ['anantapur', 'sri-sathya-sai', 'kurnool'],
  language: 'te',
  seed: 14411,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C01',
  presentGust: '40–50',
  defaultLayers: { sat: true },
  cells: (rng) => {
    const a = districtKm(center, 'anantapur')
    const s = districtKm(center, 'sri-sathya-sai')
    return [
      cell(motion, { id: 'C01', fx: a.x - 5, fy: a.y - 15, at: 0, tStart: -40, tPeak: 30, tEnd: 140, peak: 53, radius: 8 }),
      cell(motion, { id: 'N01', fx: s.x + 5, fy: s.y + 20, tStart: 18, tPeak: 60, tEnd: 150, peak: 52, radius: 8 }),
      ...scatter(rng, motion, {
        prefix: 'C',
        start: 11,
        cx: -20,
        cy: -40,
        rx: 80,
        ry: 60,
        n: 3,
        tStart: [-50, 40],
        grow: [40, 55],
        life: [50, 90],
        peak: [44, 51],
        radius: [6, 8],
      }),
    ]
  },
  captions: {
    1: 'January thunderstorms are unusual in Rayalaseema. Nobody here expects lightning today — which is when warnings matter most.',
  },
}
