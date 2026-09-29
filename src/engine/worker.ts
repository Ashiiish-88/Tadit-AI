/// <reference lib="webworker" />
import { generateRun } from './generate'
import { SCENARIO_BY_ID } from '@/scenarios'
import type { RunBundle, RunRequest } from '@/types/run'

type Msg = { id: number; req: RunRequest }

self.onmessage = (ev: MessageEvent<Msg>) => {
  const { id, req } = ev.data
  try {
    const cfg = SCENARIO_BY_ID[req.scenarioId]
    if (!cfg) throw new Error(`Unknown scenario ${req.scenarioId}`)
    const run = generateRun(cfg, req.geometry, { nowOffset: req.nowOffset, rules: req.rules })
    ;(self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, run }, transferables(run))
  } catch (err) {
    ;(self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, error: String(err) })
  }
}

function transferables(run: RunBundle): Transferable[] {
  const out = new Set<ArrayBuffer>()
  const add = (a: ArrayBufferView) => out.add(a.buffer as ArrayBuffer)
  run.radar.data.forEach(add)
  run.satIR.data.forEach(add)
  run.cape.data.forEach(add)
  for (const v of [run.normal, run.outage]) {
    if (!v) continue
    v.p45.data.forEach(add)
    v.p54.data.forEach(add)
    v.pLightning.data.forEach(add)
    add(v.coverage)
  }
  Object.values(run.districtMasks).forEach(add)
  return [...out]
}
