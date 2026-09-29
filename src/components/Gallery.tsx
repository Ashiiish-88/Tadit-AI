import { useEffect, useRef } from 'react'
import { useApp } from '@/state/store'
import { SCENARIOS } from '@/scenarios'
import { previewDbz } from '@/engine/generate'
import { dbzLut } from '@/lib/colormaps'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { ScenarioConfig } from '@/scenarios/types'
import { cn } from '@/lib/utils'

const thumbCache = new Map<string, string>()

function thumbnail(cfg: ScenarioConfig) {
  const hit = thumbCache.get(cfg.id)
  if (hit) return hit
  const n = 96
  const f = previewDbz(cfg, n)
  const c = document.createElement('canvas')
  c.width = c.height = n
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(n, n)
  for (let i = 0; i < n * n; i++) {
    const b = Math.max(0, Math.min(255, Math.round(f[i] * 3)))
    const a = dbzLut[b * 4 + 3] / 255
    img.data[i * 4] = 10 + (dbzLut[b * 4] - 10) * a
    img.data[i * 4 + 1] = 16 + (dbzLut[b * 4 + 1] - 16) * a
    img.data[i * 4 + 2] = 28 + (dbzLut[b * 4 + 2] - 28) * a
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const url = c.toDataURL()
  thumbCache.set(cfg.id, url)
  return url
}

function Thumb({ cfg }: { cfg: ScenarioConfig }) {
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (ref.current) ref.current.src = thumbnail(cfg)
    }, cfg.num * 15)
    return () => clearTimeout(id)
  }, [cfg])
  return (
    <div className="h-[112px] overflow-hidden bg-[#0A101C]">
      <img ref={ref} alt="" className="h-full w-full scale-[1.7] object-cover" />
    </div>
  )
}

export function Gallery() {
  const open = useApp((s) => s.galleryOpen)
  const current = useApp((s) => s.scenarioId)
  const groups = [
    { title: 'Frequent-storm regions', items: SCENARIOS.filter((s) => s.group === 'frequent') },
    { title: 'Uncommon regions — storms people do not expect', items: SCENARIOS.filter((s) => s.group === 'uncommon') },
  ]
  return (
    <Dialog open={open} onOpenChange={(o) => useApp.getState().setGalleryOpen(o)}>
      <DialogContent className="max-w-[1320px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Case library</DialogTitle>
          <DialogDescription>Case library. Press G to close, [ and ] to step through cases.</DialogDescription>
        </DialogHeader>
        {groups.map((g) => (
          <div key={g.title} className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">{g.title}</div>
            <div className="grid grid-cols-5 gap-3">
              {g.items.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    useApp.getState().setGalleryOpen(false)
                    void useApp.getState().loadScenario(s.id)
                  }}
                  className={cn(
                    'overflow-hidden rounded-lg border bg-background/40 text-left transition-colors duration-200 hover:border-primary/60',
                    current === s.id && 'border-primary',
                  )}
                >
                  <Thumb cfg={s} />
                  <div className="space-y-1.5 p-3">
                    <div className="flex items-center gap-2">
                      <span className="num text-[11px] text-muted-foreground">{String(s.num).padStart(2, '0')}</span>
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {s.season}
                      </Badge>
                    </div>
                    <div className="text-[13px] font-medium leading-snug">{s.title}</div>
                    <div className="text-[11px] text-muted-foreground">{s.region}</div>
                    <div className="text-[11px] leading-snug text-muted-foreground/90">{s.story}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  )
}
