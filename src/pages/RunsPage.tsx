import { Pause, Play, RefreshCw } from 'lucide-react'
import { shortRun, useApp } from '@/state/store'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { STAGES, runNow, setPaused } from '@/live/liveEngine'
import { useTick } from '@/shell/AppShell'
import { SCENARIO_BY_ID } from '@/scenarios'
import type { RunSummary, StageId } from '@/state/types'
import { cn } from '@/lib/utils'

// one hue family for the stage bar (sequential cyan), in pipeline order
const STAGE_SHADE: Record<StageId, string> = {
  ingest: '#1F6F86',
  mosaic: '#2593AE',
  models: '#38D0F0',
  calibrate: '#7FE0F5',
  warnings: '#B8EEFA',
}

function StageBar({ r }: { r: RunSummary }) {
  const total = STAGES.reduce((a, s) => a + r.stages[s.id], 0)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-2 w-40 gap-[2px] overflow-hidden rounded-full">
          {STAGES.map((s) => (
            <div key={s.id} style={{ width: `${(r.stages[s.id] / total) * 100}%`, background: STAGE_SHADE[s.id] }} />
          ))}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5">
          {STAGES.map((s) => (
            <div key={s.id} className="flex justify-between gap-4">
              <span>{s.label}</span>
              <span className="num">{r.stages[s.id]} s</span>
            </div>
          ))}
          <div className="pt-1 text-muted-foreground">Total {total} s</div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export function RunsPage() {
  useTick(500)
  const runs = useApp((s) => s.runs)
  const live = useApp((s) => s.live)
  const idx = STAGES.findIndex((s) => s.id === live.stage)
  const secs = Math.max(0, Math.ceil((live.nextCycleAt - Date.now()) / 1000))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-4 p-5">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-semibold">Current cycle</div>
              <div className="num text-[12px] text-muted-foreground">
                #{live.cycle} · {live.running ? 'running' : live.paused ? 'paused' : `next cycle in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPaused(!live.paused)}>
                {live.paused ? <Play /> : <Pause />} {live.paused ? 'Resume' : 'Pause'}
              </Button>
              <Button size="sm" disabled={live.running} onClick={runNow}>
                <RefreshCw className={cn(live.running && 'animate-spin')} /> Run now
              </Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-3">
            {STAGES.map((st, i) => {
              const v = !live.running ? 0 : i < idx ? 1 : i === idx ? live.stageProgress : 0
              return (
                <div key={st.id} className={cn('rounded-md border p-3 transition-colors', live.running && i === idx && 'border-primary/60 bg-primary/5')}>
                  <div className="text-[12px] font-medium">{st.label}</div>
                  <Progress value={v} className="mt-2" />
                  <div className="mt-1.5 text-[10px] text-muted-foreground">{live.running ? (i < idx ? 'done' : i === idx ? 'running' : 'queued') : 'idle'}</div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <div className="grid grid-cols-[96px_84px_minmax(150px,1fr)_136px_52px_76px_52px_168px_96px] gap-3 border-b px-4 py-2.5 text-[11px] text-muted-foreground">
            <span>Run</span>
            <span>Data time</span>
            <span>Region</span>
            <span>Status</span>
            <span>Cells</span>
            <span>Max P(ltg)</span>
            <span>Drafts</span>
            <span>Stage times</span>
            <span>Compute</span>
          </div>
          {runs.length === 0 && <div className="p-6 text-center text-[13px] text-muted-foreground">No runs yet.</div>}
          {runs.map((r) => (
            <div key={r.runId + r.cycle} className="grid grid-cols-[96px_84px_minmax(150px,1fr)_136px_52px_76px_52px_168px_96px] items-center gap-3 border-b border-border/50 px-4 py-2 text-[12px] last:border-0">
              <span className="num font-medium">{shortRun(r.runId)}</span>
              <span className="num">{r.clock} IST</span>
              <span className="truncate text-muted-foreground">{SCENARIO_BY_ID[r.world]?.region}</span>
              <span>
                <Badge variant={r.status === 'published' ? 'default' : 'outline'} className="text-[10px] capitalize">
                  {r.status === 'published' ? 'Published (latest)' : r.status}
                </Badge>
              </span>
              <span className="num">{r.cells}</span>
              <span className="num">
                {Math.round(r.maxPLightning * 100)}%
              </span>
              <span className="num">{r.drafts}</span>
              <StageBar r={r} />
              <span className="num text-muted-foreground" title="Compute time">
                {r.engineMs} ms
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
