// Helpers to place storm elements in a scenario. All positions in km from the scenario centre.

import { toKm, type LatLon } from '@/lib/geo'
import type { Rng } from '@/lib/prng'
import { DISTRICTS, footprintCentre } from '@/data/districtHQ'
import type { CellSpec } from './types'

type Range = [number, number]
export interface Motion {
  speedKmh: number
  towardDeg: number
}

const rad = (d: number) => (d * Math.PI) / 180

/** Position (km) of a district's approximate footprint centre. */
export function districtKm(center: LatLon, id: string) {
  const [la, lo] = footprintCentre(DISTRICTS[id])
  return toKm(center, la, lo)
}

/** Back-compute the t = 0 position of something that forms at (fx, fy) at time tForm. */
export function at0(m: Motion, fx: number, fy: number, tForm: number) {
  const u = (m.speedKmh * Math.sin(rad(m.towardDeg))) / 60
  const v = (m.speedKmh * Math.cos(rad(m.towardDeg))) / 60
  return { x: fx - u * tForm, y: fy - v * tForm }
}

const r = (rng: Rng, [a, b]: Range) => rng.range(a, b)

/** Squall / bow line perpendicular to the motion, with an optional trailing stratiform region. */
export function line(
  rng: Rng,
  m: Motion,
  o: {
    prefix: string
    start: number
    cx: number
    cy: number
    n: number
    lengthKm: number
    bulgeKm: number
    tStart: Range
    tPeak: Range
    tEnd: Range
    peak: Range
    radius: Range
    lightning?: number
    /** make the centre of the line peak later / stronger (bow) */
    bowPeakBoost?: number
    stratiform?: { behindKm: number; peak: number }
  },
): CellSpec[] {
  const fwd = { x: Math.sin(rad(m.towardDeg)), y: Math.cos(rad(m.towardDeg)) }
  const axis = { x: Math.sin(rad(m.towardDeg + 90)), y: Math.cos(rad(m.towardDeg + 90)) }
  const out: CellSpec[] = []
  for (let k = 0; k < o.n; k++) {
    const s = (k / (o.n - 1) - 0.5) * o.lengthKm + rng.range(-6, 6)
    const u = (2 * s) / o.lengthKm
    const bulge = o.bulgeKm * (1 - u * u) + rng.range(-5, 5)
    const mid = 1 - Math.abs(u)
    out.push({
      id: `${o.prefix}${String(o.start + k).padStart(2, '0')}`,
      kind: 'cell',
      x: o.cx + axis.x * s + fwd.x * bulge,
      y: o.cy + axis.y * s + fwd.y * bulge,
      tStart: r(rng, o.tStart),
      tPeak: r(rng, o.tPeak),
      tEnd: r(rng, o.tEnd),
      peakDbz: Math.min(68, r(rng, o.peak) + (o.bowPeakBoost ?? 0) * mid),
      radiusKm: r(rng, o.radius),
      aspect: rng.range(1.5, 2.3),
      orientDeg: m.towardDeg + 90 + rng.range(-12, 12),
      lightning: o.lightning,
    })
  }
  if (o.stratiform) {
    out.push({
      id: `${o.prefix}S`,
      kind: 'stratiform',
      x: o.cx - fwd.x * o.stratiform.behindKm,
      y: o.cy - fwd.y * o.stratiform.behindKm,
      tStart: -260,
      tPeak: -90,
      tEnd: 420,
      peakDbz: o.stratiform.peak,
      radiusKm: o.lengthKm / 7,
      aspect: 4.2,
      orientDeg: m.towardDeg + 90,
    })
  }
  return out
}

/** Isolated cells scattered in an ellipse; positions are where each cell forms. */
export function scatter(
  rng: Rng,
  m: Motion,
  o: {
    prefix: string
    start: number
    cx: number
    cy: number
    rx: number
    ry: number
    n: number
    tStart: Range
    grow: Range
    life: Range
    peak: Range
    radius: Range
    lightning?: number
  },
): CellSpec[] {
  const out: CellSpec[] = []
  for (let k = 0; k < o.n; k++) {
    const a = rng.range(0, Math.PI * 2)
    const d = Math.sqrt(rng.next())
    const fx = o.cx + Math.cos(a) * o.rx * d
    const fy = o.cy + Math.sin(a) * o.ry * d
    const tStart = r(rng, o.tStart)
    const tPeak = tStart + r(rng, o.grow)
    const p = at0(m, fx, fy, tStart)
    out.push({
      id: `${o.prefix}${String(o.start + k).padStart(2, '0')}`,
      kind: 'cell',
      x: p.x,
      y: p.y,
      tStart,
      tPeak,
      tEnd: tPeak + r(rng, o.life),
      peakDbz: r(rng, o.peak),
      radiusKm: r(rng, o.radius),
      aspect: rng.range(1.1, 1.8),
      orientDeg: rng.range(0, 180),
      lightning: o.lightning,
    })
  }
  return out
}

/** A single cell located at (fx, fy) at time `at` (default: when it forms). */
export function cell(
  m: Motion,
  o: {
    id: string
    fx: number
    fy: number
    tStart: number
    tPeak: number
    tEnd: number
    peak: number
    radius: number
    aspect?: number
    orientDeg?: number
    lightning?: number
    speedKmh?: number
    towardDeg?: number
    /** time at which the cell is at (fx, fy); defaults to tStart */
    at?: number
  },
): CellSpec {
  const mm = { speedKmh: o.speedKmh ?? m.speedKmh, towardDeg: o.towardDeg ?? m.towardDeg }
  const p = at0(mm, o.fx, o.fy, o.at ?? o.tStart)
  return {
    id: o.id,
    kind: 'cell',
    x: p.x,
    y: p.y,
    speedKmh: o.speedKmh,
    towardDeg: o.towardDeg,
    tStart: o.tStart,
    tPeak: o.tPeak,
    tEnd: o.tEnd,
    peakDbz: o.peak,
    radiusKm: o.radius,
    aspect: o.aspect ?? 1.4,
    orientDeg: o.orientDeg ?? 30,
    lightning: o.lightning,
  }
}
