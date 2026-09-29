import { useRef } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useApp } from '@/state/store'
import { TIME } from '@/config'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { leadLabel } from '@/lib/time'

const SPAN = TIME.endMin - TIME.startMin
const pct = (t: number) => ((t - TIME.startMin) / SPAN) * 100

export function Timeline() {
  const t = useApp((s) => s.t)
  const playing = useApp((s) => s.playing)
  const speed = useApp((s) => s.speed)
  const compare = useApp((s) => s.tab === 'compare')
  const trackRef = useRef<HTMLDivElement>(null)

  const setFromEvent = (clientX: number, snap: boolean) => {
    const r = trackRef.current!.getBoundingClientRect()
    let v = TIME.startMin + ((clientX - r.left) / r.width) * SPAN
    if (snap) v = Math.round(v / TIME.stepMin) * TIME.stepMin
    useApp.getState().setT(v)
  }

  const ticks = Array.from({ length: TIME.frameCount }, (_, i) => TIME.startMin + i * TIME.stepMin)

  return (
    <div className="flex h-[72px] shrink-0 items-center gap-4 border-t bg-card px-4">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => useApp.getState().stepT(-1)} aria-label="Step back 10 min">
          <SkipBack />
        </Button>
        <Button size="icon" onClick={() => useApp.getState().togglePlay()} aria-label={playing ? 'Pause' : 'Play'} disabled={compare}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => useApp.getState().stepT(1)} aria-label="Step forward 10 min">
          <SkipForward />
        </Button>
      </div>
      <ToggleGroup type="single" value={String(speed)} onValueChange={(v) => v && useApp.getState().setSpeed(Number(v) as 1 | 2 | 4)}>
        {[1, 2, 4].map((s) => (
          <ToggleGroupItem key={s} value={String(s)} className="num">
            {s}×
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="relative flex-1 select-none px-2">
        <div
          ref={trackRef}
          className="relative h-10 cursor-pointer"
          onPointerDown={(e) => {
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            useApp.getState().setPlaying(false)
            setFromEvent(e.clientX, false)
          }}
          onPointerMove={(e) => e.buttons === 1 && setFromEvent(e.clientX, false)}
          onPointerUp={(e) => setFromEvent(e.clientX, true)}
        >
          {/* track */}
          <div className="absolute inset-x-0 top-[14px] h-[3px] rounded-full bg-border" />
          <div className="absolute top-[14px] h-[3px] rounded-l-full bg-foreground/80" style={{ left: 0, width: `${pct(0)}%` }} />
          <div className="absolute top-[14px] h-[3px] rounded-r-full bg-primary/80" style={{ left: `${pct(0)}%`, right: 0 }} />
          {/* ticks */}
          {ticks.map((tk) => (
            <div key={tk} className="absolute top-[20px] -translate-x-1/2" style={{ left: `${pct(tk)}%` }}>
              <div className={tk % 30 === 0 ? 'mx-auto h-2 w-px bg-muted-foreground/70' : 'mx-auto h-1 w-px bg-muted-foreground/40'} />
              {tk % 30 === 0 && (
                <div className={`num mt-0.5 text-[10px] ${tk === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {tk === 0 ? 'Now' : tk > 0 ? `+${tk}` : `−${-tk}`}
                </div>
              )}
            </div>
          ))}
          {/* now marker */}
          <div className="absolute top-[4px] h-[24px] w-px -translate-x-1/2 bg-foreground" style={{ left: `${pct(0)}%` }} />
          <div className="absolute -top-1 -translate-x-1/2 text-[9px] font-medium uppercase tracking-wider text-muted-foreground" style={{ left: `${pct(-30)}%` }}>
            Observed
          </div>
          <div className="absolute -top-1 -translate-x-1/2 text-[9px] font-medium uppercase tracking-wider text-primary/80" style={{ left: `${pct(90)}%` }}>
            Forecast
          </div>
          {/* handle */}
          <div
            className="absolute top-[8px] h-[15px] w-[15px] -translate-x-1/2 rounded-full border-2 border-background shadow"
            style={{ left: `${pct(t)}%`, background: t > 0 ? '#38D0F0' : '#E6EDF7' }}
          />
        </div>
      </div>

      <div className="num w-[92px] text-right text-lg font-medium tabular-nums">
        <span className={t > 0 ? 'text-primary' : 'text-foreground'}>{leadLabel(t)}</span>
      </div>
    </div>
  )
}
