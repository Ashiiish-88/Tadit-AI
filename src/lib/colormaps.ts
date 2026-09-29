// 256-entry RGBA lookup tables, indexed by the physical value encoded in each layer.

export type Lut = Uint8ClampedArray // 256 * 4

type Stop = [number, string, number] // value, hex, alpha 0..1

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function build(valueOf: (byte: number) => number, stops: Stop[], below: number): Lut {
  const lut = new Uint8ClampedArray(256 * 4)
  for (let b = 0; b < 256; b++) {
    const v = valueOf(b)
    if (v < below) continue
    let k = 0
    while (k < stops.length - 2 && v > stops[k + 1][0]) k++
    const [v0, c0, a0] = stops[k]
    const [v1, c1, a1] = stops[k + 1]
    const f = Math.max(0, Math.min(1, (v - v0) / (v1 - v0)))
    const A = hex(c0)
    const B = hex(c1)
    lut[b * 4] = A[0] + (B[0] - A[0]) * f
    lut[b * 4 + 1] = A[1] + (B[1] - A[1]) * f
    lut[b * 4 + 2] = A[2] + (B[2] - A[2]) * f
    lut[b * 4 + 3] = 255 * (a0 + (a1 - a0) * f)
  }
  return lut
}

// Standard meteorological reflectivity scale, 15–75 dBZ; transparent below 15.
export const DBZ_STOPS: Stop[] = [
  [15, '#2B6BD6', 0.55],
  [20, '#1EA5E3', 0.75],
  [25, '#19C2A4', 0.85],
  [30, '#22B03C', 0.9],
  [35, '#137F26', 0.92],
  [40, '#F2E30C', 0.95],
  [45, '#E9B10B', 0.95],
  [50, '#FF8A1F', 0.97],
  [55, '#F0413B', 0.98],
  [60, '#BE1420', 1],
  [65, '#E020D8', 1],
  [70, '#A23CE6', 1],
  [75, '#F3E8FF', 1],
]
export const dbzLut = build((b) => b / 3, DBZ_STOPS, 15)

// Probability: transparent below 10 %, cyan → violet.
export const PROB_STOPS: Stop[] = [
  [0.1, '#38D0F0', 0.16],
  [0.3, '#38D0F0', 0.3],
  [0.5, '#5AA2F5', 0.42],
  [0.7, '#7C6CF2', 0.52],
  [0.95, '#B055F0', 0.62],
]
export const probLut = build((b) => b / 255, PROB_STOPS, 0.1)

// Satellite IR brightness temperature (K): grey cloud tops, cold tops (< 220 K) enhanced blue-white.
export const IR_STOPS: Stop[] = [
  [190, '#FFFFFF', 0.95],
  [205, '#CFEAFF', 0.92],
  [220, '#6FB6F2', 0.85],
  [221, '#C8CDD6', 0.72],
  [250, '#8C93A0', 0.52],
  [275, '#5C6270', 0.3],
  [288, '#3A3F4A', 0.0],
]
export const irLut = (() => {
  const lut = new Uint8ClampedArray(256 * 4)
  const tmp = build((b) => b + 180, IR_STOPS, 0)
  for (let b = 0; b < 256; b++) {
    const k = b + 180
    if (k >= 288) continue
    lut.set(tmp.subarray(b * 4, b * 4 + 4), b * 4)
  }
  return lut
})()

// NWP CAPE (J/kg)
export const CAPE_STOPS: Stop[] = [
  [500, '#2A1E3A', 0.0],
  [1000, '#4B2E63', 0.28],
  [2000, '#9C3F6E', 0.38],
  [3000, '#E0663A', 0.45],
  [4000, '#FFC53D', 0.5],
]
export const capeLut = build((b) => b * 20, CAPE_STOPS, 500)

export function lutGradient(stops: Stop[]) {
  const lo = stops[0][0]
  const hi = stops[stops.length - 1][0]
  return `linear-gradient(90deg, ${stops
    .map(([v, c, a]) => {
      const [r, g, b] = hex(c)
      return `rgba(${r},${g},${b},${Math.max(a, 0.35)}) ${(((v - lo) / (hi - lo)) * 100).toFixed(1)}%`
    })
    .join(', ')})`
}
