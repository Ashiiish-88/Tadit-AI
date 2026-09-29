// Scripted, auto-playing tour of the current scenario (~75 s) for recording the demo video.

import { toast } from 'sonner'
import { useApp } from '@/state/store'
import { TIME } from '@/config'
import { RADARS } from '@/data/radars'

interface Step {
  dur: number // seconds
  caption: string | null
  start?: () => void
  tick?: (p: number, sec: number) => void
  at?: [number, () => void][] // one-shot actions at second offsets
}

let stopFn: (() => void) | null = null
const S = () => useApp.getState()
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)

export function stopPresentation() {
  stopFn?.()
}

export function animateSwipe(ms: number) {
  const t0 = performance.now()
  const frame = (now: number) => {
    const p = Math.min(1, (now - t0) / ms)
    S().setSplit(swipeAt(p))
    if (p < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

function swipeAt(p: number) {
  if (p < 0.45) return 0.08 + 0.84 * ease(p / 0.45)
  if (p < 0.62) return 0.92
  return 0.92 - 0.42 * ease((p - 0.62) / 0.38)
}

function typeInto(id: string, text: string, charMs: number) {
  let i = 0
  const tick = () => {
    if (!S().presenting) return
    i++
    S().updateWarning(id, { gust: text.slice(0, i) })
    if (i < text.length) window.setTimeout(tick, charMs)
  }
  tick()
}

export function startPresentation() {
  const st = S()
  const run = st.run
  if (!run || st.presenting) return
  const cfg = st.scenario
  const cap = cfg.captions ?? {}
  const onset = run.cells.find((c) => c.id === cfg.heroOnsetCell) ?? run.cells[0]
  const onsetF = onset?.frames[TIME.nowIndex]
  const warn = run.warnings[0]
  const hasOutage = !!run.outage
  const outageName = run.manifest.outageRadarId ? RADARS[run.manifest.outageRadarId].name : ''

  st.reset()
  useApp.setState({ presenting: true, endCard: false, caption: null, playing: false, galleryOpen: false })

  const steps: Step[] = [
    {
      dur: 8,
      caption: cap[1] ?? `${cfg.region}: the last hour of radar, satellite and lightning observations.`,
      start: () => {
        S().setT(TIME.startMin)
        const home = { x: 0, y: 0 }
        S().fly(home.x, home.y, 1150, 0)
        window.setTimeout(() => S().flyHome(2200), 50)
      },
      tick: (p) => S().setT(TIME.startMin + -TIME.startMin * p),
    },
    {
      dur: 6,
      caption:
        cap[2] ??
        `Onset alert on ${onset.id}: no lightning yet, but P(first flash within 30 min) is ${Math.round((onsetF?.pL30 ?? 0) * 100)}%.`,
      start: () => {
        S().setT(0)
        S().setTab('cells')
        S().selectCell(onset.id)
      },
    },
    {
      dur: 12,
      caption: cap[3] ?? 'TADIT forecast: every 10 minutes, out to 3 hours, with probability contours at 30 / 50 / 70 %.',
      start: () => {
        S().selectCell(null, false)
        S().flyHome(1200)
      },
      at: [[0.4, () => S().flyHome(900)]],
      tick: (p) => S().setT(TIME.endMin * p),
    },
    {
      dur: 10,
      caption: cap[4] ?? 'At +60 min, extrapolation only moves today’s echoes. TADIT also shows the storm that has not formed yet.',
      start: () => {
        S().setCompareLead(60)
        S().setTab('compare')
        S().setSplit(0.08)
      },
      tick: (p) => S().setSplit(swipeAt(p)),
    },
    {
      dur: 8,
      caption: cap[5] ?? `Why TADIT flags ${onset.id}: satellite cooling, a deepening echo and unstable air — shown as SHAP attribution bars.`,
      start: () => {
        S().setTab('cells')
        S().setT(0)
        S().selectCell(onset.id)
      },
    },
    {
      dur: 15,
      caption:
        cap[6] ??
        'A district nowcast is drafted in IMD style. The forecaster types the gust speed — the model never does — and approves.',
      start: () => {
        S().selectCell(null, false)
        S().flyHome(1000)
        S().setTab('warnings')
      },
      at: warn
        ? [
            [0.6, () => document.getElementById(`warn-${warn.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })],
            [1.5, () => typeInto(warn.id, cfg.presentGust, 140)],
            [4.4, () => cfg.presentHailNote && S().updateWarning(warn.id, { hailNote: cfg.presentHailNote })],
            [6.2, () => S().approveWarning(warn.id, { scripted: true })],
            [6.8, () => document.getElementById(`warn-${warn.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })],
            [8.2, () => S().setCapOpen(warn.id)],
            [11.4, () => S().setCapOpen(null)],
            [11.8, () => {
              S().updateWarning(warn.id, { lang: 'hi' })
              S().setPhoneFor(warn.id)
            }],
          ]
        : [],
    },
    {
      dur: 10,
      caption:
        cap[7] ??
        (hasOutage
          ? `${outageName} radar goes offline. TADIT keeps forecasting from satellite + lightning — the contours widen to show it.`
          : 'No radar reaches this area. TADIT runs on satellite + lightning + NWP, with honestly wider contours.'),
      start: () => {
        S().setPhoneFor(null)
        S().setTab('cells')
        S().setT(60)
        if (hasOutage) S().setOutage(false)
        else useApp.setState((s) => ({ layers: { ...s.layers, sat: true } }))
      },
      at: hasOutage ? [[2.5, () => S().setOutage(true)]] : [],
    },
    {
      dur: 6,
      caption: null,
      start: () => {
        toast.dismiss()
        useApp.setState({ endCard: true, capOpenFor: null, phoneFor: null })
      },
    },
  ]

  let idx = -1
  let stepStart = 0
  let fired = new Set<number>()
  let raf = 0
  const t0 = performance.now()
  let acc = 0

  const loop = (now: number) => {
    const elapsed = (now - t0) / 1000
    while (idx < steps.length && (idx < 0 || elapsed - stepStart >= steps[idx].dur)) {
      if (idx >= 0) acc += steps[idx].dur
      idx++
      stepStart = acc
      fired = new Set()
      if (idx >= steps.length) break
      useApp.setState({ caption: steps[idx].caption, captionStep: idx + 1 })
      steps[idx].start?.()
    }
    if (idx >= steps.length) {
      finish()
      return
    }
    const s = steps[idx]
    const sec = elapsed - stepStart
    s.tick?.(Math.min(1, sec / s.dur), sec)
    s.at?.forEach(([when, fn], i) => {
      if (sec >= when && !fired.has(i)) {
        fired.add(i)
        fn()
      }
    })
    raf = requestAnimationFrame(loop)
  }

  const finish = () => {
    cancelAnimationFrame(raf)
    useApp.setState({ presenting: false, caption: null, playing: false })
    stopFn = null
  }
  stopFn = () => {
    finish()
    useApp.setState({ endCard: false, capOpenFor: null, phoneFor: null })
  }
  raf = requestAnimationFrame(loop)
}

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__present = startPresentation
