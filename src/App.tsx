import { useEffect } from 'react'
import { useApp } from '@/state/store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AppShell, useHashRoute } from '@/shell/AppShell'
import { Gallery } from '@/components/Gallery'
import { Wordmark } from '@/components/Logo'
import { CapDialog } from '@/components/CapDialog'
import { EditDialog } from '@/components/WarningCard'
import { EndCard } from '@/components/PresentationLayer'
import { AssistantPanel } from '@/ai/AssistantPanel'
import { useHotkeys, usePlayback, useRecordingMode } from '@/hooks/useControls'
import { startLive, stopLive } from '@/live/liveEngine'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { WarningsPage } from '@/pages/WarningsPage'
import { RunsPage } from '@/pages/RunsPage'
import { FeedsPage } from '@/pages/FeedsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { OperationsPage, ReplayPage } from '@/pages/ConsolePages'
import type { Page } from '@/state/types'
import { SCENARIO_BY_ID } from '@/scenarios'

const PAGES: Record<Page, () => JSX.Element> = {
  dashboard: DashboardPage,
  ops: OperationsPage,
  warnings: WarningsPage,
  runs: RunsPage,
  feeds: FeedsPage,
  replay: ReplayPage,
  settings: SettingsPage,
}

function SignedIn() {
  const page = useApp((s) => s.page)
  useHashRoute()
  useEffect(() => {
    startLive()
    // ?scenario=<id> opens that scenario in Replay (handy for recording)
    const q = new URLSearchParams(window.location.search).get('scenario')
    if (q && SCENARIO_BY_ID[q]) {
      useApp.setState({ replayScenarioId: q })
      useApp.getState().setPage('replay')
    }
    return () => stopLive()
  }, [])
  const P = PAGES[page]
  return (
    <>
      <AppShell>
        <P />
      </AppShell>
      <AssistantPanel />
      <Gallery />
      <CapDialog />
      <EditDialog />
      <EndCard />
    </>
  )
}

export default function App() {
  const user = useApp((s) => s.user)
  const recording = useApp((s) => s.recording)
  const endCard = useApp((s) => s.endCard)
  usePlayback()
  useHotkeys()
  useRecordingMode()

  return (
    <TooltipProvider delayDuration={recording ? 100000 : 250}>
      {user ? (
        <SignedIn />
      ) : (
        <div className="flex h-full flex-col">
          <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-4">
            <Wordmark />
            <span className="text-xs text-muted-foreground">SIH 2026 · PS 26072 · MoES / IMD</span>
          </header>
          <div className="min-h-0 flex-1">
            <LoginPage />
          </div>
        </div>
      )}
      {!endCard && <Toaster position="bottom-right" offset={24} />}
    </TooltipProvider>
  )
}
