// Procedural, deterministic scenario engine. Pure functions only — no DOM, no Math.random, no Date.
// The Web Worker (worker.ts) is a thin wrapper around generateRun().

import { createNoise3D } from 'simplex-noise'
import { FRAME_TIMES, GRID, LIGHTNING, PROB, RADAR_GOOD_RANGE_KM, RADAR_RANGE_KM, SAT_LEAD_MIN, TIME, WARNING_RULES } from '@/config'
import { createRng, hashBytes, mulberry32 } from '@/lib/prng'
import { toKm, toLatLon } from '@/lib/geo'
import { clockAdd } from '@/lib/time'
import { RADARS } from '@/data/radars'
import { DISTRICTS, footprintCentre } from '@/data/districtHQ'
import type { ScenarioConfig } from '@/scenarios/types'
import type {
  Attribution,
  CellFrame,
  CellTrack,
  DistrictGeometry,
  DistrictWarning,
  Flash,
  FrameStack,
  ProbVariant,
  RadarState,
  RulesConfig,
  RunBundle,
  WarnLevel,
  WarningDraft,
} from '@/types/run'
import {
  blur2,
  cellState,
  dilate,
  clamp,
  coreDbz,
  encode,
  fbm,
  intensity,
  logistic,
  makeGrid,
  renderDbz,
  type Grid,
  type SimCell,
} from './field'

const DBZ_SCALE = 1 / 3
const P_SCALE = 1 / 255
const SAT_OFFSET = 180
const CAPE_SCALE = 20

export function prepareCells(cfg: ScenarioConfig, offset = 0): { cells: SimCell[]; meanU: number; meanV: number } {
  const rng = createRng(cfg.seed ^ 0x5bd1e995)
  const specs = cfg.cells(createRng(cfg.seed))
  const toward = (cfg.motion.towardDeg * Math.PI) / 180
  const meanU = (cfg.motion.speedKmh * Math.sin(toward)) / 60
  const meanV = (cfg.motion.speedKmh * Math.cos(toward)) / 60
  const cells: SimCell[] = specs.map((s) => {
    const sp = s.speedKmh ?? cfg.motion.speedKmh
    const dir = ((s.towardDeg ?? cfg.motion.towardDeg) * Math.PI) / 180
    const u = (sp * Math.sin(dir)) / 60
    const v = (sp * Math.cos(dir)) / 60
    // shift the scenario so that "now" is `offset` minutes later
    return {
      ...s,
      x: s.x + u * offset,
      y: s.y + v * offset,
      tStart: s.tStart - offset,
      tPeak: s.tPeak - offset,
      tEnd: s.tEnd - offset,
      u,
      v,
      errDir: rng.range(0, Math.PI * 2),
      jumpLead: rng.range(10, 20),
    }
  })
  return { cells, meanU, meanV }
}

/** Small reflectivity preview at t = 0 for gallery thumbnails. */
export function previewDbz(cfg: ScenarioConfig, n = 96): Float32Array {
  const { cells, meanU, meanV } = prepareCells(cfg)
  const grid = makeGrid(n, GRID.halfWidthKm)
  const out = new Float32Array(n * n)
  renderDbz(out, grid, cells, 20, 0, createNoise3D(mulberry32(cfg.seed + 17)), meanU, meanV)
  return out
}

function satCooling(c: SimCell, t: number) {
  if (c.kind === 'stratiform') return 40 * Math.sqrt(intensity(c, t))
  return 95 * Math.sqrt(intensity(c, t + SAT_LEAD_MIN))
}

export interface RunOptions {
  nowOffset?: number
  rules?: RulesConfig
}

export function rulesFrom(r?: RulesConfig) {
  if (!r) return WARNING_RULES
  return {
    ...WARNING_RULES,
    yellow: { pLightning: r.yellowPLightning, p45: r.yellowP45 },
    orange: { p45: r.orangeP45, p54: r.orangeP54 },
    red: { p54: r.redP54 },
  }
}

export function generateRun(cfg: ScenarioConfig, geometry: DistrictGeometry[] = [], opts: RunOptions = {}): RunBundle {
  const offset = opts.nowOffset ?? 0
  const rules = rulesFrom(opts.rules)
  const t0 = performance.now()
  const stages: Record<string, number> = {}
  let tm = t0
  const mark = (k: string) => {
    const n = performance.now()
    stages[k] = Math.round(n - tm)
    tm = n
  }
  const N = GRID.nx
  const NN = N * N
  const grid = makeGrid(N, GRID.halfWidthKm)
  const { cells, meanU, meanV } = prepareCells(cfg, offset)
  const noise = createNoise3D(mulberry32(cfg.seed + 17))
  const center = cfg.center

  // ---- Radars & coverage -------------------------------------------------------------
  const radars: RadarState[] = cfg.radars.map((id) => {
    const r = RADARS[id]
    const p = toKm(center, r.lat, r.lon)
    return { id, name: r.name, lat: r.lat, lon: r.lon, x: p.x, y: p.y, active: true }
  })
  // Probabilities are smooth, so they are computed on a half-resolution grid and upsampled.
  const M = N / 2
  const MM = M * M
  const half = makeGrid(M, GRID.halfWidthKm)
  const coverageFor = (offline: string | null) => {
    const cov = new Uint8Array(NN)
    const q = new Float32Array(MM)
    const act = radars.filter((r) => r.id !== offline)
    const R2 = RADAR_RANGE_KM * RADAR_RANGE_KM
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        for (const r of act) {
          const dx = grid.xs[i] - r.x
          const dy = grid.ys[j] - r.y
          if (dx * dx + dy * dy <= R2) {
            cov[j * N + i] = 255
            break
          }
        }
      }
    for (let j = 0; j < M; j++)
      for (let i = 0; i < M; i++) {
        let best = 0
        for (const r of act) {
          const d = Math.hypot(half.xs[i] - r.x, half.ys[j] - r.y)
          best = Math.max(best, clamp((RADAR_RANGE_KM - d) / (RADAR_RANGE_KM - RADAR_GOOD_RANGE_KM), 0, 1))
        }
        q[j * M + i] = best
      }
    return { cov, q }
  }

  // ---- Reflectivity: observed (t ≤ 0) and TADIT forecast (t > 0) ----------------------
  const radarFrames: Uint8Array[] = []
  const forecastFloat: Float32Array[] = [] // lead 0..180, used for probabilities
  const buf = new Float32Array(NN)
  for (let k = 0; k < TIME.frameCount; k++) {
    const t = FRAME_TIMES[k]
    const lead = Math.max(0, t)
    renderDbz(buf, grid, cells, t, lead, noise, meanU, meanV)
    radarFrames.push(encode(buf, DBZ_SCALE))
    if (k >= TIME.nowIndex) forecastFloat.push(downMax(buf, N))
  }

  mark('radar')
  // ---- Satellite IR brightness temperature (K), observed frames only -----------------
  const satFrames: Uint8Array[] = []
  const satTimes = FRAME_TIMES.filter((t) => t <= 0)
  // thin-cloud texture computed once on a padded grid, then advected by shifting
  const PAD = 24
  const NP = N + 2 * PAD
  const thin = new Float32Array(NP * NP)
  for (let j = 0; j < NP; j++)
    for (let i = 0; i < NP; i++) {
      const x = (i - PAD + 0.5) * grid.dx - grid.half
      const y = grid.half - (j - PAD + 0.5) * grid.dx
      thin[j * NP + i] = Math.max(0, fbm(noise, x * 0.6 + 400, y * 0.6, 0)) * 22
    }
  for (const t of satTimes) {
    const T = new Float32Array(NN).fill(0)
    for (const c of cells) {
      const cool = satCooling(c, t)
      if (cool < 1) continue
      const f = Math.max(0.2, intensity(c, t + SAT_LEAD_MIN))
      const cx = c.x + c.u * t
      const cy = c.y + c.v * t
      const rr = c.kind === 'stratiform' ? c.radiusKm * 1.6 : c.radiusKm * 2.1
      // anvil: spreads downwind of the core
      const ax = cx + c.u * 25 * f
      const ay = cy + c.v * 25 * f
      const ar = rr * (1.2 + 1.3 * f)
      const ext = ar * 2.6
      const i0 = Math.max(0, Math.floor((Math.min(cx, ax) - ext + grid.half) / grid.dx))
      const i1 = Math.min(N - 1, Math.ceil((Math.max(cx, ax) + ext + grid.half) / grid.dx))
      const j0 = Math.max(0, Math.floor((grid.half - (Math.max(cy, ay) + ext)) / grid.dx))
      const j1 = Math.min(N - 1, Math.ceil((grid.half - (Math.min(cy, ay) - ext)) / grid.dx))
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const x = grid.xs[i]
          const y = grid.ys[j]
          const d1 = ((x - cx) ** 2 + (y - cy) ** 2) / (rr * rr)
          const d2 = ((x - ax) ** 2 + (y - ay) ** 2) / (ar * ar)
          const v = Math.max(cool * Math.exp(-0.5 * d1), 0.72 * cool * Math.exp(-0.5 * d2))
          const idx = j * N + i
          if (v > T[idx]) T[idx] = v
        }
    }
    const si = clamp(Math.round((-meanU * t) / grid.dx), -PAD, PAD)
    const sj = clamp(Math.round((meanV * t) / grid.dx), -PAD, PAD)
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const idx = j * N + i
        const th = thin[(j + PAD + sj) * NP + (i + PAD + si)]
        T[idx] = clamp(300 - Math.max(T[idx], th), 190, 305) - SAT_OFFSET
      }
    satFrames.push(encode(T, 1))
  }

  mark('sat')
  // ---- NWP CAPE (J/kg): high where storms form ---------------------------------------
  let capeF: Float32Array
  {
    const capeH = new Float32Array(MM)
    const genesis = cells.filter((c) => c.kind === 'cell').map((c) => ({ x: c.x + c.u * c.tStart, y: c.y + c.v * c.tStart }))
    for (let j = 0; j < M; j++)
      for (let i = 0; i < M; i++) {
        let s = 0
        for (const g of genesis) s += Math.exp(-((half.xs[i] - g.x) ** 2 + (half.ys[j] - g.y) ** 2) / (2 * 120 * 120))
        const nz = fbm(noise, half.xs[i] * 0.3 + 900, half.ys[j] * 0.3 - 500, 0)
        capeH[j * M + i] = clamp(700 + 2800 * (1 - Math.exp(-0.9 * s)) + 300 * nz, 200, 4200)
      }
    capeF = upsample2(capeH, M)
  }
  const capeAt = (x: number, y: number) => {
    const i = clamp(Math.round((x + grid.half) / grid.dx - 0.5), 0, N - 1)
    const j = clamp(Math.round((grid.half - y) / grid.dx - 0.5), 0, N - 1)
    return capeF[j * N + i]
  }

  mark('cape')
  // ---- Probabilities ----------------------------------------------------------------
  const scratch = new Float32Array(MM)
  const dxP = half.dx
  const probTimes = FRAME_TIMES.filter((t) => t >= 0)
  const baseProb = forecastFloat.map((F, idx) => {
    const lead = probTimes[idx]
    // Neighbourhood probability: dilate (max within radius) then smooth. Radius grows with lead;
    // the "wide" version is used where radar quality is low (gaps, outage, long range).
    const nbKm = 3 + 0.08 * lead
    const rD = Math.max(1, Math.round(nbKm / dxP))
    const rDW = Math.round((nbKm * 2 + 12) / dxP)
    const soft = 1.6 + 0.015 * lead
    const mk = (thr: number, s: number, rd: number, gain: number) => {
      const a = new Float32Array(MM)
      // logistic via lookup table over 0.1 dBZ steps
      const lut = new Float32Array(1001)
      for (let q = 0; q <= 1000; q++) lut[q] = logistic((q / 10 - thr) / s)
      for (let i = 0; i < MM; i++) {
        const q = (F[i] * 10 + 0.5) | 0
        a[i] = lut[q < 0 ? 0 : q > 1000 ? 1000 : q]
      }
      dilate(a, M, rd)
      blur2(a, scratch, M, Math.max(1, Math.round(rd * 0.8)))
      if (gain !== 1) for (let i = 0; i < MM; i++) a[i] *= gain
      return a
    }
    const l10 = Math.round(10 / dxP)
    return {
      p45N: mk(45, soft, rD, 0.86),
      p45W: mk(45, soft, rDW, 0.7),
      p54N: mk(55, soft, rD, 0.72),
      p54W: mk(55, soft, rDW, 0.58),
      pLN: mk(42, 2.5, rD + l10, 0.94),
      pLW: mk(42, 2.5, rDW + l10, 0.76),
    }
  })

  mark('probBase')
  const districtIds = cfg.districts
  const districtMasks = rasteriseDistricts(districtIds, geometry, grid, center)

  const buildVariant = (offline: string | null): ProbVariant => {
    const { cov, q } = coverageFor(offline)
    const blend = (nArr: Float32Array, wArr: Float32Array) => {
      const out = new Float32Array(MM)
      for (let i = 0; i < MM; i++) {
        const w = q[i]
        out[i] = Math.min(PROB.cap, w * nArr[i] + (1 - w) * wArr[i])
      }
      return upsample2(out, M)
    }
    const p45f = baseProb.map((b) => blend(b.p45N, b.p45W))
    const p54f = baseProb.map((b) => blend(b.p54N, b.p54W))
    const pLf = baseProb.map((b) => blend(b.pLN, b.pLW))
    const stack = (layer: 'p45' | 'p54' | 'pLightning', arr: Float32Array[]): FrameStack => ({
      layer,
      units: 'probability',
      scale: P_SCALE,
      offset: 0,
      times: probTimes,
      data: arr.map((a) => encode(a, P_SCALE)),
    })
    const districtWarnings = computeDistrictWarnings(districtIds, districtMasks, p45f, p54f, pLf, geometry, rules)
    return {
      p45: stack('p45', p45f),
      p54: stack('p54', p54f),
      pLightning: stack('pLightning', pLf),
      coverage: cov,
      districtWarnings,
    }
  }

  const outageRadar = cfg.outageRadar && cfg.radars.includes(cfg.outageRadar) ? cfg.outageRadar : null
  const normal = buildVariant(null)
  const outage = outageRadar ? buildVariant(outageRadar) : null

  mark('variants')
  // ---- Lightning flashes (truth) -----------------------------------------------------
  const flashRng = createRng(cfg.seed ^ 0x27d4eb2d)
  const flashes: Flash[] = []
  const firstFlash = new Map<string, number>()
  const inJump = (c: SimCell, t: number) => t >= c.tPeak - c.jumpLead - 20 && t <= c.tPeak - c.jumpLead
  for (let m = TIME.startMin - 30; m < TIME.endMin; m++) {
    for (const c of cells) {
      if (c.kind !== 'cell') continue
      const core = coreDbz(c, m)
      if (core < 45) continue
      let rate = LIGHTNING.baseRate * (core - 40) ** 2 * (c.lightning ?? 1)
      if (inJump(c, m)) rate *= LIGHTNING.jumpFactor
      const count = poisson(rate, flashRng.next)
      if (count > 0 && !firstFlash.has(c.id)) firstFlash.set(c.id, m)
      const r = c.radiusKm * (0.55 + 0.45 * intensity(c, m))
      for (let q = 0; q < count; q++) {
        const tt = m + flashRng.next()
        const x = c.x + c.u * tt + flashRng.normal() * r * 0.55
        const y = c.y + c.v * tt + flashRng.normal() * r * 0.55
        const ll = toLatLon(center, x, y)
        flashes.push({
          t: tt,
          x,
          y,
          lat: +ll.lat.toFixed(4),
          lon: +ll.lon.toFixed(4),
          type: flashRng.next() < LIGHTNING.cgFraction ? 'CG' : 'IC',
          cellId: c.id,
        })
      }
    }
  }
  flashes.sort((a, b) => a.t - b.t)

  mark('flashes')
  // ---- Cell tracks ---------------------------------------------------------------------
  const districtPts = districtIds.map((id) => {
    const dq = DISTRICTS[id]
    const [la, lo] = footprintCentre(dq)
    return { id, ...toKm(center, la, lo), r: dq.r }
  })
  const trackCells = cells.filter((c) => c.kind === 'cell')
  const tracks: CellTrack[] = trackCells.map((c) => {
    const tf = firstFlash.has(c.id) ? firstFlash.get(c.id)! : null
    const frames: CellFrame[] = FRAME_TIMES.map((t) => {
      const lead = Math.max(0, t)
      const st = cellState(c, t, lead)
      const core = st ? st.core : 0
      const x = st ? st.x : c.x + c.u * t
      const y = st ? st.y : c.y + c.v * t
      // P(lightning within next 30 min)
      let pL30: number
      let onset = false
      if (tf !== null && tf <= t) {
        pL30 = clamp(logistic((coreDbz(c, t + 15) - 44) / 3), 0.05, PROB.cap)
      } else if (tf !== null) {
        pL30 = clamp(0.12 + 0.8 * logistic((32 - (tf - t)) / 5), 0.05, PROB.cap)
        onset = pL30 >= 0.6 && core >= 25
      } else {
        pL30 = clamp(0.05 + 0.3 * logistic((coreDbz(c, t + 30) - 42) / 3), 0.05, 0.4)
      }
      return {
        t,
        x: +x.toFixed(2),
        y: +y.toFixed(2),
        maxDbz: +core.toFixed(1),
        pL30: +pL30.toFixed(3),
        onset,
        explain: explainCell(c, t, capeAt(x, y), inJump(c, t) && tf !== null && tf <= t),
        path: cellPath(c, t, districtPts),
      }
    })
    return {
      id: c.id,
      isNew: c.tStart > -10 && coreDbz(c, 0) < 30,
      firstFlashT: tf,
      u: c.u,
      v: c.v,
      radiusKm: c.radiusKm,
      aspect: c.aspect,
      orientDeg: c.orientDeg,
      frames,
    }
  })

  mark('cells')
  // ---- Warning drafts ------------------------------------------------------------------
  const warnings = draftWarnings(cfg, outage && cfg.outageDefault ? outage.districtWarnings : normal.districtWarnings)

  const manifest = {
    runId: `sim-${cfg.id}-${offset >= 0 ? 'p' : 'm'}${Math.abs(offset)}-${hashBytes(radarFrames[TIME.nowIndex]).toString(16)}`,
    scenarioId: cfg.id,
    title: cfg.title,
    simulated: true as const,
    source: 'procedural' as const,
    dateIso: cfg.dateIso,
    nowClock: clockAdd(cfg.nowClock, offset),
    grid: { nx: N, ny: N, dxKm: GRID.dxKm, halfWidthKm: GRID.halfWidthKm, center },
    stepMin: TIME.stepMin,
    times: FRAME_TIMES,
    radars,
    outageRadarId: outageRadar,
    districtIds,
    feeds: [
      { id: 'dwr' as const, label: `DWR mosaic (${radars.length})`, status: radars.length ? ('ok' as const) : ('missing' as const), simulated: true as const },
      { id: 'sat' as const, label: 'INSAT-3DS IR/WV', status: 'ok' as const, simulated: true as const },
      { id: 'lightning' as const, label: 'Lightning', status: 'ok' as const, simulated: true as const },
      { id: 'nwp' as const, label: 'NWP GFS 0.25°', status: 'ok' as const, simulated: true as const },
    ],
    meanMotion: { u: meanU, v: meanV },
  }

  return {
    manifest,
    radar: { layer: 'radar', units: 'dBZ', scale: DBZ_SCALE, offset: 0, times: FRAME_TIMES, data: radarFrames },
    satIR: { layer: 'satIR', units: 'K', scale: 1, offset: SAT_OFFSET, times: satTimes, data: satFrames },
    cape: { layer: 'cape', units: 'J/kg', scale: CAPE_SCALE, offset: 0, times: [0], data: [encode(capeF, CAPE_SCALE)] },
    normal,
    outage,
    cells: tracks,
    flashes,
    warnings,
    districtMasks,
    timings: { totalMs: Math.round(performance.now() - t0), stages },
  }
}

/** 2x2 max-pool (keeps storm cores when halving resolution). */
function downMax(src: Float32Array, n: number): Float32Array {
  const m = n / 2
  const out = new Float32Array(m * m)
  for (let j = 0; j < m; j++)
    for (let i = 0; i < m; i++) {
      const a = 2 * j * n + 2 * i
      out[j * m + i] = Math.max(src[a], src[a + 1], src[a + n], src[a + n + 1])
    }
  return out
}

/** Bilinear x2 upsample (m*m -> 2m*2m), pixel-centre aligned. Index/weight tables are cached. */
const upTables = new Map<number, { i0: Int32Array; i1: Int32Array; w: Float32Array }>()
function upsample2(src: Float32Array, m: number): Float32Array {
  const n = m * 2
  let tb = upTables.get(m)
  if (!tb) {
    tb = { i0: new Int32Array(n), i1: new Int32Array(n), w: new Float32Array(n) }
    for (let k = 0; k < n; k++) {
      const f = clamp((k + 0.5) / 2 - 0.5, 0, m - 1)
      tb.i0[k] = Math.floor(f)
      tb.i1[k] = Math.min(m - 1, tb.i0[k] + 1)
      tb.w[k] = f - tb.i0[k]
    }
    upTables.set(m, tb)
  }
  const { i0, i1, w } = tb
  const out = new Float32Array(n * n)
  for (let j = 0; j < n; j++) {
    const r0 = i0[j] * m
    const r1 = i1[j] * m
    const wy = w[j]
    const row = j * n
    for (let i = 0; i < n; i++) {
      const wx = w[i]
      const a = i0[i]
      const b = i1[i]
      const top = src[r0 + a] + (src[r0 + b] - src[r0 + a]) * wx
      const bot = src[r1 + a] + (src[r1 + b] - src[r1 + a]) * wx
      out[row + i] = top + (bot - top) * wy
    }
  }
  return out
}

export function groupThousands(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function poisson(lambda: number, rand: () => number): number {
  if (lambda <= 0) return 0
  if (lambda > 30) {
    // normal approximation
    const u = Math.max(1e-9, rand())
    const v = rand()
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z))
  }
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rand()
  } while (p > L)
  return k - 1
}

function explainCell(c: SimCell, t: number, cape: number, jump: boolean): Attribution[] {
  const out: Attribution[] = []
  const dT = satCooling(c, t) - satCooling(c, t - 20)
  if (Math.abs(dT) >= 1)
    out.push({
      label: dT > 0 ? `Cloud top cooled ${Math.round(dT)} K in 20 min` : `Cloud top warmed ${Math.round(-dT)} K in 20 min`,
      value: dT / 4,
    })
  const now = coreDbz(c, t)
  const dz = now - coreDbz(c, t - 20)
  if (dz > 1) out.push({ label: `45 dBZ echo deepening (+${Math.round(dz)} dBZ in 20 min)`, value: dz / 3 })
  else if (dz < -1) out.push({ label: `Core weakening (${Math.round(dz)} dBZ in 20 min)`, value: dz / 3 })
  else if (now >= 45) out.push({ label: `Mature core at ${Math.round(now)} dBZ`, value: (now - 42) / 4 })
  out.push({ label: `CAPE ${groupThousands(Math.round(cape / 50) * 50)} J/kg`, value: (cape - 1500) / 600 })
  if (jump) out.push({ label: 'Flash rate jumped ×3 in 20 min', value: 2.6 })
  return out
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 3)
    .map((a) => ({ label: a.label, value: +a.value.toFixed(2) }))
}

function cellPath(c: SimCell, t: number, pts: { id: string; x: number; y: number; r: number }[]) {
  const res: { districtId: string; etaMin: number }[] = []
  for (const p of pts) {
    for (let s = 0; s <= TIME.endMin - t; s += 5) {
      const tt = t + s
      if (coreDbz(c, tt) < 40) continue
      const x = c.x + c.u * tt
      const y = c.y + c.v * tt
      if (Math.hypot(x - p.x, y - p.y) <= p.r + c.radiusKm * 0.8) {
        res.push({ districtId: p.id, etaMin: s })
        break
      }
    }
  }
  return res.sort((a, b) => a.etaMin - b.etaMin)
}

function rasteriseDistricts(ids: string[], geometry: DistrictGeometry[], grid: Grid, center: { lat: number; lon: number }) {
  const out: Record<string, Uint32Array> = {}
  const N = grid.n
  for (const id of ids) {
    const geo = geometry.find((g) => g.districtId === id)
    const idx: number[] = []
    if (geo?.rings && geo.rings.length) {
      const rings = geo.rings.map((ring) => ring.map(([lon, lat]) => toKm(center, lat, lon)))
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const r of rings)
        for (const p of r) {
          minX = Math.min(minX, p.x)
          maxX = Math.max(maxX, p.x)
          minY = Math.min(minY, p.y)
          maxY = Math.max(maxY, p.y)
        }
      for (let j = 0; j < N; j++) {
        const y = grid.ys[j]
        if (y < minY || y > maxY) continue
        for (let i = 0; i < N; i++) {
          const x = grid.xs[i]
          if (x < minX || x > maxX) continue
          let inside = false
          for (const r of rings) if (pointInRing(x, y, r)) inside = !inside
          if (inside) idx.push(j * N + i)
        }
      }
    }
    if (!idx.length) {
      const dq = DISTRICTS[id]
      const [la, lo] = footprintCentre(dq)
      const p = toKm(center, la, lo)
      const r = Math.max(dq.r, grid.dx)
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) if (Math.hypot(grid.xs[i] - p.x, grid.ys[j] - p.y) <= r) idx.push(j * N + i)
      if (!idx.length) {
        const i = clamp(Math.round((p.x + grid.half) / grid.dx - 0.5), 0, N - 1)
        const j = clamp(Math.round((grid.half - p.y) / grid.dx - 0.5), 0, N - 1)
        idx.push(j * N + i)
      }
    }
    out[id] = Uint32Array.from(idx)
  }
  return out
}

function pointInRing(x: number, y: number, ring: { x: number; y: number }[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function computeDistrictWarnings(
  ids: string[],
  masks: Record<string, Uint32Array>,
  p45: Float32Array[],
  p54: Float32Array[],
  pL: Float32Array[],
  geometry: DistrictGeometry[],
  R: typeof WARNING_RULES,
): DistrictWarning[] {
  return ids.map((id) => {
    const m = masks[id]
    let m45 = 0
    let m54 = 0
    let mL = 0
    let eta: number | null = null
    const hit = new Uint8Array(m.length)
    for (let k = 0; k < p45.length; k++) {
      let fL = 0
      for (let q = 0; q < m.length; q++) {
        const i = m[q]
        const a = p45[k][i]
        const b = p54[k][i]
        const c = pL[k][i]
        if (a > m45) m45 = a
        if (b > m54) m54 = b
        if (c > fL) fL = c
        if (Math.max(a, c) >= R.shareThreshold) hit[q] = 1
      }
      if (fL > mL) mL = fL
      if (eta === null && fL >= R.etaThreshold) eta = k * TIME.stepMin
    }
    let share = 0
    for (let q = 0; q < hit.length; q++) share += hit[q]
    share /= Math.max(1, hit.length)
    let level: WarnLevel = 'green'
    if (mL >= R.yellow.pLightning || m45 >= R.yellow.p45) level = 'yellow'
    if (m45 >= R.orange.p45 || m54 >= R.orange.p54) level = 'orange'
    if (m54 >= R.red.p54) level = 'red'
    const ph = R.phrase.find((p) => share <= p.maxShare) ?? R.phrase[R.phrase.length - 1]
    const hasPoly = !!geometry.find((g) => g.districtId === id)?.rings?.length
    return {
      districtId: id,
      level,
      maxPLightning: +mL.toFixed(3),
      maxP45: +m45.toFixed(3),
      maxP54: +m54.toFixed(3),
      share: +share.toFixed(3),
      phrase: ph.en,
      phraseHi: ph.hi,
      etaMin: eta,
      footprint: hasPoly ? 'polygon' : 'approx-disc',
    }
  })
}

const INTENSITY = { yellow: 'Light', orange: 'Moderate', red: 'Severe' } as const

function draftWarnings(cfg: ScenarioConfig, dw: DistrictWarning[]): WarningDraft[] {
  const levels = ['red', 'orange', 'yellow'] as const
  const out: WarningDraft[] = []
  for (const lvl of levels) {
    const ds = dw.filter((d) => d.level === lvl)
    if (!ds.length) continue
    const widest = ds.reduce((a, b) => (b.share > a.share ? b : a))
    out.push({
      id: `${cfg.id}-${lvl}`,
      level: lvl,
      districtIds: ds.sort((a, b) => (a.etaMin ?? 999) - (b.etaMin ?? 999)).map((d) => d.districtId),
      intensity: INTENSITY[lvl],
      phrase: widest.phrase,
      phraseHi: widest.phraseHi,
      validFromMin: 0,
      validToMin: 180,
    })
  }
  return out
}

/** Stable hash of every numeric output (excludes timings). Used by the determinism test. */
export function hashRun(run: RunBundle): string {
  let h = 0x811c9dc5
  const add = (a: Uint8Array) => (h = hashBytes(a, h))
  run.radar.data.forEach(add)
  run.satIR.data.forEach(add)
  run.cape.data.forEach(add)
  for (const v of [run.normal, run.outage]) {
    if (!v) continue
    v.p45.data.forEach(add)
    v.p54.data.forEach(add)
    v.pLightning.data.forEach(add)
  }
  const enc = new TextEncoder()
  add(enc.encode(JSON.stringify({ cells: run.cells, flashes: run.flashes, warnings: run.warnings, dw: run.normal.districtWarnings })))
  return h.toString(16).padStart(8, '0')
}
