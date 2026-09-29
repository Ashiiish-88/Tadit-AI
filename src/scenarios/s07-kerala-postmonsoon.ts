import type { ScenarioConfig } from './types'
import { cell, districtKm, scatter } from './builders'

const center = { lat: 9.9, lon: 76.4 }
const motion = { speedKmh: 9, towardDeg: 270 }

export const s07: ScenarioConfig = {
  id: 's07-kerala-postmonsoon',
  num: 7,
  group: 'frequent',
  title: 'Post-monsoon afternoon storms over Kerala',
  region: 'Central Kerala',
  season: 'Post-monsoon · October',
  dateIso: '2026-10-21',
  nowClock: '14:30',
  story: 'Slow cells with heavy lightning.',
  center,
  radars: ['kochi'],
  outageRadar: 'kochi',
  districts: ['ernakulam', 'idukki', 'kottayam', 'alappuzha', 'thrissur'],
  language: 'ml',
  seed: 7717,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C01',
  presentGust: '40–50',
  cells: (rng) => {
    const e = districtKm(center, 'ernakulam')
    const k = districtKm(center, 'kottayam')
    return [
      cell(motion, { id: 'C01', fx: e.x + 12, fy: e.y + 4, at: 0, tStart: -40, tPeak: 30, tEnd: 170, peak: 55, radius: 9, lightning: 2.2 }),
      cell(motion, { id: 'N01', fx: k.x + 6, fy: k.y + 2, tStart: 15, tPeak: 60, tEnd: 190, peak: 56, radius: 10, lightning: 2.4 }),
      ...scatter(rng, motion, {
        prefix: 'C',
        start: 11,
        cx: 45,
        cy: 5,
        rx: 45,
        ry: 70,
        n: 6,
        tStart: [-100, 40],
        grow: [40, 60],
        life: [110, 170],
        peak: [49, 57],
        radius: [7, 11],
        lightning: 2.2,
      }),
    ]
  },
  captions: {
    1: 'Slow-moving post-monsoon storms over the Western Ghats slopes of central Kerala — heavy lightning, little movement.',
  },
}
