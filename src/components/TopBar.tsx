import { LayoutGrid, PanelRight, Play, Video } from 'lucide-react'
import { useApp } from '@/state/store'
import { SCENARIOS } from '@/scenarios'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { clockAdd } from '@/lib/time'
import { startPresentation } from '@/present/director'
import { cn } from '@/lib/utils'

const DOT = { ok: 'bg-imd-green', degraded: 'bg-[#FFC53D]', missing: 'bg-imd-red' } as const

/** Feed chips for the run on screen. */
export function FeedChips() {
  const run = useApp((s) => s.run)
  const outage = useApp((s) => s.outage)
  const feeds = (run?.manifest.feeds ?? []).map((f) => {
    if (f.id !== 'dwr' || !run) return f
    const active = run.manifest.radars.length - (outage && run.manifest.outageRadarId ? 1 : 0)
    return { ...f, label: `DWR mosaic (${active})`, status: active === 0 ? ('missing' as const) : outage ? ('degraded' as const) : f.status }
  })
  return (
    <div className="flex items-center gap-1.5">
      {feeds.map((f) => (
        <Tooltip key={f.id}>
          <TooltipTrigger asChild>
            <div className="flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border bg-background/40 px-2 text-[11px] text-muted-foreground">
              <span className={cn('h-1.5 w-1.5 rounded-full', DOT[f.status])} />
              {f.label}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {f.status === 'ok' ? 'Receiving' : f.status === 'degraded' ? 'Degraded — one radar offline' : 'No feed'}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

/** Toolbar of the Replay page: scenario picker, clock, gallery, presentation, recording. */
export function ReplayToolbar() {
  const scenarioId = useApp((s) => s.scenarioId)
  const scenario = useApp((s) => s.scenario)
  const t = useApp((s) => Math.round(s.t))
  const run = useApp((s) => s.run)
  const recording = useApp((s) => s.recording)
  const panelOpen = useApp((s) => s.panelOpen)
  const presenting = useApp((s) => s.presenting)

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b bg-card/60 px-3">
      <Select value={scenarioId} onValueChange={(v) => void useApp.getState().loadScenario(v)} disabled={presenting}>
        <SelectTrigger className="h-8 w-[360px] shrink-0 bg-background/40 text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[70vh]">
          <SelectGroup>
            <SelectLabel>Frequent-storm regions</SelectLabel>
            {SCENARIOS.filter((s) => s.group === 'frequent').map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="num mr-2 text-muted-foreground">{String(s.num).padStart(2, '0')}</span>
                {s.title}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Uncommon regions</SelectLabel>
            {SCENARIOS.filter((s) => s.group === 'uncommon').map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <span className="num mr-2 text-muted-foreground">{String(s.num).padStart(2, '0')}</span>
                {s.title}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="num whitespace-nowrap text-[13px]">
        <span className="text-foreground">{clockAdd(scenario.nowClock, t)} IST</span>
        <span className="text-muted-foreground"> · {t === 0 ? 'now' : `now ${t > 0 ? '+' : '−'} ${Math.abs(t)} min`}</span>
      </div>
      <div className="hidden min-[1600px]:block">
        <FeedChips />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => useApp.getState().setGalleryOpen(true)}>
              <LayoutGrid /> Scenarios
            </Button>
          </TooltipTrigger>
          <TooltipContent>Scenario gallery · G</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => startPresentation()} disabled={presenting || !run}>
              <Play /> Present
            </Button>
          </TooltipTrigger>
          <TooltipContent>Scripted ~75 s tour of this scenario · P</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent">
              <Video className={cn('h-4 w-4', recording && 'text-imd-red')} />
              Recording
              <Switch checked={recording} onCheckedChange={(v) => useApp.getState().setRecording(v)} />
            </label>
          </TooltipTrigger>
          <TooltipContent>Hides the idle cursor and stray tooltips</TooltipContent>
        </Tooltip>
        <Button variant="ghost" size="icon-sm" onClick={() => useApp.getState().setPanelOpen(!panelOpen)} aria-label="Toggle side panel">
          <PanelRight />
        </Button>
      </div>
    </div>
  )
}
