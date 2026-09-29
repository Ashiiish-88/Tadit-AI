import type { ScenarioConfig } from './types'
import { cell, districtKm, scatter } from './builders'

const center = { lat: 23.3, lon: 85.3 }
const motion = { speedKmh: 25, towardDeg: 100 }

export const s04: ScenarioConfig = {
  id: 's04-jharkhand-gap',
  num: 4,
  group: 'frequent',
  title: 'Storms in a radar gap over the Jharkhand plateau',
  region: 'Ranchi plateau',
  season: 'Pre-monsoon · May',
  dateIso: '2026-05-19',
  nowClock: '15:30',
  story: 'Satellite cooling + lightning carry the forecast where no radar sees.',
  note: 'Target outside radar range — running on satellite + lightning',
  center,
  radars: ['patna', 'kolkata'],
  outageRadar: null,
  districts: ['ranchi', 'khunti', 'gumla', 'lohardaga'],
  language: 'hi',
  seed: 4409,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C01',
  presentGust: '40–50',
  defaultLayers: { sat: true },
  cells: (rng) => {
    const r = districtKm(center, 'ranchi')
    const k = districtKm(center, 'khunti')
    return [
      cell(motion, { id: 'C01', fx: r.x - 20, fy: r.y + 10, at: 0, tStart: -40, tPeak: 30, tEnd: 140, peak: 56, radius: 8, lightning: 1.3 }),
      cell(motion, { id: 'N01', fx: k.x - 15, fy: k.y + 5, tStart: 15, tPeak: 60, tEnd: 170, peak: 57, radius: 9, lightning: 1.3 }),
      ...scatter(rng, motion, {
        prefix: 'C',
        start: 11,
        cx: -40,
        cy: -5,
        rx: 80,
        ry: 50,
        n: 5,
        tStart: [-80, 50],
        grow: [35, 55],
        life: [60, 110],
        peak: [48, 57],
        radius: [6, 10],
        lightning: 1.2,
      }),
    ]
  },
  captions: {
    1: 'No Doppler radar reaches the Ranchi plateau — the nearest rings end short of it. Satellite and lightning still see the storms.',
    7: 'In a radar gap TADIT runs on satellite + lightning + NWP; probability contours are wider to show the extra uncertainty.',
  },
}
