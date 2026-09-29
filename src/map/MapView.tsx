import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, Crosshair } from 'lucide-react'
import { COLORS, GRID, LEVEL_COLORS, LIGHTNING, ONSET, PROB, RADAR_RANGE_KM, TIME } from '@/config'
import { useApp } from '@/state/store'
import { FieldImage } from './fieldImage'
import { capeLut, dbzLut, irLut, probLut } from '@/lib/colormaps'
import { contourPath } from '@/lib/contours'
import { toKm } from '@/lib/geo'
import { DISTRICTS, footprintCentre } from '@/data/districtHQ'
import type { CellTrack, DistrictWarning, RunBundle } from '@/types/run'
import { MapOverlays } from './MapOverlays'
import { cn } from '@/lib/utils'

interface View {
  cx: number
  cy: number
  s: number // CSS px per km
}

export interface HoverInfo {
  x: number
  y: number
  title: string
  lines: string[]
  swatch?: string
}

const N = GRID.nx
const HALF = GRID.halfWidthKm

type Caches = {
  runId: string
  radar: FieldImage
  extrap: FieldImage
  p45: FieldImage
  pL: FieldImage
  sat: FieldImage
  cape: FieldImage
  paths: Map<string, Path2D>
  districtIndex: Int16Array
  hatch: CanvasPattern | null
}

function lerpCell(c: CellTrack, t: number) {
  const pos = (t - TIME.startMin) / TIME.stepMin
  const k0 = Math.max(0, Math.min(TIME.frameCount - 1, Math.floor(pos)))
  const k1 = Math.min(TIME.frameCount - 1, k0 + 1)
  const f = Math.max(0, Math.min(1, pos - k0))
  const a = c.frames[k0]
  const b = c.frames[k1]
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    maxDbz: a.maxDbz + (b.maxDbz - a.maxDbz) * f,
    frame: f < 0.5 ? a : b,
  }
}

export function MapView({ compact = false }: { compact?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const calloutRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<View>({ cx: 0, cy: 0, s: 1.4 })
  const sizeRef = useRef({ w: 800, h: 600 })
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const dirtyRef = useRef(true)
  const cacheRef = useRef<Caches | null>(null)

  // ---- render loop ---------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let fly: { from: View; to: View; start: number; dur: number } | null = null
    let lastFlyNonce = -1

    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect()
      sizeRef.current = { w: r.width, h: r.height }
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(r.width * dpr)
      canvas.height = Math.round(r.height * dpr)
      canvas.style.width = `${r.width}px`
      canvas.style.height = `${r.height}px`
      dirtyRef.current = true
    })
    ro.observe(wrap)
    const unsub = useApp.subscribe(() => (dirtyRef.current = true))

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const st = useApp.getState()
      if (st.flyTo && st.flyTo.nonce !== lastFlyNonce && sizeRef.current.w > 0) {
        const to = { cx: st.flyTo.x, cy: st.flyTo.y, s: sizeRef.current.w / st.flyTo.widthKm }
        const firstSeen = lastFlyNonce === -1
        lastFlyNonce = st.flyTo.nonce
        if (st.flyTo.durationMs <= 0 || firstSeen) {
          viewRef.current = to
          fly = null
        } else fly = { from: { ...viewRef.current }, to, start: now, dur: st.flyTo.durationMs }
      }
      if (fly) {
        const p = Math.min(1, (now - fly.start) / fly.dur)
        const e = 1 - Math.pow(1 - p, 3)
        const v = viewRef.current
        v.cx = fly.from.cx + (fly.to.cx - fly.from.cx) * e
        v.cy = fly.from.cy + (fly.to.cy - fly.from.cy) * e
        v.s = Math.exp(Math.log(fly.from.s) + (Math.log(fly.to.s) - Math.log(fly.from.s)) * e)
        if (p >= 1) fly = null
        dirtyRef.current = true
      }
      const run = st.run
      if (!run) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = COLORS.bg
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        return
      }
      if (!cacheRef.current || cacheRef.current.runId !== run.manifest.runId) {
        cacheRef.current = makeCaches(run, ctx)
        dirtyRef.current = true
      }
      const animating = hasOnsetRing(run, st.t, st.layers.cells) || st.playing
      if (!dirtyRef.current && !animating) return
      dirtyRef.current = false
      draw(ctx, st, run, cacheRef.current, viewRef.current, sizeRef.current, now, calloutRef.current)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      unsub()
    }
  }, [])

  // ---- interaction ---------------------------------------------------------------------
  const drag = useRef<{ x: number; y: number; moved: boolean; splitting: boolean } | null>(null)

  const toKmAt = (clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect()
    const v = viewRef.current
    const sx = clientX - r.left
    const sy = clientY - r.top
    return { sx, sy, x: v.cx + (sx - r.width / 2) / v.s, y: v.cy - (sy - r.height / 2) / v.s }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const st = useApp.getState()
    const p = toKmAt(e.clientX, e.clientY)
    const splitting = st.tab === 'compare' && Math.abs(p.sx - st.split * sizeRef.current.w) < 14
    drag.current = { x: e.clientX, y: e.clientY, moved: false, splitting }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const st = useApp.getState()
    if (drag.current) {
      const dx = e.clientX - drag.current.x
      const dy = e.clientY - drag.current.y
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true
      if (drag.current.splitting) {
        const p = toKmAt(e.clientX, e.clientY)
        st.setSplit(p.sx / sizeRef.current.w)
      } else if (drag.current.moved) {
        const v = viewRef.current
        v.cx -= dx / v.s
        v.cy += dy / v.s
        dirtyRef.current = true
      }
      drag.current.x = e.clientX
      drag.current.y = e.clientY
      setHover(null)
      return
    }
    if (st.recording || !st.run) {
      if (hover) setHover(null)
      return
    }
    setHover(hitTest(st, toKmAt(e.clientX, e.clientY), viewRef.current, cacheRef.current))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved && !d.splitting) {
      const st = useApp.getState()
      const p = toKmAt(e.clientX, e.clientY)
      const cell = st.run && st.layers.cells ? nearestCell(st.run, st.t, p.x, p.y, 14 / viewRef.current.s) : null
      if (cell) st.selectCell(cell.id, false)
    }
  }
  const onWheel = (e: React.WheelEvent) => {
    const p = toKmAt(e.clientX, e.clientY)
    const v = viewRef.current
    const k = Math.exp(-e.deltaY * 0.0015)
    const s = Math.max(0.35, Math.min(12, v.s * k))
    v.cx = p.x - (p.x - v.cx) * (v.s / s)
    v.cy = p.y - (p.y - v.cy) * (v.s / s)
    v.s = s
    dirtyRef.current = true
  }
  const zoomBy = (k: number) => {
    const v = viewRef.current
    useApp.getState().fly(v.cx, v.cy, sizeRef.current.w / (v.s * k), 300)
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onWheel={onWheel}
      />
      <MapOverlays calloutRef={calloutRef} compact={compact} />
      {hover && (
        <div
          className="pointer-events-none absolute z-20 min-w-[180px] rounded-md border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <div className="flex items-center gap-2 font-medium text-foreground">
            {hover.swatch && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: hover.swatch }} />}
            {hover.title}
          </div>
          {hover.lines.map((l) => (
            <div key={l} className="mt-0.5 text-muted-foreground">
              {l}
            </div>
          ))}
        </div>
      )}
      <div className={cn('absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-md border bg-card/90', compact && 'hidden')}>
        <button className="p-2 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => zoomBy(1.4)} aria-label="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
        <button className="border-y p-2 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
        <button className="p-2 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => useApp.getState().flyHome(600)} aria-label="Reset view">
          <Crosshair className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ======================================================================================
// Drawing
// ======================================================================================

function makeCaches(run: RunBundle, ctx: CanvasRenderingContext2D): Caches {
  const districtIndex = new Int16Array(N * N).fill(-1)
  run.manifest.districtIds.forEach((id, k) => {
    const m = run.districtMasks[id]
    for (let q = 0; q < m.length; q++) if (districtIndex[m[q]] === -1) districtIndex[m[q]] = k
  })
  const pc = document.createElement('canvas')
  pc.width = pc.height = 8
  const p = pc.getContext('2d')!
  p.strokeStyle = 'rgba(138,155,181,0.35)'
  p.lineWidth = 1
  p.beginPath()
  p.moveTo(0, 8)
  p.lineTo(8, 0)
  p.stroke()
  return {
    runId: run.manifest.runId,
    radar: new FieldImage(N),
    extrap: new FieldImage(N),
    p45: new FieldImage(N),
    pL: new FieldImage(N),
    sat: new FieldImage(N),
    cape: new FieldImage(N),
    paths: new Map(),
    districtIndex,
    hatch: ctx.createPattern(pc, 'repeat'),
  }
}

function hasOnsetRing(run: RunBundle, t: number, cellsOn: boolean) {
  if (!cellsOn) return false
  const k = Math.round((t - TIME.startMin) / TIME.stepMin)
  return run.cells.some((c) => c.frames[k]?.onset)
}

type St = ReturnType<typeof useApp.getState>

function draw(
  ctx: CanvasRenderingContext2D,
  st: St,
  run: RunBundle,
  cache: Caches,
  view: View,
  size: { w: number; h: number },
  now: number,
  callout: HTMLDivElement | null,
) {
  const dpr = window.devicePixelRatio || 1
  const { w: W, h: H } = size
  const t = st.t
  const L = st.layers
  const compare = st.tab === 'compare'
  const variant = st.outage && run.outage ? run.outage : run.normal
  const vKey = st.outage && run.outage ? 'o' : 'n'
  const offline = st.outage ? run.manifest.outageRadarId : null

  const sx = (x: number) => W / 2 + (x - view.cx) * view.s
  const sy = (y: number) => H / 2 - (y - view.cy) * view.s

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, W, H)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const fieldRect = (dx = 0, dy = 0) => [sx(-HALF + dx), sy(HALF + dy), 2 * HALF * view.s, 2 * HALF * view.s] as const
  const gridTransform = () => {
    const a = GRID.dxKm * view.s * dpr
    ctx.setTransform(a, 0, 0, a, (W / 2 + (-HALF + GRID.dxKm / 2 - view.cx) * view.s) * dpr, (H / 2 - (HALF - GRID.dxKm / 2 - view.cy) * view.s) * dpr)
  }
  const resetT = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const strokeGridPath = (p: Path2D, color: string, px: number, dash?: number[]) => {
    gridTransform()
    ctx.strokeStyle = color
    ctx.lineWidth = px / (GRID.dxKm * view.s)
    ctx.setLineDash(dash ? dash.map((d) => d / (GRID.dxKm * view.s)) : [])
    ctx.stroke(p)
    ctx.setLineDash([])
    resetT()
  }

  // ---- graticule + domain ----
  drawGraticule(ctx, run, view, W, H, sx, sy)
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1
  ctx.strokeRect(...fieldRect())

  // ---- boundaries (only team-supplied Survey of India files) ----
  if (st.outline) {
    ctx.strokeStyle = '#3A4A66'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (const ring of st.outline) {
      ring.forEach(([lon, lat], i) => {
        const p = toKm(run.manifest.grid.center, lat, lon)
        if (i === 0) ctx.moveTo(sx(p.x), sy(p.y))
        else ctx.lineTo(sx(p.x), sy(p.y))
      })
      ctx.closePath()
    }
    ctx.stroke()
  }

  const pos = (t - TIME.startMin) / TIME.stepMin
  const k0 = Math.max(0, Math.min(TIME.frameCount - 1, Math.floor(pos)))
  const k1 = Math.min(TIME.frameCount - 1, k0 + 1)
  const f = Math.max(0, Math.min(1, pos - k0))
  const kNear = Math.round(pos)

  // ---- CAPE ----
  if (L.cape && !compare) {
    cache.cape.render(`cape`, run.cape.data[0], null, 0, capeLut)
    ctx.drawImage(cache.cape.canvas, ...fieldRect())
  }

  // ---- satellite IR ----
  if (L.sat && !compare) {
    const sp = Math.min(run.satIR.data.length - 1, (Math.min(0, t) - TIME.startMin) / TIME.stepMin)
    const s0 = Math.floor(sp)
    const s1 = Math.min(run.satIR.data.length - 1, s0 + 1)
    const sf = sp - s0
    cache.sat.render(`sat-${s0}-${s1}-${sf.toFixed(3)}`, run.satIR.data[s0], run.satIR.data[s1], sf, irLut)
    ctx.drawImage(cache.sat.canvas, ...fieldRect())
  }

  // ---- radar ----
  const cov = variant.coverage
  const maskFor = (k: number) => (TIME.startMin + k * TIME.stepMin <= 0 ? cov : null)
  if (compare) {
    const lead = st.compareLead
    const kL = TIME.nowIndex + lead / TIME.stepMin
    const splitX = st.split * W
    const mm = run.manifest.meanMotion
    cache.extrap.render(`ex-${vKey}`, run.radar.data[TIME.nowIndex], null, 0, dbzLut, cov)
    cache.radar.render(`fc-${kL}`, run.radar.data[kL], null, 0, dbzLut)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, splitX, H)
    ctx.clip()
    ctx.drawImage(cache.extrap.canvas, ...fieldRect(mm.u * lead, mm.v * lead))
    ctx.restore()
    ctx.save()
    ctx.beginPath()
    ctx.rect(splitX, 0, W - splitX, H)
    ctx.clip()
    ctx.drawImage(cache.radar.canvas, ...fieldRect())
    ctx.restore()
  } else if (L.radar) {
    cache.radar.render(`r-${vKey}-${k0}-${k1}-${f.toFixed(3)}`, run.radar.data[k0], run.radar.data[k1], f, dbzLut, maskFor(k0), maskFor(k1))
    ctx.drawImage(cache.radar.canvas, ...fieldRect())
  }

  // ---- probabilities (forecast only, t ≥ 0) ----
  if (!compare && t >= 0) {
    const pp = t / TIME.stepMin
    const p0 = Math.min(run.normal.p45.data.length - 1, Math.floor(pp))
    const p1 = Math.min(run.normal.p45.data.length - 1, p0 + 1)
    const pf = pp - p0
    const pk = Math.min(run.normal.p45.data.length - 1, Math.round(pp))
    const layers: [boolean, 'p45' | 'pLightning', FieldImage][] = [
      [L.pThunder, 'p45', cache.p45],
      [L.pLightning, 'pLightning', cache.pL],
    ]
    for (const [on, id, img] of layers) {
      if (!on) continue
      const stack = variant[id]
      img.render(`${id}-${vKey}-${p0}-${p1}-${pf.toFixed(3)}`, stack.data[p0], stack.data[p1], pf, probLut)
      ctx.drawImage(img.canvas, ...fieldRect())
      PROB.contours.forEach((lvl, li) => {
        const key = `${id}-${vKey}-${pk}-${lvl}`
        let path = cache.paths.get(key)
        if (!path) {
          path = contourPath(stack.data[pk], N, Math.round(lvl * 255))
          cache.paths.set(key, path)
        }
        strokeGridPath(path, li === 2 ? 'rgba(200,170,255,0.95)' : li === 1 ? 'rgba(120,170,250,0.85)' : 'rgba(56,208,240,0.7)', li === 2 ? 1.6 : 1.1, li === 0 ? [4, 3] : undefined)
      })
    }
  }

  // ---- districts ----
  const dwById = new Map<string, DistrictWarning>(variant.districtWarnings.map((d) => [d.districtId, d]))
  const center = run.manifest.grid.center
  for (const id of run.manifest.districtIds) {
    const dq = DISTRICTS[id]
    const dw = dwById.get(id)!
    const color = L.warnings && dw.level !== 'green' ? LEVEL_COLORS[dw.level] : null
    const rings = st.districtGeo[id]
    ctx.beginPath()
    if (rings) {
      for (const ring of rings) {
        ring.forEach(([lon, lat], i) => {
          const p = toKm(center, lat, lon)
          if (i === 0) ctx.moveTo(sx(p.x), sy(p.y))
          else ctx.lineTo(sx(p.x), sy(p.y))
        })
        ctx.closePath()
      }
    } else if (L.warnings) {
      const [la, lo] = footprintCentre(dq)
      const p = toKm(center, la, lo)
      ctx.arc(sx(p.x), sy(p.y), dq.r * view.s, 0, Math.PI * 2)
    }
    if (L.warnings && color) {
      // 35 % fill on real boundaries; lighter on overlapping approximate discs
      ctx.globalAlpha = rings ? 0.35 : 0.2
      ctx.fillStyle = color
      ctx.fill()
      ctx.globalAlpha = 1
    }
    if (rings || L.warnings) {
      ctx.strokeStyle = color ?? 'rgba(138,155,181,0.45)'
      ctx.lineWidth = color ? 1.5 : 1
      if (!rings) ctx.setLineDash([5, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
  // HQ markers + labels (always; they are the fallback when boundaries are missing)
  ctx.font = '500 11px Inter, sans-serif'
  ctx.textBaseline = 'middle'
  for (const id of run.manifest.districtIds) {
    const dq = DISTRICTS[id]
    const p = toKm(center, dq.lat, dq.lon)
    const x = sx(p.x)
    const y = sy(p.y)
    const lvl = dwById.get(id)!.level
    ctx.fillStyle = L.warnings && lvl !== 'green' ? LEVEL_COLORS[lvl] : '#C9D4E5'
    ctx.fillRect(x - 2.5, y - 2.5, 5, 5)
    ctx.strokeStyle = COLORS.bg
    ctx.lineWidth = 1
    ctx.strokeRect(x - 2.5, y - 2.5, 5, 5)
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(7,11,20,0.85)'
    ctx.strokeText(dq.name, x + 7, y)
    ctx.fillStyle = '#C9D4E5'
    ctx.fillText(dq.name, x + 7, y)
  }

  // ---- radar sites and range rings ----
  if (L.rings) {
    for (const r of run.manifest.radars) {
      const off = r.id === offline
      const x = sx(r.x)
      const y = sy(r.y)
      ctx.beginPath()
      ctx.arc(x, y, RADAR_RANGE_KM * view.s, 0, Math.PI * 2)
      if (off && cache.hatch) {
        ctx.fillStyle = 'rgba(40,48,64,0.35)'
        ctx.fill()
        ctx.fillStyle = cache.hatch
        ctx.fill()
      }
      ctx.strokeStyle = off ? 'rgba(138,155,181,0.45)' : 'rgba(56,208,240,0.28)'
      ctx.lineWidth = 1
      ctx.setLineDash(off ? [3, 5] : [6, 6])
      ctx.stroke()
      ctx.setLineDash([])
      // tower icon
      ctx.fillStyle = off ? '#5B6678' : '#E6EDF7'
      ctx.beginPath()
      ctx.moveTo(x, y - 7)
      ctx.lineTo(x - 4.5, y + 5)
      ctx.lineTo(x + 4.5, y + 5)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = off ? '#5B6678' : COLORS.ai
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(x, y - 7, 4, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
      ctx.font = '500 10px "JetBrains Mono", monospace'
      ctx.fillStyle = off ? '#8A9BB5' : '#9FDFF0'
      const label = `${r.name}${off ? ' · offline' : ''}`
      ctx.textAlign = 'center'
      ctx.fillText(label, x, y + 15)
      ctx.textAlign = 'left'
    }
  }

  // ---- cells: 45 dBZ outlines, tracks, badges, onset rings ----
  if (L.cells) {
    const kC = compare ? TIME.nowIndex + st.compareLead / TIME.stepMin : kNear
    const key = `dbz45-${vKey}-${kC}`
    let p45 = cache.paths.get(key)
    if (!p45) {
      const m = maskFor(kC)
      p45 = contourPath(run.radar.data[kC], N, 135, m ? (i) => m[i] > 0 : undefined)
      cache.paths.set(key, p45)
    }
    if (compare) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(st.split * W, 0, W, H)
      ctx.clip()
    }
    strokeGridPath(p45, 'rgba(255,255,255,0.8)', 1.1)
    if (compare) ctx.restore()

    const tc = compare ? st.compareLead : t
    for (const c of run.cells) {
      const s = lerpCell(c, tc)
      if (s.maxDbz < 35) continue
      const x = sx(s.x)
      const y = sy(s.y)
      if (compare && x < st.split * W) continue
      const sel = st.selectedCellId === c.id
      // past track
      ctx.fillStyle = 'rgba(230,237,247,0.55)'
      for (const back of [10, 20, 30]) {
        const pt = lerpCell(c, tc - back)
        if (pt.maxDbz < 30) continue
        ctx.beginPath()
        ctx.arc(sx(pt.x), sy(pt.y), 1.8, 0, Math.PI * 2)
        ctx.fill()
      }
      // 30-min motion arrow
      const ax = sx(s.x + c.u * 30)
      const ay = sy(s.y + c.v * 30)
      ctx.strokeStyle = sel ? COLORS.ai : 'rgba(230,237,247,0.85)'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(ax, ay)
      ctx.stroke()
      const ang = Math.atan2(ay - y, ax - x)
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(ax - 6 * Math.cos(ang - 0.45), ay - 6 * Math.sin(ang - 0.45))
      ctx.lineTo(ax - 6 * Math.cos(ang + 0.45), ay - 6 * Math.sin(ang + 0.45))
      ctx.closePath()
      ctx.fillStyle = ctx.strokeStyle
      ctx.fill()
      // onset ring
      if (s.frame.onset && s.frame.pL30 >= ONSET.alert) {
        const ph = (now % 1400) / 1400
        ctx.strokeStyle = `rgba(255,197,61,${0.9 * (1 - ph)})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x, y, (14 + 16 * ph) * Math.max(0.8, Math.min(1.6, view.s)), 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = 'rgba(255,197,61,0.95)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(x, y, 12 * Math.max(0.8, Math.min(1.6, view.s)), 0, Math.PI * 2)
        ctx.stroke()
      }
      // badge
      ctx.font = '600 10px "JetBrains Mono", monospace'
      const label = c.id
      const tw = ctx.measureText(label).width
      const bx = x + 8
      const by = y - 18
      ctx.fillStyle = sel ? COLORS.ai : 'rgba(12,19,32,0.92)'
      roundRect(ctx, bx, by, tw + 8, 15, 3)
      ctx.fill()
      ctx.strokeStyle = sel ? COLORS.ai : s.frame.onset ? COLORS.bolt : 'rgba(230,237,247,0.5)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = sel ? '#04121A' : COLORS.text
      ctx.textBaseline = 'middle'
      ctx.fillText(label, bx + 4, by + 8)
    }
  }

  // ---- lightning ----
  if (L.strikes && !compare) {
    const fl = run.flashes
    let lo = 0
    let hi = fl.length
    const from = t - LIGHTNING.fadeMin
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (fl[mid].t < from) lo = mid + 1
      else hi = mid
    }
    const until = st.mode === 'live' ? Math.min(t, 0) : t
    for (let i = lo; i < fl.length && fl[i].t <= until; i++) {
      const fx = fl[i]
      const age = t - fx.t
      const a = 1 - age / LIGHTNING.fadeMin
      const x = sx(fx.x)
      const y = sy(fx.y)
      if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue
      const fresh = age < 1.5 * st.speed * (st.playing ? 1 : 0.4)
      if (fx.type === 'CG') {
        if (fresh) {
          ctx.fillStyle = 'rgba(255,255,255,0.95)'
          ctx.beginPath()
          ctx.arc(x, y, 5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = `rgba(255,197,61,${0.25 + 0.75 * a})`
        ctx.beginPath()
        ctx.arc(x, y, 2.6, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillStyle = fresh ? `rgba(255,255,255,${0.7 * a})` : `rgba(255,197,61,${0.12 + 0.38 * a})`
        ctx.beginPath()
        ctx.arc(x, y, fresh ? 2.2 : 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // ---- compare divider + callout ----
  if (compare) {
    const x = st.split * W
    ctx.fillStyle = 'rgba(7,11,20,0.6)'
    ctx.fillRect(x - 1.5, 0, 3, H)
    ctx.fillStyle = COLORS.ai
    ctx.fillRect(x - 0.5, 0, 1, H)
    ctx.beginPath()
    ctx.arc(x, H / 2, 13, 0, Math.PI * 2)
    ctx.fillStyle = COLORS.panel
    ctx.fill()
    ctx.strokeStyle = COLORS.ai
    ctx.stroke()
    ctx.fillStyle = COLORS.ai
    ctx.font = '600 11px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('⟷', x, H / 2 + 1)
    ctx.textAlign = 'left'
  }
  if (callout) {
    const hero = compare ? run.cells.find((c) => c.id === st.scenario.heroNewCell) : null
    const s = hero ? lerpCell(hero, st.compareLead) : null
    if (hero && s && s.maxDbz >= 35 && sx(s.x) > st.split * W) {
      callout.style.opacity = '1'
      callout.style.transform = `translate(${Math.round(sx(s.x) + 48)}px, ${Math.round(sy(s.y) - 104)}px)`
    } else callout.style.opacity = '0'
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawGraticule(
  ctx: CanvasRenderingContext2D,
  run: RunBundle,
  view: View,
  W: number,
  H: number,
  sx: (x: number) => number,
  sy: (y: number) => number,
) {
  const c = run.manifest.grid.center
  const kx = 111.32 * Math.cos((c.lat * Math.PI) / 180)
  const lonMin = c.lon + (view.cx - W / 2 / view.s) / kx
  const lonMax = c.lon + (view.cx + W / 2 / view.s) / kx
  const latMin = c.lat + (view.cy - H / 2 / view.s) / 110.57
  const latMax = c.lat + (view.cy + H / 2 / view.s) / 110.57
  ctx.strokeStyle = '#101A2B'
  ctx.lineWidth = 1
  ctx.font = '10px "JetBrains Mono", monospace'
  ctx.fillStyle = '#44536B'
  ctx.textBaseline = 'alphabetic'
  ctx.beginPath()
  for (let lon = Math.ceil(lonMin); lon <= lonMax; lon++) {
    const x = sx((lon - c.lon) * kx)
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
  }
  for (let lat = Math.ceil(latMin); lat <= latMax; lat++) {
    const y = sy((lat - c.lat) * 110.57)
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
  }
  ctx.stroke()
  for (let lon = Math.ceil(lonMin); lon <= lonMax; lon++) ctx.fillText(`${lon}°E`, sx((lon - c.lon) * kx) + 4, H - 8)
  for (let lat = Math.ceil(latMin); lat <= latMax; lat++) ctx.fillText(`${lat}°N`, 8, sy((lat - c.lat) * 110.57) - 4)
}

function nearestCell(run: RunBundle, t: number, x: number, y: number, maxKm: number) {
  let best: CellTrack | null = null
  let bd = maxKm
  for (const c of run.cells) {
    const s = lerpCell(c, t)
    if (s.maxDbz < 35) continue
    const d = Math.hypot(s.x - x, s.y - y)
    if (d < bd) {
      bd = d
      best = c
    }
  }
  return best
}

function hitTest(st: St, p: { sx: number; sy: number; x: number; y: number }, view: View, cache: Caches | null): HoverInfo | null {
  const run = st.run!
  const base = { x: p.sx, y: p.sy }
  if (st.layers.cells) {
    const c = nearestCell(run, st.t, p.x, p.y, 12 / view.s)
    if (c) {
      const s = lerpCell(c, st.t)
      return {
        ...base,
        title: `Cell ${c.id}`,
        lines: [
          `Max ${s.maxDbz.toFixed(0)} dBZ · P(lightning 30 min) ${(s.frame.pL30 * 100).toFixed(0)}%`,
          st.t > 0 ? 'TADIT forecast' : 'Observed',
        ],
        swatch: COLORS.ai,
      }
    }
  }
  if (st.layers.rings) {
    for (const r of run.manifest.radars) {
      if (Math.hypot(r.x - p.x, r.y - p.y) * view.s < 10) {
        const off = st.outage && r.id === run.manifest.outageRadarId
        return {
          ...base,
          title: `DWR ${r.name}${off ? ' (offline)' : ''}`,
          lines: [`${r.lat.toFixed(2)}°N ${r.lon.toFixed(2)}°E`, `${RADAR_RANGE_KM} km range ring`],
        }
      }
    }
  }
  if (cache) {
    const i = Math.floor((p.x + HALF) / GRID.dxKm)
    const j = Math.floor((HALF - p.y) / GRID.dxKm)
    if (i >= 0 && j >= 0 && i < N && j < N) {
      const di = cache.districtIndex[j * N + i]
      if (di >= 0) {
        const id = run.manifest.districtIds[di]
        const dw = (st.outage && run.outage ? run.outage : run.normal).districtWarnings.find((d) => d.districtId === id)!
        const dq = DISTRICTS[id]
        return {
          ...base,
          title: `${dq.name}, ${dq.state}`,
          swatch: LEVEL_COLORS[dw.level],
          lines: [
            `${dw.level[0].toUpperCase()}${dw.level.slice(1)} · max P(lightning) ${(dw.maxPLightning * 100).toFixed(0)}%`,
            dw.etaMin === null ? 'ETA: not expected in 3 h' : `ETA: now + ${dw.etaMin} min`,
            'District footprint',
          ],
        }
      }
    }
  }
  return null
}
