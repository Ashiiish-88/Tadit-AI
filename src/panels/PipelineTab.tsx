import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/state/store'
import { cn } from '@/lib/utils'

interface Node {
  id: string
  label: string
  sub: string
  target: string
}

const FEEDS: Node[] = [
  { id: 'dwr', label: 'DWR mosaic', sub: 'Doppler radars', target: '≤ 2 min' },
  { id: 'sat', label: 'INSAT-3DR/3DS', sub: 'IR / WV', target: '≤ 5 min' },
  { id: 'ltg', label: 'Lightning', sub: 'flash detections', target: '≤ 1 min' },
  { id: 'nwp', label: 'NWP GFS 0.25°', sub: 'CAPE, shear', target: 'hourly' },
]
const INGEST: Node = { id: 'ingest', label: 'Ingest + multi-radar mosaic', sub: 'QC, regrid to 2 km, align', target: '≤ 30 s' }
const MODELS: Node[] = [
  { id: 'extrap', label: 'Extrapolation baseline', sub: 'optical flow', target: '≤ 10 s' },
  { id: 'unet', label: 'Multimodal U-Net', sub: 'fields to +3 h', target: '≤ 40 s' },
  { id: 'cell', label: 'Storm-cell model', sub: 'tracks, onset, SHAP', target: '≤ 15 s' },
]
const TAIL: Node[] = [
  { id: 'cal', label: 'Calibrate', sub: 'reliability-adjusted probabilities', target: '≤ 5 s' },
  { id: 'warn', label: 'Warnings + CAP', sub: 'district rules, templates', target: '≤ 5 s' },
  { id: 'fc', label: 'Forecaster approval', sub: 'edit, gust, approve', target: 'human' },
]

const ORDER = [['dwr', 'sat', 'ltg', 'nwp'], ['ingest'], ['extrap', 'unet', 'cell'], ['cal'], ['warn'], ['fc']]

export function PipelineTab() {
  const step = useApp((s) => Math.round(s.t / 10))
  const playing = useApp((s) => s.playing)
  const liveStage = useApp((s) => (s.mode === 'live' && s.live.running ? s.live.stage : null))
  const [pulseIdx, setActive] = useState(-1)
  const STAGE_IDX = { ingest: 0, mosaic: 1, models: 2, calibrate: 3, warnings: 4 } as const
  const active = liveStage ? STAGE_IDX[liveStage] : pulseIdx
  const timers = useRef<number[]>([])

  const pulse = () => {
    timers.current.forEach(clearTimeout)
    timers.current = ORDER.map((_, i) => window.setTimeout(() => setActive(i), i * 180))
    timers.current.push(window.setTimeout(() => setActive(-1), ORDER.length * 180 + 250))
  }
  useEffect(pulse, [step])
  useEffect(() => {
    if (playing) return
    const id = window.setInterval(pulse, 3500)
    return () => clearInterval(id)
  }, [playing])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const isOn = (id: string) => active >= 0 && ORDER[active].includes(id)
  const Box = ({ n, wide }: { n: Node; wide?: boolean }) => (
    <div className={cn('rounded-md border bg-background/40 px-2.5 py-2 transition-colors duration-200', isOn(n.id) && 'node-active bg-primary/10', wide && 'col-span-full')}>
      <div className="text-[12px] font-medium leading-tight">{n.label}</div>
      <div className="text-[10px] text-muted-foreground">{n.sub}</div>
      <div className="num mt-1 text-[10px] text-primary/80">target {n.target}</div>
    </div>
  )
  const Arrow = () => (
    <svg className="mx-auto my-1 block" width="12" height="18">
      <line x1="6" y1="0" x2="6" y2="13" stroke="#38D0F0" strokeOpacity="0.6" className="flow-line" />
      <path d="M2 11 L6 17 L10 11" fill="none" stroke="#38D0F0" strokeOpacity="0.8" />
    </svg>
  )

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        One cycle every 10 minutes. {liveStage ? 'The live cycle is running now — the highlighted stage is in progress.' : 'Nodes pulse on each cycle.'}
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {FEEDS.map((n) => (
          <Box key={n.id} n={n} />
        ))}
      </div>
      <Arrow />
      <Box n={INGEST} wide />
      <Arrow />
      <div className="grid grid-cols-3 gap-1.5">
        {MODELS.map((n) => (
          <Box key={n.id} n={n} />
        ))}
      </div>
      {TAIL.map((n) => (
        <div key={n.id}>
          <Arrow />
          <Box n={n} wide />
        </div>
      ))}
      <div className="rounded-md border border-dashed p-2.5 text-[11px] text-muted-foreground">
        All stage durations are <span className="text-foreground">targets</span>, not measurements. End-to-end target: under 3 minutes from data arrival to draft.
      </div>
    </div>
  )
}
