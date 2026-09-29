import type { ScenarioConfig } from './types'
import { cell, districtKm, scatter } from './builders'

const center = { lat: 26.2, lon: 91.7 }
const motion = { speedKmh: 22, towardDeg: 250 }

export const s08: ScenarioConfig = {
  id: 's08-brahmaputra-nocturnal',
  num: 8,
  group: 'frequent',
  title: 'Nocturnal thunderstorms over the Brahmaputra valley',
  region: 'Lower Brahmaputra valley',
  season: 'Pre-monsoon · April',
  dateIso: '2026-04-23',
  nowClock: '02:00',
  story: 'Night-time lightning outbreak.',
  center,
  radars: ['sohra'],
  outageRadar: 'sohra',
  districts: ['kamrup-metropolitan', 'kamrup', 'nalbari', 'darrang', 'morigaon'],
  language: 'as',
  seed: 8821,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C01',
  presentGust: '40–50',
  cells: (rng) => {
    const d = districtKm(center, 'darrang')
    const m = districtKm(center, 'morigaon')
    return [
      cell(motion, { id: 'C01', fx: d.x + 10, fy: d.y - 8, at: 0, tStart: -40, tPeak: 28, tEnd: 150, peak: 55, radius: 8, lightning: 1.9 }),
      cell(motion, { id: 'N01', fx: m.x - 6, fy: m.y + 4, tStart: 15, tPeak: 58, tEnd: 170, peak: 56, radius: 9, lightning: 2 }),
      ...scatter(rng, motion, {
        prefix: 'C',
        start: 11,
        cx: 40,
        cy: 20,
        rx: 90,
        ry: 45,
        n: 7,
        tStart: [-100, 30],
        grow: [35, 55],
        life: [80, 130],
        peak: [48, 57],
        radius: [6, 10],
        lightning: 1.8,
      }),
    ]
  },
  captions: {
    1: '2 a.m. over the Brahmaputra valley: a night-time lightning outbreak while most people are asleep.',
  },
}
