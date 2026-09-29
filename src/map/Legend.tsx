import { useApp } from '@/state/store'
import { CAPE_STOPS, DBZ_STOPS, IR_STOPS, PROB_STOPS, lutGradient } from '@/lib/colormaps'
import { LEVEL_COLORS } from '@/config'

function Ramp({ title, unit, stops, ticks }: { title: string; unit: string; stops: typeof DBZ_STOPS; ticks: string[] }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-medium text-foreground">{title}</span>
        <span className="text-muted-foreground">{unit}</span>
      </div>
      <div className="h-1.5 w-[176px] rounded-sm" style={{ background: lutGradient(stops) }} />
      <div className="num flex justify-between text-[10px] text-muted-foreground">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  )
}

export function Legend() {
  const L = useApp((s) => s.layers)
  const compare = useApp((s) => s.tab === 'compare')
  const tNeg = useApp((s) => s.t < 0)
  const tPos = useApp((s) => s.t > 0)
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-h-[70%] w-[202px] space-y-2.5 overflow-hidden rounded-[10px] border bg-card/80 px-3 py-2.5 backdrop-blur-md">
      {(L.radar || compare) && (
        <Ramp title={compare ? 'Radar reflectivity' : tPos ? 'Reflectivity · TADIT forecast' : 'Reflectivity · observed'} unit="dBZ" stops={DBZ_STOPS} ticks={['15', '35', '55', '75']} />
      )}
      {!compare && (L.pThunder || L.pLightning) && (
        <div className="space-y-1">
          <Ramp
            title={L.pThunder && L.pLightning ? 'P(storm) · P(lightning)' : L.pThunder ? 'P(≥45 dBZ)' : 'P(lightning ≤10 km)'}
            unit="%"
            stops={PROB_STOPS}
            ticks={['10', '50', '95']}
          />
          <div className="text-[10px] text-muted-foreground">
            {tNeg ? 'Forecast layers start at now' : 'Contours 30 / 50 / 70 %'}
          </div>
        </div>
      )}
      {!compare && L.sat && (
        <Ramp title={tPos ? 'Satellite IR · latest obs' : 'Satellite IR cloud top'} unit="K" stops={IR_STOPS} ticks={['190', '220', '250', '288']} />
      )}
      {!compare && L.cape && <Ramp title="NWP CAPE" unit="J/kg" stops={CAPE_STOPS} ticks={['500', '2,000', '4,000']} />}
      {!compare && L.strikes && (
        <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#FFC53D]" /> CG
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FFC53D]/50" /> IC flash
          </span>
          <span className="num ml-auto">fades 10 min</span>
        </div>
      )}
      {L.warnings && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          {(['green', 'yellow', 'orange', 'red'] as const).map((l) => (
            <span key={l} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEVEL_COLORS[l], opacity: l === 'green' ? 0.6 : 0.9 }} />
              {l[0].toUpperCase() + l.slice(1)}
            </span>
          ))}
        </div>
      )}
      {L.cells && (
        <div className="text-[10px] leading-snug text-muted-foreground">
          <span className="text-foreground">White line</span> 45 dBZ · arrow 30 min ·{' '}
          <span className="text-bolt">amber ring</span> onset alert
        </div>
      )}
    </div>
  )
}
