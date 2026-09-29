import type { ScenarioConfig } from './types'
import { cell, scatter } from './builders'

const center = { lat: 17.4, lon: 78.5 }
const motion = { speedKmh: 20, towardDeg: 225 }

export const s09: ScenarioConfig = {
  id: 's09-hyderabad-urban',
  num: 9,
  group: 'frequent',
  title: 'Evening storm over Hyderabad',
  region: 'Hyderabad metropolitan area',
  season: 'Pre-monsoon · May',
  dateIso: '2026-05-12',
  nowClock: '18:00',
  story: 'Urban cell growth over the city.',
  center,
  radars: ['hyderabad'],
  outageRadar: 'hyderabad',
  districts: ['hyderabad', 'ranga-reddy', 'medchal-malkajgiri', 'sangareddy'],
  language: 'te',
  seed: 9931,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C01',
  presentGust: '50–60',
  cells: (rng) => [
    cell(motion, { id: 'C01', fx: 14, fy: 20, at: 0, tStart: -35, tPeak: 38, tEnd: 160, peak: 60, radius: 10, lightning: 1.2 }),
    cell(motion, { id: 'N01', fx: -22, fy: -8, tStart: 22, tPeak: 65, tEnd: 170, peak: 57, radius: 9 }),
    ...scatter(rng, motion, {
      prefix: 'C',
      start: 11,
      cx: 10,
      cy: 25,
      rx: 110,
      ry: 70,
      n: 5,
      tStart: [-80, 60],
      grow: [35, 55],
      life: [60, 110],
      peak: [45, 55],
      radius: [6, 9],
    }),
  ],
  captions: {
    1: 'Early evening over Hyderabad: a cell northeast of the city is growing fast over the urban heat island.',
  },
}
