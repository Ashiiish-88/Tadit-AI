import { CloudLightning, Globe2, Radar, Satellite } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useApp } from '@/state/store'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RADAR_RANGE_KM } from '@/config'
import type { FeedSample } from '@/state/types'
import { cn } from '@/lib/utils'

type FeedId = keyof FeedSample['latency']

const FEEDS: { id: FeedId; name: string; icon: LucideIcon; unit: string; cadence: string; filesLabel: string }[] = [
  { id: 'dwr', name: 'DWR mosaic', icon: Radar, unit: 's', cadence: 'volume scan every 10 min', filesLabel: 'volumes this cycle' },
  { id: 'sat', name: 'INSAT-3DS IR/WV', icon: Satellite, unit: 's', cadence: 'image every 15 min (rapid scan)', filesLabel: 'images this cycle' },
  { id: 'lightning', name: 'Lightning network', icon: CloudLightning, unit: 's', cadence: 'continuous stream', filesLabel: 'strokes this cycle' },
  { id: 'nwp', name: 'NWP GFS 0.25°', icon: Globe2, unit: 's', cadence: 'hourly fields', filesLabel: 'field sets this cycle' },
]

function Spark({ values }: { values: number[] }) {
  const W = 180
  const H = 36
  if (values.length < 2) return <div className="h-9 text-[11px] text-muted-foreground">Collecting…</div>
  const max = Math.max(...values)
  const min = Math.min(...values)
  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => H - 3 - ((v - min) / Math.max(1, max - min)) * (H - 6)
  return (
    <svg width={W} height={H} className="overflow-visible">
      <path d={values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')} fill="none" stroke="#38D0F0" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill="#38D0F0" stroke="#0C1320" strokeWidth={2} />
    </svg>
  )
}

const fmtLatency = (s: number) => (s >= 120 ? `${Math.round(s / 60)} min` : `${s} s`)

export function FeedsPage() {
  const history = useApp((s) => s.feedHistory)
  const run = useApp((s) => s.run)
  const outage = useApp((s) => s.outage)
  const last = history[history.length - 1]
  const radars = run?.manifest.radars ?? []
  const outageId = run?.manifest.outageRadarId

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FEEDS.map((f) => {
            const degraded = f.id === 'dwr' && (outage || radars.length === 0)
            const missing = f.id === 'dwr' && radars.length === 0
            return (
              <Card key={f.id} className="p-4">
                <div className="flex items-center gap-2">
                  <f.icon className="h-4 w-4 text-primary" />
                  <div className="text-sm font-semibold">{f.name}</div>
                  <Badge variant={missing ? 'destructive' : degraded ? 'amber' : 'secondary'} className="ml-auto text-[10px]">
                    <span className={cn('h-1.5 w-1.5 rounded-full', missing ? 'bg-imd-red' : degraded ? 'bg-[#FFC53D]' : 'bg-imd-green')} />
                    {missing ? 'No coverage' : degraded ? 'Degraded' : 'Receiving'}
                  </Badge>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{f.cadence}</div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-muted-foreground">Latency</div>
                    <div className="num text-xl font-semibold">{last ? fmtLatency(last.latency[f.id]) : '—'}</div>
                  </div>
                  <Spark values={history.map((h) => h.latency[f.id])} />
                </div>
                <div className="num mt-3 text-[11px] text-muted-foreground">
                  {last ? last.files[f.id] : 0} {f.filesLabel}
                </div>
              </Card>
            )
          })}
        </div>

        <Card>
          <div className="flex items-center border-b px-4 py-3">
            <div className="text-sm font-semibold">Doppler weather radars in this region</div>
          </div>
          <div className="grid grid-cols-[1fr_160px_110px_130px_190px] gap-3 border-b px-4 py-2 text-[11px] text-muted-foreground">
            <span>Site</span>
            <span>Location (approx.)</span>
            <span>Range</span>
            <span>Status</span>
            <span>Failover test</span>
          </div>
          {radars.length === 0 && (
            <div className="p-5 text-[13px] text-muted-foreground">No DWR covers this region. TADIT runs on satellite + lightning + NWP here.</div>
          )}
          {radars.map((r) => {
            const off = outage && r.id === outageId
            const can = r.id === outageId
            return (
              <div key={r.id} className="grid grid-cols-[1fr_160px_110px_130px_190px] items-center gap-3 border-b border-border/50 px-4 py-2.5 text-[13px] last:border-0">
                <span className="font-medium">DWR {r.name}</span>
                <span className="num text-[12px] text-muted-foreground">
                  {r.lat.toFixed(2)}°N {r.lon.toFixed(2)}°E
                </span>
                <span className="num text-[12px]">{RADAR_RANGE_KM} km</span>
                <span>
                  <Badge variant={off ? 'amber' : 'secondary'} className="text-[10px]">
                    <span className={cn('h-1.5 w-1.5 rounded-full', off ? 'bg-[#FFC53D]' : 'bg-imd-green')} />
                    {off ? 'Offline' : 'Receiving'}
                  </Badge>
                </span>
                <span>
                  {can ? (
                    <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <Switch checked={off} onCheckedChange={(v) => useApp.getState().setOutage(v)} /> {off ? 'Outage on' : 'Off'}
                    </label>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[12px] text-muted-foreground">Not available</span>
                      </TooltipTrigger>
                      <TooltipContent>Failover test is configured for DWR {radars.find((x) => x.id === outageId)?.name ?? '—'}</TooltipContent>
                    </Tooltip>
                  )}
                </span>
              </div>
            )
          })}
        </Card>
        <div className="text-[11px] text-muted-foreground">
          When a radar goes offline, TADIT keeps forecasting there from satellite cooling and lightning; the probability contours widen to show the extra uncertainty.
        </div>
      </div>
    </div>
  )
}
