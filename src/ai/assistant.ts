// "Ask TADIT" — a simulated AI assistant. Answers are composed by rules from the current run (cells,
// districts, warnings, feeds). No language model is called; the UI says so.

import { TIME } from '@/config'
import { DISTRICTS } from '@/data/districtHQ'
import { bearing, compass } from '@/lib/geo'
import { clockAdd } from '@/lib/time'
import { messageEn, messageHi } from '@/lib/messages'
import type { ScenarioConfig } from '@/scenarios/types'
import type { WarningRecord } from '@/state/types'
import type { CellTrack, DistrictWarning, RunBundle } from '@/types/run'

export interface AiAction {
  label: string
  kind: 'cell' | 'warning' | 'page' | 'compare'
  arg?: string
}

export interface AiReply {
  thinking: string[]
  text: string
  actions: AiAction[]
}

export interface AiContext {
  run: RunBundle
  prev: RunBundle | null
  cfg: ScenarioConfig
  warnings: WarningRecord[]
  outage: boolean
}

const K = TIME.nowIndex
const pct = (p: number) => `${Math.round(p * 100)}%`
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const runTag = (run: RunBundle) => `R-${run.manifest.runId.split('-').pop()!.slice(0, 6).toUpperCase()}`

function liveCells(run: RunBundle) {
  return run.cells.filter((c) => c.frames[K].maxDbz >= 35)
}
function strongest(run: RunBundle) {
  return [...liveCells(run)].sort((a, b) => b.frames[K].maxDbz - a.frames[K].maxDbz)[0] ?? null
}
function motionText(c: CellTrack) {
  return `${compass(bearing(c.u, c.v))} at ${Math.round(Math.hypot(c.u, c.v) * 60)} km/h`
}
function districtWarnings(ctx: AiContext): DistrictWarning[] {
  return (ctx.outage && ctx.run.outage ? ctx.run.outage : ctx.run.normal).districtWarnings
}
function name(id: string) {
  return DISTRICTS[id]?.name ?? id
}
function etaText(eta: number | null, nowClock: string) {
  if (eta === null) return 'not expected in 3 h'
  if (eta === 0) return 'now'
  return `+${eta} min (${clockAdd(nowClock, eta)} IST)`
}

export function situationSummary(run: RunBundle, prev: RunBundle | null, cfg: ScenarioConfig, warnings: Record<string, WarningRecord>): string {
  const cells = liveCells(run)
  const top = strongest(run)
  const dw = run.normal.districtWarnings
  const soon = dw.filter((d) => d.etaMin !== null && d.etaMin > 0 && d.etaMin <= 90).sort((a, b) => a.etaMin! - b.etaMin!)
  const now = dw.filter((d) => d.etaMin === 0)
  const onset = run.cells.filter((c) => c.frames[K].onset)
  const newCells = run.cells.filter((c) => c.isNew && c.frames.slice(K, K + 4).some((f) => f.maxDbz >= 35))
  const drafts = Object.values(warnings).filter((w) => w.world === cfg.id && w.status === 'draft')
  const lines: string[] = []
  lines.push(
    `At **${run.manifest.nowClock} IST** TADIT is tracking **${cells.length} storm cell${cells.length === 1 ? '' : 's'}** over ${cfg.region}.`,
  )
  if (top) lines.push(`- Strongest: **${top.id}** at ${Math.round(top.frames[K].maxDbz)} dBZ, moving ${motionText(top)}.`)
  if (now.length) lines.push(`- Lightning risk already over ${now.map((d) => name(d.districtId)).join(', ')}.`)
  if (soon.length) lines.push(`- Next up: ${soon.slice(0, 3).map((d) => `${name(d.districtId)} ${etaText(d.etaMin, run.manifest.nowClock)}`).join('; ')}.`)
  if (onset.length)
    lines.push(`- Onset alert on **${onset.map((c) => c.id).join(', ')}**: no flash yet, ${pct(onset[0].frames[K].pL30)} chance of first lightning within 30 min.`)
  if (newCells.length) lines.push(`- New development: **${newCells[0].id}** is forecast to form within 30 min; satellite cloud tops are already cooling.`)
  if (prev) {
    const count = (r: RunBundle, lvl: string) => r.normal.districtWarnings.filter((d) => d.level === lvl).length
    const o1 = count(prev, 'orange') + count(prev, 'red')
    const o2 = count(run, 'orange') + count(run, 'red')
    if (o1 !== o2) lines.push(`- Trend: orange/red districts ${o1} → ${o2} since the previous run.`)
    else lines.push('- Trend: warning picture unchanged since the previous run.')
  }
  lines.push(drafts.length ? `**${drafts.length} draft${drafts.length > 1 ? 's' : ''}** await forecaster approval.` : 'No drafts are waiting for approval.')
  return lines.join('\n')
}

export const SUGGESTIONS = [
  'Summarise the situation',
  'Which districts get lightning in the next hour?',
  'Why is the top cell flagged?',
  'Draft a bulletin in Hindi',
  'Is any radar down?',
  'How accurate is TADIT?',
]

export function answer(q: string, ctx: AiContext): AiReply {
  const text = q.toLowerCase()
  const { run, cfg } = ctx
  const read = `Reading run ${runTag(run)} (${run.manifest.nowClock} IST, ${cfg.region})`
  const dw = districtWarnings(ctx)

  // --- a specific cell
  const cellMatch = run.cells.find((c) => new RegExp(`\\b${c.id}\\b`, 'i').test(q))
  if (cellMatch || /\bwhy\b|flag|explain/.test(text)) {
    const c = cellMatch ?? [...liveCells(run)].sort((a, b) => b.frames[K].pL30 - a.frames[K].pL30)[0]
    if (!c) return { thinking: [read], text: 'There are no active cells at this time step.', actions: [] }
    const f = c.frames[K]
    const bullets = f.explain.map((a) => `- ${a.value >= 0 ? 'Raises' : 'Lowers'} risk: ${a.label}`)
    const path = f.path.length ? f.path.map((p) => `${name(p.districtId)} ${etaText(p.etaMin, run.manifest.nowClock)}`).join('; ') : 'none of the watched districts'
    return {
      thinking: [read, `Looking up cell ${c.id}`, 'Ranking attribution factors (SHAP)'],
      text: [
        `**${c.id}** is at ${Math.round(f.maxDbz)} dBZ, moving ${motionText(c)}. P(lightning in the next 30 min) is **${pct(f.pL30)}**${f.onset ? ' and it has not flashed yet, so it carries an onset alert' : ''}.`,
        ...bullets,
        `In its path: ${path}.`,
      ].join('\n'),
      actions: [{ label: `Show ${c.id} on map`, kind: 'cell', arg: c.id }],
    }
  }

  // --- a district by name
  const dMatch = cfg.districts.find((id) => text.includes(name(id).toLowerCase()))
  if (dMatch) {
    const d = dw.find((x) => x.districtId === dMatch)!
    const rec = ctx.warnings.find((w) => w.draft.districtIds.includes(dMatch) && (w.status === 'draft' || w.status === 'issued'))
    return {
      thinking: [read, `Rasterising ${name(dMatch)} footprint`, 'Taking the max over the next 3 hours'],
      text: [
        `**${name(dMatch)}** is **${d.level}**. Max P(lightning) ${pct(d.maxPLightning)}, P(≥45 dBZ) ${pct(d.maxP45)}.`,
        `- Lightning ETA: ${etaText(d.etaMin, run.manifest.nowClock)}.`,
        `- Spatial extent: ${d.phrase}.`,
        rec ? `- Warning ${rec.id} is ${rec.status === 'draft' ? 'drafted and awaiting approval' : 'issued (exercise)'}.` : '- No open warning covers it.',
      ].join('\n'),
      actions: rec ? [{ label: `Open ${rec.id}`, kind: 'warning', arg: rec.id }] : [],
    }
  }

  // --- bulletin drafting
  if (/bulletin|draft|write|sms|message|hindi|हिंदी/.test(text)) {
    const w = [...ctx.warnings].filter((x) => x.status === 'draft' || x.status === 'issued').sort((a, b) => lvl(b.draft.level) - lvl(a.draft.level))[0]
    if (!w) return { thinking: [read, 'Collecting open warnings'], text: 'There is no open warning to turn into a bulletin right now.', actions: [] }
    const hindi = /hindi|हिंदी/.test(text)
    const body = hindi ? messageHi(w.draft, w, w.nowClock) : messageEn(w.draft, w, w.nowClock)
    return {
      thinking: [read, `Using warning ${w.id} (${w.draft.level})`, hindi ? 'Filling the IMD Hindi template' : 'Filling the IMD English template'],
      text: [`Draft ${hindi ? 'Hindi ' : ''}bulletin from **${w.id}**:`, `> ${body}`, w.gust ? '' : 'Gust speed is left for the forecaster — TADIT does not forecast wind.'].filter(Boolean).join('\n'),
      actions: [{ label: `Open ${w.id}`, kind: 'warning', arg: w.id }],
    }
  }

  // --- accuracy (honest)
  if (/accura|skill|reliab|verif|how good|perform|csi|score|trust|error rate/.test(text)) {
    return {
      thinking: ['Opening /data/scores.json', 'Status: pending'],
      text: [
        "**No measured accuracy yet.** I won't quote a number that hasn't been computed.",
        '- Planned: CSI/POD/FAR at 33/45/54 dBZ, FSS at 10/20/40 km, Brier skill + reliability, minutes of warning before the first flash.',
        '- Baselines: persistence and pySTEPS, on a by-date SEVIR test split.',
      ].join('\n'),
      actions: [{ label: 'Open verification plan', kind: 'page', arg: 'verification' }],
    }
  }

  // --- wind / hail (honest)
  if (/wind|gust|hail|squall speed/.test(text)) {
    return {
      thinking: [read],
      text: 'TADIT forecasts thunderstorm and lightning probability only. **Wind gusts and hail are not forecast by the model** — the forecaster types the gust speed into each warning, and hail notes are forecaster remarks.',
      actions: [{ label: 'Go to warnings', kind: 'page', arg: 'warnings' }],
    }
  }

  // --- radar / feeds
  if (/radar|outage|feed|down|offline|satellite|insat/.test(text)) {
    const off = ctx.outage ? run.manifest.radars.find((r) => r.id === run.manifest.outageRadarId) : null
    const list = run.manifest.radars.map((r) => `${r.name}${off?.id === r.id ? ' (offline)' : ''}`).join(', ')
    return {
      thinking: [read, 'Checking feed status'],
      text: [
        run.manifest.radars.length ? `Radars in this domain: ${list}.` : 'No DWR covers this domain.',
        off
          ? `- **${off.name} is offline.** TADIT keeps forecasting from satellite + lightning; probability contours are wider there.`
          : '- All radar feeds are receiving.',
        '- INSAT-3DS IR/WV, lightning and NWP feeds are receiving.',
      ].join('\n'),
      actions: [{ label: 'Open data feeds', kind: 'page', arg: 'feeds' }],
    }
  }

  // --- extrapolation / new cells
  if (/compare|extrapol|new cells?\b|initiat|\bforms?\b|\bforming\b/.test(text)) {
    const n = run.cells.filter((c) => c.isNew)
    return {
      thinking: [read, 'Diffing TADIT against extrapolation at +60 min'],
      text: [
        'Extrapolation only moves the current radar echoes. TADIT also grows, decays and initiates cells using satellite cooling, lightning and NWP.',
        n.length ? `- Cells that form after now: ${n.map((c) => `**${c.id}**`).join(', ')} — missing from extrapolation.` : '- No new cells are forecast in this run.',
      ].join('\n'),
      actions: [{ label: 'Open compare view', kind: 'compare' }],
    }
  }

  // --- lightning activity
  if (/lightning|flash|strike|thunder/.test(text) && !/district|where|which/.test(text)) {
    const last = run.flashes.filter((f) => f.t > -10 && f.t <= 0)
    const before = run.flashes.filter((f) => f.t > -20 && f.t <= -10)
    const cg = last.filter((f) => f.type === 'CG').length
    return {
      thinking: [read, 'Counting flashes in the last 20 min'],
      text: `**${last.length} flashes** in the last 10 min (${cg} cloud-to-ground), versus ${before.length} in the 10 min before — ${last.length > before.length * 1.3 ? 'a rising trend' : last.length < before.length * 0.7 ? 'easing' : 'roughly steady'}.`,
      actions: [],
    }
  }

  // --- district risk / next hour
  if (/district|where|which|risk|next hour|eta|when|arrive|hit/.test(text)) {
    const within = /hour|60/.test(text) ? 60 : 180
    const list = dw
      .filter((d) => d.etaMin !== null && d.etaMin <= within)
      .sort((a, b) => a.etaMin! - b.etaMin!)
    return {
      thinking: [read, `Scanning ${dw.length} districts`, `Filtering lightning ETA ≤ ${within} min`],
      text: list.length
        ? [`Districts with lightning risk in the next ${within === 60 ? 'hour' : '3 hours'}:`, ...list.map((d) => `- **${name(d.districtId)}** · ${cap(d.level)} · ${etaText(d.etaMin, run.manifest.nowClock)} · max ${pct(d.maxPLightning)}`)].join('\n')
        : `No district reaches P(lightning) ≥ 30% within the next ${within === 60 ? 'hour' : '3 hours'}.`,
      actions: [{ label: 'Open warnings', kind: 'page', arg: 'warnings' }],
    }
  }

  // --- summary
  if (/summar|situation|overview|status|brief|what.*happen|update/.test(text)) {
    return {
      thinking: [read, `Checking ${run.cells.length} tracked cells and ${cfg.districts.length} districts`, ctx.prev ? 'Comparing with the previous run' : 'No previous run to compare'],
      text: situationSummary(run, ctx.prev, cfg, Object.fromEntries(ctx.warnings.map((w) => [w.id, w]))),
      actions: [{ label: 'Open operations map', kind: 'page', arg: 'ops' }],
    }
  }

  return {
    thinking: [read],
    text: [
      "I couldn't map that to the current run. I can answer questions such as:",
      ...SUGGESTIONS.map((s) => `- ${s}`),
      `- About a district, e.g. "${name(cfg.districts[0])}"`,
    ].join('\n'),
    actions: [],
  }
}

function lvl(l: string) {
  return l === 'red' ? 3 : l === 'orange' ? 2 : l === 'yellow' ? 1 : 0
}
