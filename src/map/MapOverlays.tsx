import type { RefObject } from 'react'
import { Satellite, Radio, Zap } from 'lucide-react'
import { useApp } from '@/state/store'
import { Badge } from '@/components/ui/badge'
import { Legend } from './Legend'
import { leadLabel } from '@/lib/time'
import { RADARS } from '@/data/radars'

export function MapOverlays({ calloutRef, compact }: { calloutRef: RefObject<HTMLDivElement>; compact?: boolean }) {
  const t = useApp((s) => Math.round(s.t))
  const tab = useApp((s) => s.tab)
  const lead = useApp((s) => s.compareLead)
  const outage = useApp((s) => s.outage)
  const run = useApp((s) => s.run)
  const scenario = useApp((s) => s.scenario)
  const strikes = useApp((s) => s.layers.strikes)
  const loading = useApp((s) => s.loading)
  const mode = useApp((s) => s.mode)
  const nowClock = useApp((s) => s.run?.manifest.nowClock)
  const compare = tab === 'compare'
  const outageName = run?.manifest.outageRadarId ? RADARS[run.manifest.outageRadarId].name : null

  return (
    <>
      {/* status chips */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[70%] flex-wrap items-center gap-2">
        {mode === 'live' && nowClock && (
          <Badge variant="outline" className="h-7 border-imd-green/40 bg-card/90 px-2.5 text-[12px] text-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-imd-green" /> Live run · <span className="num">{nowClock} IST</span>
          </Badge>
        )}
        {!compare && (
          <Badge
            variant={t > 0 ? 'default' : 'secondary'}
            className="h-7 border border-border/60 bg-card/90 px-2.5 text-[12px] backdrop-blur"
          >
            {t > 0 ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Forecast · TADIT · <span className="num">{leadLabel(t)}</span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-foreground" /> Observed · <span className="num">{leadLabel(t)}</span>
              </>
            )}
          </Badge>
        )}
        {outage && outageName && (
          <Badge variant="amber" className="h-7 border border-[#FFC53D]/30 bg-card/90 px-2.5 text-[12px] backdrop-blur">
            <Radio className="h-3.5 w-3.5" /> {outageName} radar feed missing — running on satellite + lightning
          </Badge>
        )}
        {scenario.note && !compare && !compact && (
          <Badge variant="outline" className="h-7 bg-card/90 px-2.5 text-[12px] text-muted-foreground backdrop-blur">
            <Satellite className="h-3.5 w-3.5" /> {scenario.note}
          </Badge>
        )}
        {strikes && t > 0 && !compare && !compact && mode === 'replay' && (
          <Badge variant="outline" className="h-7 bg-card/90 px-2.5 text-[12px] text-muted-foreground backdrop-blur">
            <Zap className="h-3.5 w-3.5 text-bolt" /> Outcome overlay: strikes after forecast time
          </Badge>
        )}
      </div>

      {/* compare labels */}
      {compare && (
        <CompareLabels lead={lead} />
      )}
      <div
        ref={calloutRef}
        className="pointer-events-none absolute left-0 top-0 z-10 w-[230px] rounded-md border border-primary/60 bg-card/95 px-3 py-2 text-xs leading-snug text-foreground opacity-0 shadow-lg transition-opacity duration-300"
      >
        <div className="mb-0.5 font-semibold text-primary">New cell</div>
        Satellite cooling seen 25 min before the radar echo
      </div>

      {!compact && <Legend />}

      {loading && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-background/70">
          <div className="w-[320px] space-y-3 rounded-lg border bg-card p-4">
            <div className="text-sm font-medium">Building scenario</div>
            <div className="text-xs text-muted-foreground">Generating radar, satellite, lightning and probability fields in a worker…</div>
            <div className="skeleton h-2 w-full rounded" />
            <div className="skeleton h-2 w-2/3 rounded" />
          </div>
        </div>
      )}
    </>
  )
}

function CompareLabels({ lead }: { lead: number }) {
  // keep both labels readable while the divider sweeps to the edges
  const split = useApp((s) => Math.max(0.3, Math.min(0.7, s.split)))
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10">
      <div
        className="absolute whitespace-nowrap rounded-md border bg-card/90 px-3 py-1.5 text-xs backdrop-blur"
        style={{ right: `calc(${(1 - split) * 100}% + 16px)` }}
      >
        <div className="font-semibold">Extrapolation</div>
        <div className="text-muted-foreground">How radar nowcasting works today · <span className="num">+{lead} min</span></div>
      </div>
      <div
        className="absolute whitespace-nowrap rounded-md border border-primary/50 bg-card/90 px-3 py-1.5 text-xs backdrop-blur"
        style={{ left: `calc(${split * 100}% + 16px)` }}
      >
        <div className="font-semibold text-primary">TADIT (AI fusion)</div>
        <div className="text-muted-foreground">Radar + satellite + lightning + NWP · <span className="num">+{lead} min</span></div>
      </div>
    </div>
  )
}
