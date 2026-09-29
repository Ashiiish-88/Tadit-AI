import type { ScenarioConfig } from './types'
import { cell, districtKm, line } from './builders'

const center = { lat: 28.6, lon: 77.2 }
const motion = { speedKmh: 60, towardDeg: 95 }

export const s06: ScenarioConfig = {
  id: 's06-delhi-dust',
  num: 6,
  group: 'frequent',
  title: 'Pre-monsoon dust-thunderstorm over Delhi NCR',
  region: 'Delhi NCR',
  season: 'Pre-monsoon · May',
  dateIso: '2026-05-27',
  nowClock: '18:00',
  story: 'Fast outflow line from the west at 60 km/h; district ETA table.',
  center,
  radars: ['delhi'],
  outageRadar: 'delhi',
  districts: ['new-delhi', 'gurugram', 'faridabad', 'gautam-buddha-nagar', 'ghaziabad'],
  language: 'hi',
  seed: 6607,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C21',
  presentGust: '60–80',
  cells: (rng) => {
    const f = districtKm(center, 'faridabad')
    return [
      ...line(rng, motion, {
        prefix: 'L',
        start: 1,
        cx: -115,
        cy: 5,
        n: 9,
        lengthKm: 230,
        bulgeKm: 16,
        tStart: [-150, -110],
        tPeak: [-10, 50],
        tEnd: [200, 250],
        peak: [49, 57],
        radius: [7, 10],
        lightning: 0.9,
        stratiform: { behindKm: 40, peak: 30 },
      }),
      cell(motion, { id: 'C21', fx: -58, fy: 38, at: 0, tStart: -40, tPeak: 30, tEnd: 150, peak: 54, radius: 7 }),
      cell(motion, { id: 'N01', fx: f.x - 30, fy: f.y - 10, tStart: 25, tPeak: 70, tEnd: 170, peak: 55, radius: 8, speedKmh: 45 }),
    ]
  },
  captions: {
    1: 'A fast outflow line races toward Delhi NCR from the west at about 60 km/h.',
    6: 'Each district gets its own arrival time. The forecaster types the gust speed — TADIT never forecasts wind.',
  },
}
