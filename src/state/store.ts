import { create } from 'zustand'
import { toast } from 'sonner'
import { TIME, WARNING_RULES } from '@/config'
import { SCENARIOS, SCENARIO_BY_ID, scenarioIndex } from '@/scenarios'
import type { LayerKey, ScenarioConfig } from '@/scenarios/types'
import type { RulesConfig, RunBundle, WarningDraft } from '@/types/run'
import { ProceduralRunSource } from '@/engine/sources'
import { loadDistricts, loadIndiaOutline, type Ring } from '@/lib/geoLoad'
import type { MsgLang } from '@/lib/messages'
import { districtKm } from '@/scenarios/builders'
import { clockAdd } from '@/lib/time'
import { DISTRICTS } from '@/data/districtHQ'
import { runCache } from './runCache'
import { loadSaved, saveLater, clearSaved } from './persist'
import type {
  ActivityEntry,
  ChatMessage,
  FeedSample,
  LiveState,
  OutboxEntry,
  Page,
  RunSummary,
  Settings,
  User,
  WarningRecord,
} from './types'

export type Tab = 'cells' | 'warnings' | 'compare' | 'pipeline' | 'verification'
export type { WarningRecord } from './types'

export interface FlyTarget {
  x: number
  y: number
  /** visible width in km */
  widthKm: number
  durationMs: number
  nonce: number
}

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  radar: true,
  pThunder: false,
  pLightning: true,
  strikes: true,
  sat: false,
  cape: false,
  cells: true,
  warnings: true,
  rings: true,
}

export const DEFAULT_RULES: RulesConfig = {
  yellowPLightning: WARNING_RULES.yellow.pLightning,
  yellowP45: WARNING_RULES.yellow.p45,
  orangeP45: WARNING_RULES.orange.p45,
  orangeP54: WARNING_RULES.orange.p54,
  redP54: WARNING_RULES.red.p54,
}

export const DEFAULT_SETTINGS: Settings = { cadenceSec: 60, worldMode: 'auto', defaultLang: 'en', rules: DEFAULT_RULES }

export const LIVE_START_OFFSET = -10

interface State {
  // ---- session
  user: User | null
  page: Page
  settings: Settings
  seq: number

  // ---- view (what the map and panels show)
  mode: 'live' | 'replay'
  scenarioId: string
  scenario: ScenarioConfig
  run: RunBundle | null
  loading: boolean
  error: string | null
  outline: Ring[] | null
  districtGeo: Record<string, Ring[] | null>
  t: number
  playing: boolean
  speed: 1 | 2 | 4
  layers: Record<LayerKey, boolean>
  selectedCellId: string | null
  tab: Tab
  panelOpen: boolean
  hidePanels: boolean
  compareLead: 30 | 60 | 90
  split: number
  outage: boolean
  recording: boolean
  presenting: boolean
  caption: string | null
  captionStep: number
  galleryOpen: boolean
  endCard: boolean
  capOpenFor: string | null
  phoneFor: string | null
  editFor: string | null
  focusWarningId: string | null
  flyTo: FlyTarget | null

  // ---- live system
  live: LiveState
  liveRunId: string | null
  prevRunId: string | null
  runs: RunSummary[]
  feedHistory: FeedSample[]
  warnings: Record<string, WarningRecord>
  outbox: OutboxEntry[]
  activity: ActivityEntry[]

  // ---- replay
  replayScenarioId: string
  replayWarnings: Record<string, WarningRecord>

  // ---- AI assistant
  assistantOpen: boolean
  chat: ChatMessage[]
  aiSummary: { runId: string; text: string } | null

  // ---- actions
  signIn: (u: User) => void
  signOut: () => void
  setPage: (p: Page) => void
  updateSettings: (patch: Partial<Settings>) => void
  resetDemoData: () => void
  addActivity: (kind: ActivityEntry['kind'], text: string) => void
  showLiveRun: (fly: boolean) => void

  loadScenario: (id: string) => Promise<void>
  stepScenario: (dir: 1 | -1) => void
  setT: (t: number) => void
  stepT: (dir: 1 | -1) => void
  setPlaying: (p: boolean) => void
  togglePlay: () => void
  setSpeed: (s: 1 | 2 | 4) => void
  toggleLayer: (k: LayerKey) => void
  selectCell: (id: string | null, fly?: boolean) => void
  setTab: (t: Tab) => void
  setPanelOpen: (o: boolean) => void
  toggleHidePanels: () => void
  setCompareLead: (l: 30 | 60 | 90) => void
  setSplit: (s: number) => void
  toggleOutage: () => void
  setOutage: (o: boolean) => void
  setRecording: (r: boolean) => void
  setGalleryOpen: (o: boolean) => void
  fly: (x: number, y: number, widthKm: number, durationMs?: number) => void
  flyHome: (durationMs?: number) => void
  updateWarning: (id: string, patch: Partial<WarningRecord>, auditNote?: string) => void
  approveWarning: (id: string, opts?: { scripted?: boolean }) => void
  rejectWarning: (id: string) => void
  setCapOpen: (id: string | null) => void
  setPhoneFor: (id: string | null) => void
  setEditFor: (id: string | null) => void
  setAssistantOpen: (o: boolean) => void
  reset: () => void
}

let source: ProceduralRunSource | null = null
export function runSource() {
  source ??= new ProceduralRunSource()
  return source
}
let flyNonce = 0
let pendingLoad: string | null = null
const uid = () => Math.random().toString(36).slice(2, 10)

/** Current simulated IST clock (HH:MM). */
export function simClock(s: State = useApp.getState()): string {
  if (s.mode === 'replay') return clockAdd(s.scenario.nowClock, Math.max(0, Math.round(s.t)))
  const run = runCache.get(s.liveRunId)
  if (!run) return '--:--'
  const publishedAt = s.live.nextCycleAt - s.settings.cadenceSec * 1000
  const frac = Math.max(0, Math.min(1, (Date.now() - publishedAt) / (s.settings.cadenceSec * 1000)))
  return clockAdd(run.manifest.nowClock, Math.floor(frac * TIME.stepMin))
}

/** Warnings of the current mode (live inbox or replay scenario). */
export const selectWarnings = (s: State) => (s.mode === 'live' ? s.warnings : s.replayWarnings)

export function recordsFromRun(run: RunBundle, cfg: ScenarioConfig, lang: MsgLang): Record<string, WarningRecord> {
  return Object.fromEntries(run.warnings.map((w) => [w.id, newRecord(w.id, w, run, cfg, lang, 'TADIT AI')]))
}

export function newRecord(id: string, w: WarningDraft, run: RunBundle, cfg: ScenarioConfig, lang: MsgLang, who: string): WarningRecord {
  return {
    id,
    draft: w,
    world: cfg.id,
    runId: run.manifest.runId,
    dateIso: cfg.dateIso,
    nowClock: run.manifest.nowClock,
    createdClock: run.manifest.nowClock,
    status: 'draft',
    lang,
    intensity: w.intensity,
    phrase: w.phrase,
    phraseHi: w.phraseHi,
    gust: '',
    hailNote: '',
    audit: [{ at: run.manifest.nowClock, who, what: `Drafted from run ${shortRun(run.manifest.runId)}` }],
  }
}

export function shortRun(runId: string) {
  const parts = runId.split('-')
  return `R-${parts[parts.length - 1].slice(0, 6).toUpperCase()}`
}

/** View that frames the scenario's districts and the storms present at now. */
export function homeView(cfg: ScenarioConfig, run: RunBundle | null) {
  const pts = cfg.districts.map((id) => districtKm(cfg.center, id))
  if (run)
    for (const c of run.cells) {
      const f = c.frames[TIME.nowIndex]
      if (f.maxDbz >= 35) pts.push({ x: f.x, y: f.y })
    }
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const widthKm = Math.max(360, Math.min(760, Math.max(maxX - minX, (maxY - minY) * 1.9) + 200))
  return { x: (minX + maxX) / 2 - widthKm * 0.08, y: (minY + maxY) / 2, widthKm }
}

const saved = loadSaved<State>()
const firstWorld = SCENARIOS[0]

export const useApp = create<State>((set, get) => ({
  user: saved.user ?? null,
  page: 'dashboard',
  settings: { ...DEFAULT_SETTINGS, ...saved.settings, rules: { ...DEFAULT_RULES, ...saved.settings?.rules } },
  seq: saved.seq ?? 0,

  mode: 'live',
  scenarioId: saved.live?.world ?? firstWorld.id,
  scenario: SCENARIO_BY_ID[saved.live?.world ?? ''] ?? firstWorld,
  run: null,
  loading: true,
  error: null,
  outline: null,
  districtGeo: {},
  t: 0,
  playing: false,
  speed: 1,
  layers: { ...DEFAULT_LAYERS },
  selectedCellId: null,
  tab: 'cells',
  panelOpen: true,
  hidePanels: false,
  compareLead: 60,
  split: 0.5,
  outage: false,
  recording: false,
  presenting: false,
  caption: null,
  captionStep: 0,
  galleryOpen: false,
  endCard: false,
  capOpenFor: null,
  phoneFor: null,
  editFor: null,
  focusWarningId: null,
  flyTo: null,

  live: {
    world: saved.live?.world ?? firstWorld.id,
    offset: saved.live?.offset ?? LIVE_START_OFFSET,
    cycle: saved.live?.cycle ?? 0,
    paused: false,
    nextCycleAt: 0,
    cycleStartedAt: 0,
    stage: null,
    stageProgress: 0,
    running: false,
  },
  liveRunId: null,
  prevRunId: null,
  runs: saved.runs ?? [],
  feedHistory: saved.feedHistory ?? [],
  warnings: saved.warnings ?? {},
  outbox: saved.outbox ?? [],
  activity: saved.activity ?? [],

  replayScenarioId: SCENARIOS[0].id,
  replayWarnings: {},

  assistantOpen: false,
  chat: [],
  aiSummary: null,

  // ------------------------------------------------------------------ session
  signIn: (user) => {
    set({ user, page: 'dashboard' })
    get().addActivity('user', `${user.name} signed in (${user.role}, ${user.desk})`)
  },
  signOut: () => {
    const u = get().user
    if (u) get().addActivity('user', `${u.name} signed out`)
    if (get().mode === 'replay') get().setPage('dashboard')
    set({ user: null, assistantOpen: false, page: 'dashboard' })
    window.history.replaceState(null, '', '#/dashboard')
  },

  setPage: (page) => {
    const s = get()
    set({ page, capOpenFor: null, phoneFor: null, editFor: null })
    if (page === 'replay' && s.mode !== 'replay') {
      set({ mode: 'replay', selectedCellId: null, tab: 'cells', t: 0, playing: false })
      void get().loadScenario(s.replayScenarioId)
    } else if (page !== 'replay' && s.mode === 'replay') {
      set({ mode: 'live', presenting: false, caption: null, endCard: false, tab: 'cells', t: 0, playing: false, split: 0.5, selectedCellId: null })
      get().showLiveRun(true)
    }
  },

  updateSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch, rules: { ...s.settings.rules, ...patch.rules } } }))
  },

  resetDemoData: () => {
    clearSaved()
    set({
      warnings: {},
      outbox: [],
      activity: [],
      runs: [],
      feedHistory: [],
      seq: 0,
      settings: { ...DEFAULT_SETTINGS },
      live: { ...get().live, world: firstWorld.id, offset: LIVE_START_OFFSET - 10, cycle: 0, nextCycleAt: Date.now() },
    })
  },

  addActivity: (kind, text) =>
    set((s) => ({ activity: [{ id: uid(), at: simClock(s), kind, text }, ...s.activity].slice(0, 120) })),

  showLiveRun: (fly) => {
    const s = get()
    const run = runCache.get(s.liveRunId)
    if (!run || s.mode !== 'live') return
    const cfg = SCENARIO_BY_ID[s.live.world]
    const changedWorld = s.scenarioId !== cfg.id || !s.run || s.run.manifest.scenarioId !== cfg.id
    set({
      run,
      scenario: cfg,
      scenarioId: cfg.id,
      loading: false,
      layers: changedWorld ? { ...DEFAULT_LAYERS, ...cfg.defaultLayers } : s.layers,
      outage: changedWorld ? !!cfg.outageDefault : s.outage,
      selectedCellId: run.cells.some((c) => c.id === s.selectedCellId) ? s.selectedCellId : null,
    })
    if (fly || changedWorld) get().flyHome(0)
  },

  // ------------------------------------------------------------------ replay
  loadScenario: async (id) => {
    const cfg = SCENARIO_BY_ID[id]
    if (!cfg) return
    if (get().loading && get().scenarioId === id && pendingLoad === id) return
    set({ replayScenarioId: id })
    if (get().mode !== 'replay') return
    pendingLoad = id
    set({
      scenarioId: id,
      scenario: cfg,
      loading: true,
      error: null,
      playing: false,
      selectedCellId: null,
      capOpenFor: null,
      phoneFor: null,
      layers: { ...DEFAULT_LAYERS, ...cfg.defaultLayers },
      outage: !!cfg.outageDefault,
    })
    try {
      const key = `replay:${id}`
      const [outline, districtGeo] = await Promise.all([loadIndiaOutline(), loadDistricts(cfg.districts)])
      let run = runCache.get(key)
      if (!run) {
        run = await runSource().load({
          scenarioId: id,
          geometry: cfg.districts.map((d) => ({ districtId: d, rings: districtGeo[d] })),
        })
        runCache.put(key, run)
      }
      pendingLoad = null
      if (get().scenarioId !== id || get().mode !== 'replay') return
      toast.dismiss()
      set((s) => ({
        run,
        outline,
        districtGeo: { ...s.districtGeo, ...districtGeo },
        loading: false,
        t: 0,
        replayWarnings: recordsFromRun(run, cfg, 'en'),
      }))
      get().flyHome(0)
    } catch (e) {
      pendingLoad = null
      set({ loading: false, error: String(e) })
    }
  },

  stepScenario: (dir) => {
    const i = scenarioIndex(get().scenarioId)
    const next = SCENARIOS[(i + dir + SCENARIOS.length) % SCENARIOS.length]
    void get().loadScenario(next.id)
  },

  // ------------------------------------------------------------------ view
  setT: (t) => set({ t: Math.max(TIME.startMin, Math.min(TIME.endMin, t)) }),
  stepT: (dir) => {
    const t = Math.round(get().t / 10) * 10 + dir * 10
    set({ t: Math.max(TIME.startMin, Math.min(TIME.endMin, t)), playing: false })
  },
  setPlaying: (p) => set({ playing: p }),
  togglePlay: () => {
    const { playing, t } = get()
    if (!playing && t >= TIME.endMin) set({ t: TIME.startMin })
    set({ playing: !playing })
  },
  setSpeed: (speed) => set({ speed }),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),

  selectCell: (id, fly = true) => {
    set({ selectedCellId: id })
    const run = get().run
    if (!id || !run || !fly) return
    const c = run.cells.find((c) => c.id === id)
    if (!c) return
    const k = Math.round((get().t - TIME.startMin) / TIME.stepMin)
    const f = c.frames[Math.max(0, Math.min(c.frames.length - 1, k))]
    get().fly(f.x, f.y, 240)
  },

  setTab: (tab) => {
    const prev = get().tab
    set({ tab, panelOpen: true })
    if (tab === 'compare') set({ t: get().compareLead, playing: false })
    else if (prev === 'compare') set({ split: 0.5 })
  },
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  toggleHidePanels: () => set((s) => ({ hidePanels: !s.hidePanels })),
  setCompareLead: (compareLead) => set({ compareLead, t: compareLead }),
  setSplit: (split) => set({ split: Math.max(0.02, Math.min(0.98, split)) }),

  toggleOutage: () => get().setOutage(!get().outage),
  setOutage: (o) => {
    const run = get().run
    if (o && !run?.outage) {
      toast('No radar to take offline in this scenario', {
        description: get().scenario.note ?? 'This domain already runs on satellite + lightning.',
      })
      return
    }
    if (o === get().outage) return
    set({ outage: o })
    if (get().mode === 'live' && run?.manifest.outageRadarId) {
      const name = run.manifest.radars.find((r) => r.id === run.manifest.outageRadarId)?.name
      get().addActivity('feed', o ? `Feed alert: ${name} DWR offline (failover test)` : `${name} DWR back online`)
    }
  },
  setRecording: (recording) => set({ recording }),
  setGalleryOpen: (galleryOpen) => set({ galleryOpen }),

  fly: (x, y, widthKm, durationMs = 1100) => set({ flyTo: { x, y, widthKm, durationMs, nonce: ++flyNonce } }),
  flyHome: (durationMs = 1100) => {
    const h = homeView(get().scenario, get().run)
    get().fly(h.x, h.y, h.widthKm, durationMs)
  },

  // ------------------------------------------------------------------ warnings
  updateWarning: (id, patch, auditNote) => {
    const key = get().mode === 'live' ? 'warnings' : 'replayWarnings'
    set((s) => {
      const map = s[key]
      const cur = map[id]
      if (!cur) return {}
      const audit = auditNote ? [...cur.audit, { at: simClock(s), who: s.user?.name ?? 'Forecaster', what: auditNote }] : cur.audit
      return { [key]: { ...map, [id]: { ...cur, ...patch, audit } } } as Partial<State>
    })
  },
  approveWarning: (id, opts) => {
    const s = get()
    const w = selectWarnings(s)[id]
    if (!w || !w.gust.trim() || w.status !== 'draft') return
    if (s.user?.role === 'observer' && !opts?.scripted) {
      toast.error('Observers cannot approve warnings')
      return
    }
    get().updateWarning(id, { status: 'issued' }, `Approved as exercise (gust ${w.gust.trim()} km/h entered by forecaster)`)
    const at = simClock(get())
    const districts = w.draft.districtIds.map((d) => DISTRICTS[d].name).join(', ')
    const entries: OutboxEntry[] = (['CAP feed', 'SMS', 'Cell broadcast'] as const).map((channel) => ({
      id: uid(),
      warningId: id,
      channel,
      at,
      summary: `${w.draft.level[0].toUpperCase()}${w.draft.level.slice(1)} · ${districts}`,
    }))
    // the outbox is the live system's delivery log; replay approvals stay in the replay
    if (get().mode === 'live') set((st) => ({ outbox: [...entries, ...st.outbox].slice(0, 200) }))
    if (get().mode === 'live') get().addActivity('warning', `${id} approved by ${s.user?.name ?? 'forecaster'} · CAP 1.2 generated (Exercise)`)
    toast.success('CAP 1.2 alert generated (Exercise)', {
      description: 'Moved to Issued. Messages logged in the Outbox.',
      duration: 4000,
    })
  },
  rejectWarning: (id) => {
    const s = get()
    if (s.user?.role === 'observer') {
      toast.error('Observers cannot reject warnings')
      return
    }
    get().updateWarning(id, { status: 'rejected' }, 'Rejected by forecaster')
    if (get().mode === 'live') get().addActivity('warning', `${id} rejected by ${s.user?.name ?? 'forecaster'}`)
  },
  setCapOpen: (capOpenFor) => set({ capOpenFor }),
  setPhoneFor: (phoneFor) => set({ phoneFor }),
  setEditFor: (editFor) => set({ editFor }),
  setAssistantOpen: (assistantOpen) => set({ assistantOpen }),

  reset: () => {
    const run = get().run
    const cfg = get().scenario
    set({
      t: 0,
      playing: false,
      selectedCellId: null,
      tab: 'cells',
      split: 0.5,
      outage: !!cfg.outageDefault,
      layers: { ...DEFAULT_LAYERS, ...cfg.defaultLayers },
      capOpenFor: null,
      phoneFor: null,
      endCard: false,
      caption: null,
      hidePanels: false,
      panelOpen: true,
    })
    if (get().mode === 'replay' && run) set({ replayWarnings: recordsFromRun(run, cfg, 'en') })
    get().flyHome()
  },
}))

/** Frame index (0..24) nearest to time t */
export function frameIndex(t: number) {
  return Math.max(0, Math.min(TIME.frameCount - 1, Math.round((t - TIME.startMin) / TIME.stepMin)))
}

// Persist the session (not the run bundles).
useApp.subscribe((s) =>
  saveLater({
    user: s.user,
    settings: s.settings,
    seq: s.seq,
    warnings: s.warnings,
    outbox: s.outbox,
    activity: s.activity,
    runs: s.runs,
    feedHistory: s.feedHistory,
    live: { world: s.live.world, offset: s.live.offset, cycle: s.live.cycle },
  }),
)

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__tadit = useApp
