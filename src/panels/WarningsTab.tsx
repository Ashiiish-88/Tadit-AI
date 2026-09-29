import { useApp, selectWarnings } from '@/state/store'
import { DISTRICTS } from '@/data/districtHQ'
import { LEVEL_COLORS } from '@/config'
import { WarningCard, LEVEL_LABEL } from '@/components/WarningCard'

export function WarningsTab() {
  const run = useApp((s) => s.run)
  const all = useApp(selectWarnings)
  const outage = useApp((s) => s.outage)
  const world = useApp((s) => s.scenarioId)
  if (!run) return null
  const dw = (outage && run.outage ? run.outage : run.normal).districtWarnings
  const recs = Object.values(all).filter((w) => w.world === world)
  const drafts = recs.filter((w) => w.status === 'draft')
  const issued = recs.filter((w) => w.status === 'issued')
  const rejected = recs.filter((w) => w.status === 'rejected')

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <div className="grid grid-cols-[1fr_70px_78px_70px] gap-2 border-b px-3 py-2 text-[11px] text-muted-foreground">
          <span>District</span>
          <span>Level</span>
          <span>Max P(ltg)</span>
          <span>ETA</span>
        </div>
        {[...dw]
          .sort((a, b) => (a.etaMin ?? 999) - (b.etaMin ?? 999))
          .map((d) => (
            <div key={d.districtId} className="grid grid-cols-[1fr_70px_78px_70px] items-center gap-2 border-b border-border/50 px-3 py-1.5 text-xs last:border-0">
              <span className="truncate">{DISTRICTS[d.districtId].name}</span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEVEL_COLORS[d.level] }} />
                {LEVEL_LABEL[d.level]}
              </span>
              <span className="num">
                {(d.maxPLightning * 100).toFixed(0)}%
              </span>
              <span className="num text-muted-foreground">{d.etaMin === null ? '—' : d.etaMin === 0 ? 'now' : `+${d.etaMin} min`}</span>
            </div>
          ))}
        <div className="px-3 py-1.5 text-[10px] text-muted-foreground">
          Max over the next 3 h
        </div>
      </div>

      <Section title="Drafts awaiting forecaster" count={drafts.length}>
        {drafts.length === 0 && <Empty text="No drafts left. Everything has been approved or rejected." />}
        {drafts.map((w) => (
          <WarningCard key={w.id} w={w} compact />
        ))}
      </Section>
      {issued.length > 0 && (
        <Section title="Issued (exercise)" count={issued.length}>
          {issued.map((w) => (
            <WarningCard key={w.id} w={w} compact />
          ))}
        </Section>
      )}
      {rejected.length > 0 && (
        <Section title="Rejected" count={rejected.length}>
          {rejected.map((w) => (
            <WarningCard key={w.id} w={w} compact />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {title} <span className="num rounded bg-muted px-1.5">{count}</span>
      </div>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">{text}</div>
}
