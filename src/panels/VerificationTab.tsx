import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'

/**
 * scores.json schema when measured:
 * {
 *   "status": "measured",
 *   "dataset": "SEVIR test split (by date)",
 *   "leads": [10, 20, ... 180],
 *   "series": [
 *     { "metric": "CSI 45 dBZ", "model": "TADIT", "values": [ ... ] },
 *     { "metric": "CSI 45 dBZ", "model": "pySTEPS", "values": [ ... ] }, ...
 *   ]
 * }
 */
interface Scores {
  status: string
  dataset?: string
  leads?: number[]
  series?: { metric: string; model: string; values: number[] }[]
}

const PLAN = [
  ['CSI / POD / FAR', 'at 33, 45 and 54 dBZ, per lead time'],
  ['Fractions skill score', 'at 10, 20 and 40 km neighbourhoods'],
  ['Brier skill score + reliability', 'for P(thunderstorm) and P(lightning)'],
  ['Warning lead time', 'minutes of warning before the first flash'],
  ['Baselines', 'persistence and pySTEPS extrapolation'],
  ['Test split', 'by date, no event leakage between train and test'],
]

const CHARTS = ['CSI vs lead time (45 dBZ)', 'FSS vs lead time', 'Reliability diagram', 'Minutes before first flash']

export function VerificationTab() {
  const [scores, setScores] = useState<Scores | null>(null)
  useEffect(() => {
    fetch('/data/scores.json', { cache: 'no-cache' })
      .then((r) => r.json())
      .then(setScores)
      .catch(() => setScores({ status: 'pending' }))
  }, [])
  const measured = scores?.status === 'measured' && scores.leads && scores.series

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Verification</div>
        <Badge variant={measured ? 'default' : 'outline'}>{measured ? 'Measured' : 'Pending — no results yet'}</Badge>
      </div>
      <div className="rounded-lg border">
        <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Evaluation plan</div>
        {PLAN.map(([a, b]) => (
          <div key={a} className="flex gap-3 border-b border-border/50 px-3 py-2 text-xs last:border-0">
            <span className="w-[150px] shrink-0 font-medium">{a}</span>
            <span className="text-muted-foreground">{b}</span>
          </div>
        ))}
      </div>
      {measured ? (
        <MeasuredCharts scores={scores} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {CHARTS.map((c) => (
            <div key={c} className="rounded-lg border p-2.5">
              <div className="mb-2 text-[11px] font-medium text-muted-foreground">{c}</div>
              <div className="relative h-[92px] border-b border-l border-border">
                <div className="skeleton absolute bottom-2 left-2 right-2 top-3 rounded" />
              </div>
              <div className="mt-1.5 text-[10px] text-muted-foreground">Awaiting results — computed on the SEVIR test split</div>
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-muted-foreground">
        This page reads <span className="num">/data/scores.json</span>. No accuracy figure is shown until it says “measured”.
      </div>
    </div>
  )
}

const MODEL_COLORS = ['#38D0F0', '#8A9BB5', '#FFC53D', '#7C6CF2']

function MeasuredCharts({ scores }: { scores: Scores }) {
  const leads = scores.leads!
  const metrics = [...new Set(scores.series!.map((s) => s.metric))]
  const models = [...new Set(scores.series!.map((s) => s.model))]
  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">{scores.dataset}</div>
      {metrics.map((m) => {
        const ser = scores.series!.filter((s) => s.metric === m)
        const max = Math.max(0.01, ...ser.flatMap((s) => s.values))
        const W = 360
        const H = 110
        return (
          <div key={m} className="rounded-lg border p-2.5">
            <div className="mb-1 text-[11px] font-medium">{m}</div>
            <svg width={W} height={H + 16} className="overflow-visible">
              <line x1={0} y1={H} x2={W} y2={H} stroke="#1C2638" />
              {ser.map((s) => (
                <polyline
                  key={s.model}
                  fill="none"
                  strokeWidth={1.8}
                  stroke={MODEL_COLORS[models.indexOf(s.model) % MODEL_COLORS.length]}
                  points={s.values.map((v, i) => `${(i / Math.max(1, leads.length - 1)) * W},${H - (v / max) * (H - 6)}`).join(' ')}
                />
              ))}
              {leads.map((l, i) =>
                i % 3 === 0 ? (
                  <text key={l} x={(i / Math.max(1, leads.length - 1)) * W} y={H + 12} fontSize={9} fill="#8A9BB5" className="num">
                    +{l}
                  </text>
                ) : null,
              )}
            </svg>
            <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
              {models.map((md, i) => (
                <span key={md} className="flex items-center gap-1">
                  <span className="h-0.5 w-3" style={{ background: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                  {md}
                </span>
              ))}
              <span className="ml-auto">lead (min)</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
