import { useEffect, useMemo, useState } from 'react'
import { Inbox, Send } from 'lucide-react'
import { useApp } from '@/state/store'
import type { WarningRecord } from '@/state/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { WarningCard, LEVEL_LABEL, StatusBadge } from '@/components/WarningCard'
import { PhoneMock } from '@/components/PhonePreview'
import { DISTRICTS } from '@/data/districtHQ'
import { LEVEL_COLORS } from '@/config'
import { SCENARIO_BY_ID } from '@/scenarios'
import { cn } from '@/lib/utils'

type Filter = 'action' | 'issued' | 'closed' | 'all'
const FILTERS: { id: Filter; label: string; test: (w: WarningRecord) => boolean }[] = [
  { id: 'action', label: 'Needs action', test: (w) => w.status === 'draft' },
  { id: 'issued', label: 'Issued', test: (w) => w.status === 'issued' },
  { id: 'closed', label: 'Closed', test: (w) => ['rejected', 'superseded', 'expired'].includes(w.status) },
  { id: 'all', label: 'All', test: () => true },
]

export function WarningsPage() {
  const warnings = useApp((s) => s.warnings)
  const focus = useApp((s) => s.focusWarningId)
  const outbox = useApp((s) => s.outbox)
  const [view, setView] = useState<'inbox' | 'outbox'>('inbox')
  const [filter, setFilter] = useState<Filter>('action')
  const [sel, setSel] = useState<string | null>(null)

  const list = useMemo(
    () =>
      Object.values(warnings)
        .filter(FILTERS.find((f) => f.id === filter)!.test)
        .sort((a, b) => b.id.localeCompare(a.id)),
    [warnings, filter],
  )
  useEffect(() => {
    if (focus && warnings[focus]) {
      setView('inbox')
      setSel(focus)
      const w = warnings[focus]
      setFilter(w.status === 'draft' ? 'action' : w.status === 'issued' ? 'issued' : 'all')
      useApp.setState({ focusWarningId: null })
    }
  }, [focus, warnings])
  const current = (sel && warnings[sel]) || list[0] || null
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, Object.values(warnings).filter(f.test).length]))

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b px-5 py-3">
        <Tabs value={view} onValueChange={(v) => setView(v as 'inbox' | 'outbox')}>
          <TabsList>
            <TabsTrigger value="inbox" className="gap-1.5">
              <Inbox className="h-4 w-4" /> Inbox
            </TabsTrigger>
            <TabsTrigger value="outbox" className="gap-1.5">
              <Send className="h-4 w-4" /> Outbox <span className="num ml-1 text-[10px] text-muted-foreground">{outbox.length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {view === 'inbox' && (
          <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as Filter)}>
            {FILTERS.map((f) => (
              <ToggleGroupItem key={f.id} value={f.id} className="gap-1.5 px-3">
                {f.label} <span className="num text-[10px] text-muted-foreground">{counts[f.id]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <div className="ml-auto text-[12px] text-muted-foreground">Drafts come from the AI each cycle; only a forecaster can issue them.</div>
      </div>

      {view === 'outbox' ? (
        <Outbox />
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="w-[380px] shrink-0 overflow-y-auto border-r p-3">
            {list.length === 0 && (
              <div className="rounded-lg border border-dashed p-5 text-center text-[13px] text-muted-foreground">
                {filter === 'action' ? 'Inbox zero. New AI drafts arrive with the next cycle.' : 'Nothing here yet.'}
              </div>
            )}
            <div className="space-y-1.5">
              {list.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSel(w.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-accent/60',
                    current?.id === w.id && 'border-primary/40 bg-primary/10',
                  )}
                >
                  <span className="mt-0.5 h-9 w-1 shrink-0 rounded-full" style={{ background: LEVEL_COLORS[w.draft.level] }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="num text-[12px] font-semibold">{w.id}</span>
                      <span className="text-[11px] text-muted-foreground">{LEVEL_LABEL[w.draft.level]}</span>
                      <span className="ml-auto">
                        <StatusBadge status={w.status} />
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px]">{w.draft.districtIds.map((d) => DISTRICTS[d].name).join(', ')}</span>
                    <span className="num block text-[11px] text-muted-foreground">
                      {SCENARIO_BY_ID[w.world]?.region} · {w.createdClock} IST
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto p-5">
            {current ? (
              <div className="grid max-w-[1180px] grid-cols-1 gap-5 2xl:grid-cols-[1fr_300px]">
                <div className="space-y-5">
                  <WarningCard w={current} />
                  <Card className="p-4">
                    <div className="mb-3 text-sm font-semibold">Audit trail</div>
                    <ol className="relative space-y-3 border-l border-border pl-4">
                      {current.audit.map((a, i) => (
                        <li key={i} className="text-[12px]">
                          <span className={cn('absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full border-2 border-card', a.who === 'TADIT AI' ? 'bg-primary' : a.who === 'System' ? 'bg-muted-foreground' : 'bg-[#FFC53D]')} />
                          <div className="flex gap-2">
                            <span className="num text-muted-foreground">{a.at}</span>
                            <span className="font-medium">{a.who}</span>
                          </div>
                          <div className="text-muted-foreground">{a.what}</div>
                        </li>
                      ))}
                    </ol>
                  </Card>
                </div>
                <div className="space-y-2">
                  <div className="text-[12px] font-medium text-muted-foreground">Public message preview</div>
                  <PhoneMock w={current} />
                </div>
              </div>
            ) : (
              <div className="grid h-full place-items-center text-[13px] text-muted-foreground">Select a warning</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Outbox() {
  const outbox = useApp((s) => s.outbox)
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <Card className="max-w-[1100px]">
        <div className="grid grid-cols-[80px_110px_1fr_90px_200px] gap-3 border-b px-4 py-2.5 text-[11px] text-muted-foreground">
          <span>Time (IST)</span>
          <span>Channel</span>
          <span>Warning</span>
          <span>ID</span>
          <span>Delivery</span>
        </div>
        {outbox.length === 0 && <div className="p-6 text-center text-[13px] text-muted-foreground">Nothing approved yet. Approving a warning queues CAP, SMS and cell-broadcast messages here — in exercise mode.</div>}
        {outbox.map((o) => (
          <div key={o.id} className="grid grid-cols-[80px_110px_1fr_90px_200px] items-center gap-3 border-b border-border/50 px-4 py-2.5 text-[12px] last:border-0">
            <span className="num text-muted-foreground">{o.at}</span>
            <span>{o.channel}</span>
            <span className="truncate">{o.summary}</span>
            <button className="num text-left text-primary hover:underline" onClick={() => useApp.getState().setCapOpen(o.warningId)}>
              {o.warningId}
            </button>
            <Badge variant="amber" className="w-fit text-[10px]">
              Exercise
            </Badge>
          </div>
        ))}
      </Card>
      <div className="mt-3 text-[11px] text-muted-foreground">Exercise messages are logged here and not disseminated.</div>
    </div>
  )
}
