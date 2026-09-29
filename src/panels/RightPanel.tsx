import { selectWarnings, useApp, type Tab } from '@/state/store'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CellsTab } from './CellsTab'
import { WarningsTab } from './WarningsTab'
import { CompareTab } from './CompareTab'
import { PipelineTab } from './PipelineTab'
import { VerificationTab } from './VerificationTab'

const TABS: { id: Tab; label: string }[] = [
  { id: 'cells', label: 'Cells' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'compare', label: 'Compare' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'verification', label: 'Verification' },
]

export function RightPanel() {
  const tab = useApp((s) => s.tab)
  const drafts = useApp((s) => Object.values(selectWarnings(s)).filter((w) => w.status === 'draft' && w.world === s.scenarioId).length)
  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l bg-card">
      <Tabs value={tab} onValueChange={(v) => useApp.getState().setTab(v as Tab)} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-3 py-2.5">
          <TabsList className="grid w-full grid-cols-5">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="px-1 text-[12px]">
                {t.label}
                {t.id === 'warnings' && drafts > 0 && <span className="num ml-1 rounded bg-primary/20 px-1 text-[10px] text-primary">{drafts}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div id="panel-scroll" className="min-h-0 flex-1 overflow-y-auto p-3">
          <TabsContent value="cells" className="mt-0 h-full">
            <CellsTab />
          </TabsContent>
          <TabsContent value="warnings" className="mt-0">
            <WarningsTab />
          </TabsContent>
          <TabsContent value="compare" className="mt-0">
            <CompareTab />
          </TabsContent>
          <TabsContent value="pipeline" className="mt-0">
            <PipelineTab />
          </TabsContent>
          <TabsContent value="verification" className="mt-0">
            <VerificationTab />
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  )
}
