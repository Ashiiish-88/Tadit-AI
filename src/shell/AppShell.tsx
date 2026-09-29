import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  BellRing,
  ChevronsLeft,
  ChevronsRight,
  Clapperboard,
  History,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Pause,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  Sparkles,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { simClock, useApp } from '@/state/store'
import type { Page } from '@/state/types'
import { Wordmark } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SCENARIO_BY_ID } from '@/scenarios'
import { STAGES, runNow, setPaused } from '@/live/liveEngine'
import { cn } from '@/lib/utils'

const NAV: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ops', label: 'Operations', icon: MapIcon },
  { id: 'warnings', label: 'Warnings', icon: BellRing },
  { id: 'runs', label: 'Model runs', icon: History },
  { id: 'feeds', label: 'Data feeds', icon: Activity },
  { id: 'replay', label: 'Case replay', icon: Clapperboard },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export const PAGE_TITLE: Record<Page, string> = {
  dashboard: 'Dashboard',
  ops: 'Operations',
  warnings: 'Warnings',
  runs: 'Model runs',
  feeds: 'Data feeds',
  replay: 'Case replay',
  settings: 'Settings',
}

/** Re-render every `ms` (for clocks and countdowns). */
export function useTick(ms = 1000) {
  const [, setN] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

/** Keep the page in the URL hash so reloads and links land on the same screen. */
export function useHashRoute() {
  const page = useApp((s) => s.page)
  useEffect(() => {
    const fromHash = () => {
      const p = window.location.hash.replace('#/', '') as Page
      if (p && p in PAGE_TITLE && p !== useApp.getState().page) useApp.getState().setPage(p)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])
  useEffect(() => {
    if (window.location.hash !== `#/${page}`) window.history.replaceState(null, '', `#/${page}`)
  }, [page])
}

export function LiveStatus({ className }: { className?: string }) {
  useTick(500)
  const live = useApp((s) => s.live)
  const cadence = useApp((s) => s.settings.cadenceSec)
  const mode = useApp((s) => s.mode)
  const cfg = SCENARIO_BY_ID[live.world]
  const secs = Math.max(0, Math.ceil((live.nextCycleAt - Date.now()) / 1000))
  const stage = STAGES.find((s) => s.id === live.stage)
  return (
    <div className={cn('flex h-8 items-center gap-2.5 rounded-md border bg-background/40 px-2.5 text-[12px]', className)}>
      <span className="relative flex h-2 w-2">
        {!live.paused && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-imd-green opacity-60" />}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', live.paused ? 'bg-muted-foreground' : 'bg-imd-green')} />
      </span>
      <span className="font-medium">{live.paused ? 'Paused' : 'Live'}</span>
      <Separator orientation="vertical" className="h-4" />
      <span className="max-w-[220px] truncate text-muted-foreground">{cfg?.region}</span>
      <Separator orientation="vertical" className="h-4" />
      {live.running && stage ? (
        <span className="flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-primary">{stage.label}</span>
          <Progress value={live.stageProgress} className="w-16" />
        </span>
      ) : (
        <span className="num text-muted-foreground">
          {live.paused ? 'cycle paused' : `next cycle in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
          <span className="hidden 2xl:inline"> · every {cadence >= 60 ? `${cadence / 60} min` : `${cadence} s`}</span>
        </span>
      )}
      {mode === 'replay' && <span className="text-[11px] text-bolt">· viewing replay</span>}
    </div>
  )
}

function SimClock() {
  useTick(1000)
  const mode = useApp((s) => s.mode)
  // re-render on the inputs of the clock only (not on every playback frame)
  useApp((s) => s.liveRunId)
  useApp((s) => s.live.nextCycleAt)
  useApp((s) => (s.mode === 'replay' ? Math.round(s.t) : 0))
  return (
    <div className="num text-right leading-tight">
      <div className="text-[14px] font-medium">{simClock(useApp.getState())} IST</div>
      <div className="text-[10px] text-muted-foreground">{mode === 'replay' ? 'replay clock' : 'data time'}</div>
    </div>
  )
}

function UserMenu() {
  const user = useApp((s) => s.user)
  if (!user) return null
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent" aria-label="Account">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-[12px] font-semibold text-primary">{initials}</span>
          <span className="hidden text-left leading-tight xl:block">
            <span className="block text-[12px] font-medium">{user.name}</span>
            <span className="block text-[10px] text-muted-foreground">
              <span className="capitalize">{user.role}</span> · {user.desk}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Signed in</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => useApp.getState().setPage('settings')}>
          <UserRound /> Account and settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => useApp.getState().signOut()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Header() {
  const page = useApp((s) => s.page)
  const assistantOpen = useApp((s) => s.assistantOpen)
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-card px-4">
      <Wordmark />
      <div className="hidden whitespace-nowrap text-xs text-muted-foreground min-[1500px]:block">SIH 2026 · PS 26072 · MoES / IMD</div>
      <Separator orientation="vertical" className="h-6" />
      <div className="text-sm font-medium">{PAGE_TITLE[page]}</div>
      <LiveStatus className="ml-2 hidden lg:flex" />
      <div className="ml-auto flex items-center gap-3">
        <SimClock />
        <Button variant={assistantOpen ? 'secondary' : 'outline'} size="sm" onClick={() => useApp.getState().setAssistantOpen(!assistantOpen)}>
          <Sparkles className="text-primary" /> Ask TADIT
          <kbd className="num ml-1 rounded border px-1 text-[10px] text-muted-foreground">/</kbd>
        </Button>
        <UserMenu />
      </div>
    </header>
  )
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const page = useApp((s) => s.page)
  const drafts = useApp((s) => Object.values(s.warnings).filter((w) => w.status === 'draft').length)
  const live = useApp((s) => s.live)
  const Item = ({ id, label, icon: Icon }: (typeof NAV)[number]) => {
    const active = page === id
    const btn = (
      <button
        onClick={() => useApp.getState().setPage(id)}
        className={cn(
          'relative flex h-10 w-full items-center gap-3 rounded-md px-3 text-[13px] text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground',
          active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <span className="flex-1 text-left">{label}</span>}
        {id === 'warnings' && drafts > 0 && (
          <span className={cn('num rounded bg-[#FFC53D]/20 px-1.5 text-[10px] font-semibold text-[#FFC53D]', collapsed && 'absolute right-1 top-1 px-1')}>{drafts}</span>
        )}
      </button>
    )
    return collapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    ) : (
      btn
    )
  }
  return (
    <nav className={cn('flex shrink-0 flex-col border-r bg-card p-2 transition-[width] duration-200 ease-out', collapsed ? 'w-16' : 'w-[216px]')}>
      <div className="space-y-1">
        {NAV.map((n) => (
          <Item key={n.id} {...n} />
        ))}
      </div>
      <div className="mt-auto space-y-2">
        {!collapsed && (
          <div className="space-y-2 rounded-lg border bg-background/40 p-2.5">
            <div className="text-[11px] font-medium text-muted-foreground">Live cycle</div>
            <div className="flex gap-1.5">
              <Button size="xs" variant="outline" className="flex-1" onClick={() => setPaused(!live.paused)}>
                {live.paused ? <Play /> : <Pause />} {live.paused ? 'Resume' : 'Pause'}
              </Button>
              <Button size="xs" variant="outline" className="flex-1" disabled={live.running} onClick={runNow}>
                <RefreshCw className={cn(live.running && 'animate-spin')} /> Run now
              </Button>
            </div>
            <div className="num text-[10px] text-muted-foreground">Cycle #{live.cycle}</div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="flex h-8 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>
    </nav>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const page = useApp((s) => s.page)
  const mapPage = page === 'ops' || page === 'replay'
  const [pinned, setPinned] = useState<boolean | null>(null)
  const collapsed = pinned ?? mapPage
  useEffect(() => setPinned(null), [mapPage])
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} onToggle={() => setPinned(!collapsed)} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
