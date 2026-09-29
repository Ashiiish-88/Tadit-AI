import { useEffect, useState } from 'react'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Bot,
  CloudLightning,
  Cpu,
  Minus,
  Radio,
  Sparkles,
  Target,
  UserRound,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useApp } from '@/state/store'
import { runCache } from '@/state/runCache'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { MapView } from '@/map/MapView'
import { Md } from '@/ai/Md'
import { ask } from '@/ai/AssistantPanel'
import { STAGES } from '@/live/liveEngine'
import { useTick } from '@/shell/AppShell'
import { DISTRICTS } from '@/data/districtHQ'
import { LEVEL_COLORS, TIME } from '@/config'
import { FlashBars, LightningAreaLine } from './charts'
import { LEVEL_LABEL } from '@/components/WarningCard'
import type { ActivityEntry } from '@/state/types'
import { cn } from '@/lib/utils'

function Stat({ icon: Icon, label, value, sub, accent }: { icon: LucideIcon; label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Icon className="h-4 w-4" style={{ color: accent }} />
        {label}
      </div>
      <div className="num mt-2 text-[28px] font-semibold leading-none">{value}</div>
      {sub && <div className="mt-2 text-[12px] text-muted-foreground">{sub}</div>}
    </Card>
  )
}

function Trend({ d }: { d: number }) {
  if (d === 0) return <Minus className="inline h-3.5 w-3.5" />
  return d > 0 ? <ArrowUpRight className="inline h-3.5 w-3.5 text-[#FFC53D]" /> : <ArrowDownRight className="inline h-3.5 w-3.5 text-imd-green" />
}

function useTypewriter(text: string, key: string) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    let c = 0
    const id = window.setInterval(() => {
      c += 5
      setN(c)
      if (c >= text.length) clearInterval(id)
    }, 16)
    return () => clearInterval(id)
  }, [key, text])
  return text.slice(0, n)
}

function AiSummary() {
  const summary = useApp((s) => s.aiSummary)
  const shown = useTypewriter(summary?.text ?? '', summary?.runId ?? '')
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-semibold">AI situation summary</div>
          <div className="text-[11px] text-muted-foreground">Rewritten after every nowcast cycle</div>
        </div>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {summary ? (
          <Md text={shown} className="text-[13.5px] leading-relaxed text-muted-foreground" />
        ) : (
          <div className="space-y-2">
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-5/6 rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
        {['Which districts get lightning in the next hour?', 'Why is the top cell flagged?', 'Draft a bulletin in Hindi'].map((q) => (
          <button key={q} onClick={() => ask(q)} className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
            {q}
          </button>
        ))}
      </div>
    </Card>
  )
}

function PipelineCard() {
  useTick(500)
  const live = useApp((s) => s.live)
  const last = useApp((s) => s.runs[0])
  const secs = Math.max(0, Math.ceil((live.nextCycleAt - Date.now()) / 1000))
  const idx = STAGES.findIndex((s) => s.id === live.stage)
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Cpu className="h-4 w-4 text-primary" /> Nowcast pipeline
        </div>
        <span className="num text-[11px] text-muted-foreground">
          {live.running ? 'running' : live.paused ? 'paused' : `next in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
        </span>
      </div>
      <div className="space-y-2">
        {STAGES.map((st, i) => {
          const v = !live.running ? 1 : i < idx ? 1 : i === idx ? live.stageProgress : 0
          return (
            <div key={st.id} className="grid grid-cols-[150px_1fr_52px] items-center gap-3 text-[12px]">
              <span className={cn(live.running && i === idx ? 'text-primary' : 'text-muted-foreground')}>{st.label}</span>
              <Progress value={v} barClassName={!live.running ? 'bg-primary/40' : undefined} />
              <span className="num text-right text-muted-foreground">{last && !live.running ? `${last.stages[st.id]} s` : ''}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 text-[10px] text-muted-foreground">Targets are listed in Operations → Pipeline.</div>
    </Card>
  )
}

const KIND_ICON: Record<ActivityEntry['kind'], LucideIcon> = {
  cycle: CloudLightning,
  warning: BellRing,
  feed: Radio,
  user: UserRound,
  ai: Bot,
  system: Cpu,
}

function ActivityFeed() {
  const activity = useApp((s) => s.activity)
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="mb-2 text-sm font-semibold">Activity</div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {activity.length === 0 && <div className="text-xs text-muted-foreground">Nothing yet.</div>}
        {activity.slice(0, 30).map((a) => {
          const I = KIND_ICON[a.kind]
          return (
            <div key={a.id} className="flex gap-3 rounded-md px-1 py-1.5 text-[12px]">
              <span className="num w-10 shrink-0 text-muted-foreground">{a.at}</span>
              <I className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', a.kind === 'ai' ? 'text-primary' : a.kind === 'feed' ? 'text-[#FFC53D]' : 'text-muted-foreground')} />
              <span className="text-muted-foreground">{a.text}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export function DashboardPage() {
  const run = useApp((s) => s.run)
  const prevId = useApp((s) => s.prevRunId)
  const warnings = useApp((s) => s.warnings)
  const outage = useApp((s) => s.outage)
  const cfg = useApp((s) => s.scenario)

  if (!run) {
    return (
      <div className="grid h-full place-items-center">
        <div className="w-[340px] space-y-3 rounded-lg border bg-card p-5">
          <div className="text-sm font-medium">Starting the first nowcast cycle…</div>
          <div className="text-xs text-muted-foreground">Connecting data feeds and running the models.</div>
          <div className="skeleton h-2 w-full rounded" />
          <div className="skeleton h-2 w-2/3 rounded" />
        </div>
      </div>
    )
  }
  const prev = runCache.get(prevId)
  const k = TIME.nowIndex
  const cells = run.cells.filter((c) => c.frames[k].maxDbz >= 35).length
  const prevCells = prev ? prev.cells.filter((c) => c.frames[k].maxDbz >= 35).length : cells
  const dw = (outage && run.outage ? run.outage : run.normal).districtWarnings
  const prevDw = prev?.normal.districtWarnings ?? []
  const levels = (['red', 'orange', 'yellow'] as const).map((l) => ({ l, n: dw.filter((d) => d.level === l).length }))
  const flashes = run.flashes.filter((f) => f.t > -10 && f.t <= 0).length
  const flashesBefore = run.flashes.filter((f) => f.t > -20 && f.t <= -10).length
  const drafts = Object.values(warnings).filter((w) => w.status === 'draft' && w.world === cfg.id)
  const onset = run.cells.filter((c) => c.frames[k].onset).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1680px] space-y-4 p-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-lg font-semibold">{cfg.region}</div>
            <div className="text-[13px] text-muted-foreground">
              {cfg.title} · latest run <span className="num">{run.manifest.nowClock} IST</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => useApp.getState().setPage('ops')}>
            Open operations map <ArrowRight />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat
            icon={Target}
            label="Active storm cells"
            value={cells}
            accent="#38D0F0"
            sub={
              <>
                <Trend d={cells - prevCells} /> {cells - prevCells >= 0 ? '+' : ''}
                {cells - prevCells} vs previous run · {onset} onset alert{onset === 1 ? '' : 's'}
              </>
            }
          />
          <Stat
            icon={BellRing}
            label="Districts under warning"
            value={levels.reduce((a, b) => a + b.n, 0)}
            accent="#FF8A1F"
            sub={
              <span className="flex gap-2">
                {levels.map(({ l, n }) => (
                  <span key={l} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm" style={{ background: LEVEL_COLORS[l] }} />
                    {n} {LEVEL_LABEL[l].toLowerCase()}
                  </span>
                ))}
              </span>
            }
          />
          <Stat
            icon={Zap}
            label="Flashes, last 10 min"
            value={flashes}
            accent="#FFC53D"
            sub={
              <>
                <Trend d={flashes - flashesBefore} /> {flashesBefore} in the 10 min before
              </>
            }
          />
          <Stat
            icon={Sparkles}
            label="AI drafts awaiting approval"
            value={drafts.length}
            accent="#38D0F0"
            sub={
              <button className="text-primary hover:underline" onClick={() => useApp.getState().setPage('warnings')}>
                Review in the inbox →
              </button>
            }
          />
          <Stat
            icon={Radio}
            label="Radar feeds"
            value={`${run.manifest.radars.length - (outage && run.manifest.outageRadarId ? 1 : 0)}/${run.manifest.radars.length}`}
            accent={outage ? '#FFC53D' : '#32C27A'}
            sub={outage ? 'One radar offline — satellite + lightning fill the gap' : run.manifest.radars.length ? 'All receiving' : 'No radar covers this area'}
          />
        </div>

        <div className="grid grid-cols-12 gap-4">
          <Card className="relative col-span-12 h-[440px] overflow-hidden xl:col-span-7">
            <MapView compact />
            <Button size="sm" variant="secondary" className="absolute bottom-3 right-3 z-10" onClick={() => useApp.getState().setPage('ops')}>
              Full map <ArrowRight />
            </Button>
          </Card>
          <div className="col-span-12 h-[440px] xl:col-span-5">
            <AiSummary />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 p-4 xl:col-span-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Needs action</div>
              <Badge variant="amber">{drafts.length} draft{drafts.length === 1 ? '' : 's'}</Badge>
            </div>
            {drafts.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">No AI drafts are waiting. New drafts arrive with each cycle.</div>
            ) : (
              <div className="space-y-2">
                {drafts.slice(0, 5).map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      useApp.getState().setPage('warnings')
                      useApp.setState({ focusWarningId: w.id })
                    }}
                    className="flex w-full items-center gap-3 rounded-md border bg-background/40 px-3 py-2 text-left transition-colors hover:border-primary/50"
                  >
                    <span className="h-8 w-1 rounded-full" style={{ background: LEVEL_COLORS[w.draft.level] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{w.draft.districtIds.map((d) => DISTRICTS[d].name).join(', ')}</span>
                      <span className="num block text-[11px] text-muted-foreground">
                        {w.id} · {LEVEL_LABEL[w.draft.level]} · drafted {w.createdClock} IST
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="col-span-12 p-4 xl:col-span-4">
            <div className="mb-3 text-sm font-semibold">District risk · next 3 h</div>
            <div className="grid grid-cols-[1fr_76px_64px_70px] gap-2 border-b pb-1.5 text-[11px] text-muted-foreground">
              <span>District</span>
              <span>Level</span>
              <span>Max P(ltg)</span>
              <span>ETA</span>
            </div>
            {[...dw]
              .sort((a, b) => b.maxPLightning - a.maxPLightning)
              .map((d) => {
                const p = prevDw.find((x) => x.districtId === d.districtId)
                const delta = p ? Math.round((d.maxPLightning - p.maxPLightning) * 100) : 0
                return (
                  <div key={d.districtId} className="grid grid-cols-[1fr_76px_64px_70px] items-center gap-2 border-b border-border/40 py-1.5 text-[12px] last:border-0">
                    <span className="truncate">{DISTRICTS[d.districtId].name}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEVEL_COLORS[d.level] }} />
                      {LEVEL_LABEL[d.level]}
                    </span>
                    <span className="num">
                      {Math.round(d.maxPLightning * 100)}%{' '}
                      {delta !== 0 && <span className={cn('text-[10px]', delta > 0 ? 'text-[#FFC53D]' : 'text-imd-green')}>{delta > 0 ? `+${delta}` : delta}</span>}
                    </span>
                    <span className="num text-muted-foreground">{d.etaMin === null ? '—' : d.etaMin === 0 ? 'now' : `+${d.etaMin} min`}</span>
                  </div>
                )
              })}
          </Card>

          <Card className="col-span-12 space-y-4 p-4 xl:col-span-4">
            <div>
              <div className="text-sm font-semibold">Lightning flashes per 10 min · last hour</div>
              <div className="mb-2 text-[11px] text-muted-foreground">Observed · all flash types</div>
              <FlashBars run={run} />
            </div>
            <div>
              <div className="text-sm font-semibold">Forecast lightning area · P ≥ 50 %</div>
              <div className="mb-2 text-[11px] text-muted-foreground">km² over the domain, by lead time · TADIT forecast</div>
              <LightningAreaLine run={run} outage={outage} />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-12 gap-4 pb-4">
          <div className="col-span-12 h-[300px] xl:col-span-8">
            <ActivityFeed />
          </div>
          <div className="col-span-12 xl:col-span-4">
            <PipelineCard />
          </div>
        </div>
      </div>
    </div>
  )
}
