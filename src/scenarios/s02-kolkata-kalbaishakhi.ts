import type { ScenarioConfig } from './types'
import { cell, districtKm, line } from './builders'

const center = { lat: 22.6, lon: 88.4 }
const motion = { speedKmh: 48, towardDeg: 130 }

export const s02: ScenarioConfig = {
  id: 's02-kolkata-kalbaishakhi',
  num: 2,
  group: 'frequent',
  title: 'Evening Kalbaishakhi over Kolkata',
  region: 'Kolkata and surroundings',
  season: 'Pre-monsoon · May',
  dateIso: '2026-05-06',
  nowClock: '17:30',
  story: 'Bow-shaped line from the northwest; lightning jump before it reaches the city.',
  center,
  radars: ['kolkata'],
  outageRadar: 'kolkata',
  districts: ['kolkata', 'howrah', 'hooghly', 'north-24-parganas', 'south-24-parganas'],
  language: 'bn',
  seed: 2207,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C21',
  presentGust: '60–70',
  cells: (rng) => {
    const h = districtKm(center, 'hooghly')
    const s = districtKm(center, 'south-24-parganas')
    return [
      ...line(rng, motion, {
        prefix: 'B',
        start: 1,
        cx: -78,
        cy: 66,
        n: 10,
        lengthKm: 210,
        bulgeKm: 34,
        tStart: [-150, -110],
        tPeak: [55, 95],
        tEnd: [220, 280],
        peak: [48, 55],
        radius: [8, 11],
        bowPeakBoost: 8,
        lightning: 1.2,
        stratiform: { behindKm: 45, peak: 32 },
      }),
      cell(motion, { id: 'C21', fx: h.x - 8, fy: h.y + 18, at: 0, tStart: -40, tPeak: 30, tEnd: 140, peak: 55, radius: 8 }),
      cell(motion, { id: 'N01', fx: s.x + 10, fy: s.y + 25, tStart: 20, tPeak: 70, tEnd: 170, peak: 56, radius: 10 }),
    ]
  },
  captions: {
    1: 'A bow-shaped Kalbaishakhi line moves in from the northwest toward Kolkata — last hour of observations.',
    3: 'Watch the flash rate jump ahead of the bow: TADIT raises P(lightning) over the city before the line arrives.',
  },
}
