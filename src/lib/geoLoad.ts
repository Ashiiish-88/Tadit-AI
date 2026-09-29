// Loads Survey of India–compliant boundaries supplied by the team. Nothing else is ever used.
// Missing files → null → the map draws no boundary and falls back to HQ markers.

export type Ring = [number, number][]

async function fetchGeo(url: string): Promise<Ring[] | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? ''
    if (type.includes('text/html')) return null // dev-server SPA fallback
    const json = await res.json()
    return extractRings(json)
  } catch {
    return null
  }
}

function extractRings(g: unknown): Ring[] | null {
  const rings: Ring[] = []
  const visit = (geom: { type?: string; coordinates?: unknown; geometries?: unknown[] } | null | undefined) => {
    if (!geom) return
    if (geom.type === 'Polygon') (geom.coordinates as Ring[]).slice(0, 1).forEach((r) => rings.push(r))
    else if (geom.type === 'MultiPolygon') (geom.coordinates as Ring[][]).forEach((p) => p.slice(0, 1).forEach((r) => rings.push(r)))
    else if (geom.type === 'GeometryCollection') (geom.geometries as typeof geom[]).forEach(visit)
  }
  const obj = g as { type?: string; features?: { geometry: unknown }[]; geometry?: unknown }
  if (obj?.type === 'FeatureCollection') obj.features?.forEach((f) => visit(f.geometry as never))
  else if (obj?.type === 'Feature') visit(obj.geometry as never)
  else visit(obj as never)
  return rings.length ? rings : null
}

const cache = new Map<string, Promise<Ring[] | null>>()
function cached(url: string) {
  if (!cache.has(url)) cache.set(url, fetchGeo(url))
  return cache.get(url)!
}

export function loadIndiaOutline() {
  return cached('/geo/india_outline.geojson')
}

export async function loadDistricts(ids: string[]): Promise<Record<string, Ring[] | null>> {
  const entries = await Promise.all(ids.map(async (id) => [id, await cached(`/geo/districts/${id}.geojson`)] as const))
  return Object.fromEntries(entries)
}
