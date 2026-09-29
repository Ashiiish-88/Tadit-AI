import { MoveHorizontal } from 'lucide-react'
import { useApp } from '@/state/store'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { bearing, compass } from '@/lib/geo'
import { TIME } from '@/config'
import { animateSwipe } from '@/present/director'

export function CompareTab() {
  const lead = useApp((s) => s.compareLead)
  const run = useApp((s) => s.run)
  if (!run) return null
  const mm = run.manifest.meanMotion
  const speed = Math.hypot(mm.u, mm.v) * 60
  const k = TIME.nowIndex + lead / TIME.stepMin
  const newCells = run.cells.filter((c) => c.isNew && c.frames[k].maxDbz >= 35)

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Swipe the divider on the map. Both sides start from the same radar picture at now; they differ in what happens next.
      </p>
      <div className="flex items-center justify-between">
        <ToggleGroup type="single" value={String(lead)} onValueChange={(v) => v && useApp.getState().setCompareLead(Number(v) as 30 | 60 | 90)}>
          {[30, 60, 90].map((l) => (
            <ToggleGroupItem key={l} value={String(l)} className="num px-3">
              +{l} min
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button size="sm" variant="outline" onClick={() => animateSwipe(2600)}>
          <MoveHorizontal /> Auto-swipe
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <div className="text-sm font-medium">Left · Extrapolation</div>
        <div className="text-xs text-muted-foreground">How radar nowcasting works today.</div>
        <p className="text-[13px] leading-relaxed">
          Moves the now radar field at the domain-mean motion,{' '}
          <span className="num">
            {speed.toFixed(0)} km/h toward {compass(bearing(mm.u, mm.v))}
          </span>
          . No growth, no decay and no new cells.
        </p>
      </div>
      <div className="space-y-2 rounded-lg border border-primary/40 p-3">
        <div className="text-sm font-medium text-primary">Right · TADIT (AI fusion)</div>
        <div className="text-xs text-muted-foreground">Radar + INSAT-3DS + lightning + NWP.</div>
        <p className="text-[13px] leading-relaxed">
          Grows, decays and initiates cells. Position error and blur grow with lead time — about{' '}
          <span className="num">{(1 + 0.08 * lead).toFixed(1)} km</span> at +{lead} min.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">New cells at +{lead} min — missing on the left</div>
        {newCells.length === 0 ? (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">No new cells at this lead. Try +60 or +90 min.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {newCells.map((c) => (
              <Badge key={c.id} variant="default" className="num cursor-pointer" onClick={() => useApp.getState().selectCell(c.id)}>
                {c.id} · {c.frames[k].maxDbz.toFixed(0)} dBZ
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">Skill scores: see Verification.</div>
    </div>
  )
}
