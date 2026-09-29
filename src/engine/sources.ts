import type { RunBundle, RunRequest, RunSource } from '@/types/run'

/** Procedural scenario engine running in a Web Worker. */
export class ProceduralRunSource implements RunSource {
  readonly kind = 'procedural' as const
  private worker: Worker
  private seq = 0
  private pending = new Map<number, { resolve: (r: RunBundle) => void; reject: (e: Error) => void }>()

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (ev: MessageEvent<{ id: number; run?: RunBundle; error?: string }>) => {
      const p = this.pending.get(ev.data.id)
      if (!p) return
      this.pending.delete(ev.data.id)
      if (ev.data.run) p.resolve(ev.data.run)
      else p.reject(new Error(ev.data.error ?? 'worker error'))
    }
  }

  load(req: RunRequest): Promise<RunBundle> {
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, req })
    })
  }
}

/**
 * Placeholder for real model output: reads runs/<runId>/manifest.json, layers/*.u8, cells.json,
 * flashes.json and warnings.json. Not used in the demo build; kept so the UI contract is explicit.
 */
export class FolderRunSource implements RunSource {
  readonly kind = 'model' as const
  constructor(private baseUrl: string) {}

  async load(req: RunRequest): Promise<RunBundle> {
    const res = await fetch(`${this.baseUrl}/${req.scenarioId}/bundle.json`)
    if (!res.ok) throw new Error(`No model run for ${req.scenarioId}`)
    throw new Error('FolderRunSource: binary layer decoding not implemented in the prototype')
  }
}
