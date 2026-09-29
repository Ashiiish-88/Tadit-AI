// Simulated live operations: every cycle the feeds "arrive", the pipeline stages run, a new nowcast is
// published, and warning drafts are reconciled into the inbox. Everything is generated in the browser.

import { toast } from 'sonner'
import { SCENARIOS, SCENARIO_BY_ID } from '@/scenarios'
import { loadDistricts, loadIndiaOutline } from '@/lib/geoLoad'
import { createRng } from '@/lib/prng'
import { DISTRICTS } from '@/data/districtHQ'
import { LIVE_START_OFFSET, newRecord, runSource, shortRun, useApp } from '@/state/store'
import { runCache } from '@/state/runCache'
import type { FeedSample, RunSummary, StageId, WarningRecord } from '@/state/types'
import type { RunBundle } from '@/types/run'
import { situationSummary } from '@/ai/assistant'

const S = () => useApp.getState()
const LIVE_END_OFFSET = 120

export const STAGES: { id: StageId; label: string; ms: number }[] = [
  { id: 'ingest', label: 'Ingest feeds', ms: 1400 },
  { id: 'mosaic', label: 'Multi-radar mosaic', ms: 900 },
  { id: 'models', label: 'Models (U-Net + cell model)', ms: 1800 },
  { id: 'calibrate', label: 'Calibrate', ms: 700 },
  { id: 'warnings', label: 'Draft warnings', ms: 700 },
]

let timer = 0
export function startLive() {
  if (timer) return
  timer = window.setInterval(tick, 250)
  if (!S().liveRunId && !S().live.running) void runCycle({ first: true })
}

export function stopLive() {
  clearInterval(timer)
  timer = 0
}

function tick() {
  const s = S()
  if (!s.user || s.live.paused || s.live.running) return
  if (Date.now() >= s.live.nextCycleAt) void runCycle({})
}

export function setPaused(paused: boolean) {
  useApp.setState((s) => ({ live: { ...s.live, paused, nextCycleAt: paused ? s.live.nextCycleAt : Math.max(s.live.nextCycleAt, Date.now() + 2000) } }))
  S().addActivity('system', paused ? 'Live cycle paused by user' : 'Live cycle resumed')
}

export function runNow() {
  if (S().live.running) return
  S().addActivity('user', `Manual run requested by ${S().user?.name ?? 'forecaster'}`)
  void runCycle({})
}

/** Re-run the current cycle (e.g. after thresholds change) without advancing time. */
export function rerunCurrent() {
  if (S().live.running) return
  void runCycle({ keepTime: true })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function runCycle({ first = false, keepTime = false }: { first?: boolean; keepTime?: boolean }) {
  const s0 = S()
  let { world, offset, cycle } = s0.live
  let worldChanged = false
  if (!first && !keepTime) {
    offset += 10
    cycle += 1
    if (offset > LIVE_END_OFFSET) {
      const next = nextWorld(world)
      worldChanged = next !== world
      world = next
      offset = LIVE_START_OFFSET
    }
  }
  if (first && cycle === 0) cycle = 1
  const fixed = s0.settings.worldMode !== 'auto' && SCENARIO_BY_ID[s0.settings.worldMode]
  if (fixed && fixed.id !== world) {
    world = fixed.id
    offset = LIVE_START_OFFSET
    worldChanged = true
  }
  const cfg = SCENARIO_BY_ID[world]
  const started = Date.now()
  useApp.setState((s) => ({ live: { ...s.live, running: true, stage: 'ingest', stageProgress: 0, cycleStartedAt: started } }))

  // kick off the model run immediately; the stage animation runs alongside it
  const job = (async () => {
    const [outline, geo] = await Promise.all([loadIndiaOutline(), loadDistricts(cfg.districts)])
    const run = await runSource().load({
      scenarioId: world,
      nowOffset: offset,
      rules: S().settings.rules,
      geometry: cfg.districts.map((d) => ({ districtId: d, rings: geo[d] })),
    })
    return { run, outline, geo }
  })()

  let result: Awaited<typeof job>
  try {
    const speed = first ? 0.25 : 1
    for (const st of STAGES) {
      useApp.setState((s) => ({ live: { ...s.live, stage: st.id, stageProgress: 0 } }))
      const dur = st.ms * speed
      const steps = Math.max(1, Math.round(dur / 100))
      for (let i = 1; i <= steps; i++) {
        // background tabs throttle timers; skip the animation there so cycles still publish on time
        if (document.visibilityState !== 'hidden') await sleep(dur / steps)
        useApp.setState((s) => ({ live: { ...s.live, stageProgress: i / steps } }))
      }
      if (st.id === 'models') await job
    }
    result = await job
  } catch (e) {
    useApp.setState((s) => ({ live: { ...s.live, running: false, stage: null, nextCycleAt: Date.now() + 10000 } }))
    S().addActivity('system', `Cycle failed: ${String(e)}`)
    return
  }
  const engineMs = result.run.timings.totalMs
  publish(result.run, { world, offset, cycle, worldChanged, first, keepTime, engineMs })
  useApp.setState((s) => ({
    outline: result.outline,
    districtGeo: { ...s.districtGeo, ...result.geo },
  }))
}

function nextWorld(cur: string) {
  const i = SCENARIOS.findIndex((s) => s.id === cur)
  return SCENARIOS[(i + 1) % SCENARIOS.length].id
}

function publish(
  run: RunBundle,
  o: { world: string; offset: number; cycle: number; worldChanged: boolean; first: boolean; keepTime: boolean; engineMs: number },
) {
  const cfg = SCENARIO_BY_ID[o.world]
  runCache.put(run.manifest.runId, run)
  const s = S()
  const prevRunId = s.liveRunId && s.liveRunId !== run.manifest.runId ? s.liveRunId : s.prevRunId
  const rng = createRng(o.cycle * 7919 + cfg.seed)

  // run summary (stage durations are simulated)
  const k = 6
  const cells = run.cells.filter((c) => c.frames[k].maxDbz >= 35).length
  const maxPL = Math.max(...run.normal.districtWarnings.map((d) => d.maxPLightning), 0)
  const summary: RunSummary = {
    runId: run.manifest.runId,
    cycle: o.cycle,
    world: o.world,
    clock: run.manifest.nowClock,
    dateIso: cfg.dateIso,
    status: 'published',
    cells,
    maxPLightning: maxPL,
    drafts: run.warnings.length,
    stages: {
      ingest: Math.round(rng.range(20, 45)),
      mosaic: Math.round(rng.range(8, 16)),
      models: Math.round(rng.range(28, 55)),
      calibrate: Math.round(rng.range(3, 7)),
      warnings: Math.round(rng.range(2, 6)),
    },
    engineMs: o.engineMs,
  }
  const runs = [summary, ...s.runs.filter((r) => r.runId !== summary.runId).map((r) => (r.status === 'published' ? { ...r, status: 'superseded' as const } : r))].slice(0, 60)

  // feed telemetry (simulated)
  const sample: FeedSample = {
    cycle: o.cycle,
    latency: {
      dwr: Math.round(rng.range(45, 110)),
      sat: Math.round(rng.range(200, 420)),
      lightning: Math.round(rng.range(4, 18)),
      nwp: Math.round(rng.range(2400, 3400)),
    },
    files: {
      dwr: run.manifest.radars.length * 1,
      sat: 2,
      lightning: Math.round(rng.range(80, 400)) + run.flashes.filter((f) => f.t > -10 && f.t <= 0).length,
      nwp: o.cycle % 6 === 0 ? 1 : 0,
    },
  }

  useApp.setState((st) => ({
    liveRunId: run.manifest.runId,
    prevRunId: o.worldChanged ? null : prevRunId,
    runs,
    feedHistory: [...st.feedHistory.filter((f) => f.cycle !== o.cycle), sample].slice(-30),
    live: {
      ...st.live,
      world: o.world,
      offset: o.offset,
      cycle: o.cycle,
      running: false,
      stage: null,
      stageProgress: 0,
      nextCycleAt: Date.now() + st.settings.cadenceSec * 1000,
    },
  }))

  if (o.worldChanged) S().addActivity('system', `Active region switched to ${cfg.region}`)
  const created = reconcileWarnings(run, o)
  if (!o.first) {
    S().addActivity('cycle', `Nowcast ${shortRun(run.manifest.runId)} published for ${run.manifest.nowClock} IST · ${cells} cells · ${run.warnings.length} draft groups`)
  } else if (!s.activity.length) {
    S().addActivity('system', 'Session started — data feeds connected')
  }
  useApp.setState({ aiSummary: { runId: run.manifest.runId, text: situationSummary(run, runCache.get(prevRunId), cfg, S().warnings) } })
  S().showLiveRun(o.first)
  if (!o.first && !o.keepTime && S().page !== 'replay')
    toast(`Nowcast published · ${run.manifest.nowClock} IST`, {
      description: created ? `${created} new warning draft${created > 1 ? 's need' : ' needs'} review` : 'No new warning drafts',
      duration: 3500,
    })
}

/** Merge the run's drafts into the inbox: update open drafts, create new ones, retire stale ones. */
function reconcileWarnings(run: RunBundle, o: { world: string; offset: number; worldChanged: boolean; first: boolean }) {
  const s = S()
  const cfg = SCENARIO_BY_ID[o.world]
  const at = run.manifest.nowClock
  const map: Record<string, WarningRecord> = { ...s.warnings }
  let seq = s.seq
  let created = 0
  const note = (w: WarningRecord, what: string, who = 'TADIT AI') => ({ ...w, audit: [...w.audit, { at, who, what }] })

  for (const w of Object.values(map)) {
    if (w.world !== o.world) {
      if (w.status === 'draft') map[w.id] = note({ ...w, status: 'superseded' }, 'Superseded: active region changed', 'System')
      else if (w.status === 'issued') map[w.id] = note({ ...w, status: 'expired' }, 'Expired: validity window ended', 'System')
    } else if (w.status === 'issued' && minutesBetween(w.createdClock, at) >= 180) {
      map[w.id] = note({ ...w, status: 'expired' }, 'Expired: validity window ended', 'System')
    }
  }

  const levels = new Set(run.warnings.map((d) => d.level))
  for (const d of run.warnings) {
    const open = Object.values(map).find((w) => w.world === o.world && w.status === 'draft' && w.draft.level === d.level)
    const sameKey = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))
    if (open) {
      const changed = !sameKey(open.draft.districtIds, d.districtIds)
      map[open.id] = {
        ...(changed ? note(open, `Updated by run ${shortRun(run.manifest.runId)}: ${d.districtIds.map((x) => DISTRICTS[x].name).join(', ')}`) : open),
        draft: { ...d, id: open.id },
        runId: run.manifest.runId,
        nowClock: run.manifest.nowClock,
        phrase: open.phrase === open.draft.phrase ? d.phrase : open.phrase,
        phraseHi: open.phraseHi === open.draft.phraseHi ? d.phraseHi : open.phraseHi,
      }
      continue
    }
    const issued = Object.values(map).find(
      (w) => w.world === o.world && w.status === 'issued' && w.draft.level === d.level && sameKey(w.draft.districtIds, d.districtIds),
    )
    if (issued) continue
    seq += 1
    const id = `W-${String(seq).padStart(4, '0')}`
    map[id] = newRecord(id, { ...d, id }, run, cfg, s.settings.defaultLang, 'TADIT AI')
    created += 1
    if (!o.first)
      s.addActivity('ai', `AI drafted ${id}: ${d.level} warning for ${d.districtIds.map((x) => DISTRICTS[x].name).join(', ')}`)
  }
  for (const w of Object.values(map))
    if (w.world === o.world && w.status === 'draft' && !levels.has(w.draft.level))
      map[w.id] = note({ ...w, status: 'superseded' }, `Superseded: not supported by run ${shortRun(run.manifest.runId)}`)

  useApp.setState({ warnings: map, seq })
  return created
}

function minutesBetween(a: string, b: string) {
  const toMin = (c: string) => {
    const [h, m] = c.split(':').map(Number)
    return h * 60 + m
  }
  let d = toMin(b) - toMin(a)
  if (d < -720) d += 1440
  return d
}
