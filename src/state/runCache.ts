import type { RunBundle } from '@/types/run'

/** Run bundles are large (~10 MB each), so only a few are kept in memory. */
const cache = new Map<string, RunBundle>()
const MAX = 5

export const runCache = {
  get: (id: string | null | undefined) => (id ? cache.get(id) ?? null : null),
  has: (id: string) => cache.has(id),
  put(key: string, run: RunBundle) {
    cache.delete(key)
    cache.set(key, run)
    while (cache.size > MAX) cache.delete(cache.keys().next().value as string)
  },
}
