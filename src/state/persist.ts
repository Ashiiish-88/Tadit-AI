// Session persistence in localStorage (per browser only). Run bundles are NOT stored: the engine is
// deterministic, so the current live run is regenerated from (world, offset) on reload.

const KEY = 'tadit-demo-v1'

export function loadSaved<T>(): Partial<T> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Partial<T>) : {}
  } catch {
    return {}
  }
}

let timer = 0
export function saveLater(data: unknown) {
  clearTimeout(timer)
  timer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* storage unavailable (private window) — the demo still works for this tab */
    }
  }, 400)
}

export function clearSaved() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
