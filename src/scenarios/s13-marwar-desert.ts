import type { ScenarioConfig } from './types'
import { cell, districtKm, scatter } from './builders'

const center = { lat: 26.6, lon: 73.3 }
const motion = { speedKmh: 30, towardDeg: 75 }

export const s13: ScenarioConfig = {
  id: 's13-marwar-desert',
  num: 13,
  group: 'uncommon',
  title: 'Rare desert thunderstorm over Marwar, Rajasthan',
  region: 'Marwar, west Rajasthan',
  season: 'Western disturbance · March',
  dateIso: '2026-03-17',
  nowClock: '16:00',
  story: 'A western disturbance triggers storms over a region that rarely sees them; no DWR covers it.',
  note: 'No DWR covers this domain — running on satellite + lightning + NWP',
  center,
  radars: [],
  outageRadar: null,
  districts: ['jodhpur', 'nagaur', 'pali'],
  language: 'hi',
  seed: 13331,
  motion,
  heroNewCell: 'N01',
  heroOnsetCell: 'C01',
  presentGust: '50–60',
  defaultLayers: { sat: true },
  cells: (rng) => {
    const j = districtKm(center, 'jodhpur')
    const n = districtKm(center, 'nagaur')
    return [
      cell(motion, { id: 'C01', fx: j.x - 15, fy: j.y + 10, at: 0, tStart: -40, tPeak: 30, tEnd: 140, peak: 54, radius: 9, lightning: 0.9 }),
      cell(motion, { id: 'N01', fx: n.x - 30, fy: n.y - 20, tStart: 20, tPeak: 65, tEnd: 160, peak: 53, radius: 10, lightning: 0.9 }),
      ...scatter(rng, motion, {
        prefix: 'C',
        start: 11,
        cx: -40,
        cy: 20,
        rx: 90,
        ry: 60,
        n: 3,
        tStart: [-60, 40],
        grow: [40, 55],
        life: [60, 100],
        peak: [45, 52],
        radius: [7, 10],
        lightning: 0.8,
      }),
    ]
  },
  captions: {
    1: 'Thunderstorms are uncommon over the Marwar desert in March. A western disturbance changes that today.',
    2: 'No DWR covers this area, yet satellite cooling and the first flashes already mark this cell.',
  },
}
