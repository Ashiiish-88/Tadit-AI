// Low-level field helpers shared by the engine: lifecycle, cell rendering, blur, logistic.

import type { CellSpec } from '@/scenarios/types'
import type { NoiseFunction3D } from 'simplex-noise'

export interface Grid {
  n: number
  dx: number
  /** pixel centre x (km) for each column */
  xs: Float32Array
  /** pixel centre y (km) for each row (row 0 = north) */
  ys: Float32Array
  half: number
}

export function makeGrid(n: number, halfWidthKm: number): Grid {
  const dx = (2 * halfWidthKm) / n
  const xs = new Float32Array(n)
  const ys = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    xs[i] = (i + 0.5) * dx - halfWidthKm
    ys[i] = halfWidthKm - (i + 0.5) * dx
  }
  return { n, dx, xs, ys, half: halfWidthKm }
}

export interface SimCell extends CellSpec {
  /** km/min */
  u: number
  v: number
  /** forecast position-error direction (radians) */
  errDir: number
  jumpLead: number
}

export const logistic = (z: number) => 1 / (1 + Math.exp(-z))
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

/** 0..1 lifecycle: sigmoid growth → mature → decay */
export function intensity(c: CellSpec, t: number): number {
  const grow = Math.max(4, c.tPeak - c.tStart)
  const g = logistic((t - (c.tStart + c.tPeak) / 2) / (grow / 7))
  const decayStart = c.tPeak + 0.35 * (c.tEnd - c.tPeak)
  const decay = Math.max(4, c.tEnd - decayStart)
  const d = 1 - logistic((t - (decayStart + c.tEnd) / 2) / (decay / 7))
  return g * d
}

/** core reflectivity (dBZ) of the true cell */
export function coreDbz(c: CellSpec, t: number): number {
  const f = intensity(c, t)
  if (f < 0.02) return 0
  return 18 + (c.peakDbz - 18) * f
}

export function forecastSigma(leadMin: number) {
  return leadMin > 0 ? 1 + 0.08 * leadMin : 0
}

export interface CellRenderState {
  x: number
  y: number
  core: number
  r: number
}

/** Cell state at time t; when lead > 0, apply TADIT forecast position error + blur. */
export function cellState(c: SimCell, t: number, lead: number): CellRenderState | null {
  const f = intensity(c, t)
  if (f < 0.02) return null
  let core = 18 + (c.peakDbz - 18) * f
  let r = c.radiusKm * (0.55 + 0.45 * f)
  let x = c.x + c.u * t
  let y = c.y + c.v * t
  if (lead > 0) {
    const s = forecastSigma(lead)
    const rEff = Math.sqrt(r * r + 0.5 * s * s)
    core = 12 + (core - 12) * Math.pow(r / rEff, 0.7)
    r = rEff
    x += Math.cos(c.errDir) * s * 0.7
    y += Math.sin(c.errDir) * s * 0.7
  }
  return { x, y, core, r }
}

export function fbm(noise: NoiseFunction3D, x: number, y: number, t: number) {
  return (
    0.58 * noise(x * 0.022, y * 0.022, t * 0.012) +
    0.28 * noise(x * 0.055, y * 0.055, t * 0.02 + 7.1) +
    0.14 * noise(x * 0.13, y * 0.13, t * 0.03 + 3.3)
  )
}

/** Render reflectivity (dBZ, float) at time t into out. */
export function renderDbz(
  out: Float32Array,
  grid: Grid,
  cells: SimCell[],
  t: number,
  lead: number,
  noise: NoiseFunction3D,
  meanU: number,
  meanV: number,
) {
  const { n, dx, xs, ys, half } = grid
  out.fill(0)
  for (const c of cells) {
    const st = cellState(c, t, lead)
    if (!st) continue
    const sa = Math.sqrt(c.aspect)
    const a = st.r * sa
    const b = st.r / sa
    const o = (c.orientDeg * Math.PI) / 180
    const so = Math.sin(o)
    const co = Math.cos(o)
    const ext = 3 * a
    const i0 = Math.max(0, Math.floor((st.x - ext + half) / dx))
    const i1 = Math.min(n - 1, Math.ceil((st.x + ext + half) / dx))
    const j0 = Math.max(0, Math.floor((half - (st.y + ext)) / dx))
    const j1 = Math.min(n - 1, Math.ceil((half - (st.y - ext)) / dx))
    const amp = st.core - 12
    for (let j = j0; j <= j1; j++) {
      const ddy = ys[j] - st.y
      const row = j * n
      for (let i = i0; i <= i1; i++) {
        const ddx = xs[i] - st.x
        const along = ddx * so + ddy * co
        const across = ddx * co - ddy * so
        const d2 = (along * along) / (a * a) + (across * across) / (b * b)
        if (d2 > 9) continue
        const v = 12 + amp * Math.exp(-0.5 * d2)
        if (v > out[row + i]) out[row + i] = v
      }
    }
  }
  // Multi-octave texture, advected with the mean motion; smoother at long lead.
  const texAmp = lead > 0 ? 6 * Math.exp(-lead / 110) + 1 : 6.5
  for (let j = 0; j < n; j++) {
    const row = j * n
    const y = ys[j] - meanV * t
    for (let i = 0; i < n; i++) {
      const v = out[row + i]
      if (v < 11) continue
      const w = clamp((v - 11) / 14, 0, 1)
      out[row + i] = v + texAmp * w * fbm(noise, xs[i] - meanU * t, y, t)
    }
  }
}

/** Separable running-sum box blur, applied twice (≈ triangular kernel). In-place on `a` using scratch `b`. */
export function blur2(a: Float32Array, b: Float32Array, n: number, r: number) {
  if (r < 1) return
  for (let pass = 0; pass < 2; pass++) {
    boxH(a, b, n, r)
    boxV(b, a, n, r)
  }
}

function boxH(src: Float32Array, dst: Float32Array, n: number, r: number) {
  const inv = 1 / (2 * r + 1)
  for (let j = 0; j < n; j++) {
    const row = j * n
    let acc = 0
    for (let k = -r; k <= r; k++) acc += src[row + clamp(k, 0, n - 1)]
    for (let i = 0; i < n; i++) {
      dst[row + i] = acc * inv
      acc += src[row + Math.min(n - 1, i + r + 1)] - src[row + Math.max(0, i - r)]
    }
  }
}

function boxV(src: Float32Array, dst: Float32Array, n: number, r: number) {
  const inv = 1 / (2 * r + 1)
  for (let i = 0; i < n; i++) {
    let acc = 0
    for (let k = -r; k <= r; k++) acc += src[clamp(k, 0, n - 1) * n + i]
    for (let j = 0; j < n; j++) {
      dst[j * n + i] = acc * inv
      acc += src[Math.min(n - 1, j + r + 1) * n + i] - src[Math.max(0, j - r) * n + i]
    }
  }
}

/** Separable max filter (neighbourhood maximum) of radius r, van Herk / Gil-Werman, O(n) per line. */
export function dilate(a: Float32Array, n: number, r: number) {
  if (r < 1) return
  const w = 2 * r + 1
  const line = new Float32Array(n)
  const g = new Float32Array(n)
  const h = new Float32Array(n)
  const pass = (stride: number, step: number) => {
    for (let o = 0; o < n; o++) {
      const base = o * stride
      for (let k = 0; k < n; k++) line[k] = a[base + k * step]
      for (let k = 0; k < n; k++) g[k] = k % w === 0 ? line[k] : Math.max(g[k - 1], line[k])
      for (let k = n - 1; k >= 0; k--) h[k] = k === n - 1 || (k + 1) % w === 0 ? line[k] : Math.max(h[k + 1], line[k])
      for (let k = 0; k < n; k++) {
        const lo = k - r < 0 ? 0 : k - r
        const hi = k + r > n - 1 ? n - 1 : k + r
        const x = h[lo]
        const y = g[hi]
        a[base + k * step] = x > y ? x : y
      }
    }
  }
  pass(n, 1) // rows
  pass(1, n) // columns
}

export function encode(src: Float32Array, scale: number, offset = 0): Uint8Array {
  const out = new Uint8Array(src.length)
  const inv = 1 / scale
  for (let i = 0; i < src.length; i++) out[i] = clamp(Math.round((src[i] - offset) * inv), 0, 255)
  return out
}
