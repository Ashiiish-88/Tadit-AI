import type { MsgLang, WarningEdits } from '@/lib/messages'
import type { RulesConfig, WarningDraft } from '@/types/run'

export type Page = 'dashboard' | 'ops' | 'warnings' | 'runs' | 'feeds' | 'replay' | 'settings'
export type Role = 'forecaster' | 'supervisor' | 'observer'

export interface User {
  name: string
  role: Role
  desk: string
}

export interface AuditEntry {
  at: string // IST clock
  who: string
  what: string
}

export type WarningStatus = 'draft' | 'issued' | 'rejected' | 'superseded' | 'expired'

/** A warning as it lives in the inbox: the AI draft plus everything the forecaster did to it. */
export interface WarningRecord extends WarningEdits {
  id: string
  draft: WarningDraft
  world: string
  runId: string
  dateIso: string
  nowClock: string
  createdClock: string
  status: WarningStatus
  lang: MsgLang
  audit: AuditEntry[]
}

export interface OutboxEntry {
  id: string
  warningId: string
  channel: 'CAP feed' | 'SMS' | 'Cell broadcast'
  at: string
  summary: string
}

export interface ActivityEntry {
  id: string
  at: string
  kind: 'cycle' | 'warning' | 'feed' | 'user' | 'ai' | 'system'
  text: string
}

export type StageId = 'ingest' | 'mosaic' | 'models' | 'calibrate' | 'warnings'

export interface RunSummary {
  runId: string
  cycle: number
  world: string
  clock: string
  dateIso: string
  status: 'running' | 'published' | 'superseded' | 'failed'
  cells: number
  maxPLightning: number
  drafts: number
  /** simulated stage durations, seconds */
  stages: Record<StageId, number>
  engineMs: number
}

export interface FeedSample {
  cycle: number
  latency: Record<'dwr' | 'sat' | 'lightning' | 'nwp', number>
  files: Record<'dwr' | 'sat' | 'lightning' | 'nwp', number>
}

export interface LiveState {
  world: string
  offset: number
  cycle: number
  paused: boolean
  nextCycleAt: number
  cycleStartedAt: number
  stage: StageId | null
  stageProgress: number
  running: boolean
}

export interface Settings {
  cadenceSec: number
  worldMode: 'auto' | string
  defaultLang: MsgLang
  rules: RulesConfig
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  thinking?: string[]
  actions?: { label: string; kind: 'cell' | 'warning' | 'page' | 'compare'; arg?: string }[]
  at: string
}
