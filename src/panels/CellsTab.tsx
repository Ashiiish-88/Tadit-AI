import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { frameIndex, useApp } from '@/state/store'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DISTRICTS } from '@/data/districtHQ'
import { bearing, compass } from '@/lib/geo'
import { TIME } from '@/config'
import { cn } from '@/lib/utils'
import type { CellTrack } from '@/types/run'

type SortKey = 'id' | 'p' | 'dbz' | 'speed'

function Sparkline({ cell, k }: { cell: CellTrack; k: number }) {
  const w = 64
  const h = 22
  const pts = cell.frames.slice(0, k + 1).map((f, i) => [(i / (TIME.frameCount - 1)) * w, h - (Math.max(15, Math.min(70, f.maxDbz)) - 15) / (55 / h)] as const)
  const obs = pts.slice(0, TIME.nowIndex + 1)
  const fc = pts.slice(TIME.nowIndex)
  const path = (p: readonly (readonly [number, number])[]) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  const y45 = h - (45 - 15) / (55 / h)
  return (
    <svg width={w} height={h} className="overflow-visible">
      <line x1={0} x2={w} y1={y45} y2={y45} stroke="#1C2638" strokeDasharray="2 2" />
      {obs.length > 1 && <path d={path(obs)} fill="none" stroke="#E6EDF7" strokeWidth={1.3} />}
      {k > TIME.nowIndex && fc.length > 1 && <path d={path(fc)} fill="none" stroke="#38D0F0" strokeWidth={1.3} strokeDasharray="3 2" />}
    </svg>
  )
}

export function CellsTab() {
  const run = useApp((s) => s.run)
  const k = useApp((s) => frameIndex(s.t))
  const selected = useApp((s) => s.selectedCellId)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'p', dir: -1 })

  const rows = useMemo(() => {
    if (!run) return []
    const list = run.cells
      .map((c) => ({ c, f: c.frames[k], speed: Math.hypot(c.u, c.v) * 60 }))
      .filter((r) => r.f.maxDbz >= 35)
    const val = (r: (typeof list)[number]) =>
      sort.key === 'id' ? r.c.id : sort.key === 'p' ? r.f.pL30 : sort.key === 'dbz' ? r.f.maxDbz : r.speed
    return list.sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir
    })
  }, [run, k, sort])

  const sel = run?.cells.find((c) => c.id === selected)

  const Head = ({ id, label, className }: { id: SortKey; label: string; className?: string }) => (
    <button
      className={cn('flex items-center gap-1 text-left hover:text-foreground', sort.key === id && 'text-foreground', className)}
      onClick={() => setSort((s) => ({ key: id, dir: s.key === id ? ((-s.dir) as 1 | -1) : -1 }))}
    >
      {label}
      {sort.key === id ? sort.dir === -1 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3 opacity-50" />}
    </button>
  )

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-lg border">
        <div className="grid grid-cols-[52px_78px_54px_72px_1fr] items-center gap-2 border-b px-3 py-2 text-[11px] text-muted-foreground">
          <Head id="id" label="Cell" />
          <Head id="p" label="P(ltg 30′)" />
          <span>Onset</span>
          <Head id="dbz" label="Max dBZ" />
          <Head id="speed" label="Motion" />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {rows.length === 0 && <div className="px-3 py-6 text-center text-xs text-muted-foreground">No cells ≥ 35 dBZ at this time step.</div>}
          {rows.map(({ c, f, speed }) => (
            <button
              key={c.id}
              onClick={() => useApp.getState().selectCell(c.id)}
              className={cn(
                'grid w-full grid-cols-[52px_78px_54px_72px_1fr] items-center gap-2 border-b border-border/50 px-3 py-2 text-left text-xs transition-colors last:border-0 hover:bg-accent/60',
                selected === c.id && 'bg-primary/10',
              )}
            >
              <span className="num font-semibold">{c.id}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="num flex items-center gap-1.5">
                    <span className="h-1.5 w-8 overflow-hidden rounded-full bg-border">
                      <span className="block h-full bg-primary" style={{ width: `${f.pL30 * 100}%` }} />
                    </span>
                    {(f.pL30 * 100).toFixed(0)}%
                  </span>
                </TooltipTrigger>
                <TooltipContent>P(lightning within 30 min)</TooltipContent>
              </Tooltip>
              <span>
                {f.onset ? (
                  <Badge variant="amber" className="px-1.5 py-0 text-[10px]">
                    Yes
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">{c.firstFlashT !== null && c.firstFlashT <= f.t ? 'Active' : 'No'}</span>
                )}
              </span>
              <span className="flex items-center gap-1" title="Max dBZ per 10 min · white observed, cyan forecast">
                <Sparkline cell={c} k={k} />
              </span>
              <span className="num text-muted-foreground" title="Cell motion">
                {speed.toFixed(0)} km/h {compass(bearing(c.u, c.v))}
              </span>
            </button>
          ))}
        </div>
      </div>

      {sel ? (
        <CellDetail cell={sel} k={k} />
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
          Select a cell in the list or on the map to see its districts, arrival times and why TADIT flags it.
        </div>
      )}
    </div>
  )
}

function CellDetail({ cell, k }: { cell: CellTrack; k: number }) {
  const f = cell.frames[k]
  const max = Math.max(1, ...f.explain.map((a) => Math.abs(a.value)))
  return (
    <div className="space-y-3 rounded-lg border bg-background/30 p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          Cell <span className="num">{cell.id}</span>
          {cell.isNew && (
            <Badge variant="default" className="ml-2 text-[10px]">
              Forms after now
            </Badge>
          )}
        </div>
        <div className="num text-xs text-muted-foreground">
          {f.maxDbz.toFixed(0)} dBZ · {(f.pL30 * 100).toFixed(0)}% ltg/30′
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Districts in its path</div>
        {f.path.length === 0 ? (
          <div className="text-xs text-muted-foreground">None of the scenario districts in the next {TIME.endMin - Math.max(0, f.t)} min.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {f.path.map((p) => (
              <Badge key={p.districtId} variant="secondary" className="font-normal">
                {DISTRICTS[p.districtId].name}
                <span className="num text-muted-foreground">{p.etaMin === 0 ? 'now' : `+${p.etaMin} min`}</span>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Why TADIT flags this cell</div>
        <div className="space-y-2">
          {f.explain.map((a) => (
            <div key={a.label} className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs">
                {a.value >= 0 ? <ArrowUp className="h-3.5 w-3.5 text-primary" /> : <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className={a.value >= 0 ? 'text-foreground' : 'text-muted-foreground'}>{a.label}</span>
              </div>
              <div className="ml-5 h-1.5 rounded-full bg-border">
                <div
                  className={cn('h-full rounded-full transition-[width] duration-300 ease-out', a.value >= 0 ? 'bg-primary' : 'bg-muted-foreground/60')}
                  style={{ width: `${(Math.abs(a.value) / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2.5 text-[10px] text-muted-foreground">
          Explanation (SHAP). <ArrowUp className="inline h-3 w-3" /> raises lightning risk,{' '}
          <ArrowDown className="inline h-3 w-3" /> lowers it.
        </div>
      </div>
    </div>
  )
}
