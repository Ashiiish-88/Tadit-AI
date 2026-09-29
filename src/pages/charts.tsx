import { useMemo, useState } from 'react'
import type { RunBundle } from '@/types/run'
import { clockAdd } from '@/lib/time'

/** Flashes per 10 min over the last hour (observed, simulated). Single series → title names it, no legend. */
export function FlashBars({ run }: { run: RunBundle }) {
  const bins = useMemo(() => {
    const out: { from: number; n: number; cg: number }[] = []
    for (let t = -60; t < 0; t += 10) {
      const fl = run.flashes.filter((f) => f.t > t && f.t <= t + 10)
      out.push({ from: t, n: fl.length, cg: fl.filter((f) => f.type === 'CG').length })
    }
    return out
  }, [run])
  const [hover, setHover] = useState<number | null>(null)
  const W = 360
  const H = 120
  const max = Math.max(10, ...bins.map((b) => b.n))
  const nice = Math.ceil(max / 50) * 50 || 10
  const bw = W / bins.length
  const clock = run.manifest.nowClock
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full overflow-visible">
        {[0.5, 1].map((g) => (
          <g key={g}>
            <line x1={0} x2={W} y1={H - H * g} y2={H - H * g} stroke="#1C2638" strokeDasharray="2 3" />
            <text x={W} y={H - H * g - 3} textAnchor="end" fontSize={9} fill="#8A9BB5" className="num">
              {Math.round(nice * g)}
            </text>
          </g>
        ))}
        <line x1={0} x2={W} y1={H} y2={H} stroke="#2A3650" />
        {bins.map((b, i) => {
          const h = (b.n / nice) * H
          const x = i * bw + 2
          const w = bw - 4
          const r = Math.min(4, h / 2, w / 2)
          return (
            <g key={b.from} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${H} L${x},${H - h + r} Q${x},${H - h} ${x + r},${H - h} L${x + w - r},${H - h} Q${x + w},${H - h} ${x + w},${H - h + r} L${x + w},${H} Z`}
                  fill="#FFC53D"
                  opacity={hover === null || hover === i ? 0.9 : 0.45}
                />
              )}
              <text x={i * bw + bw / 2} y={H + 13} textAnchor="middle" fontSize={9} fill="#8A9BB5" className="num">
                {clockAdd(clock, b.from)}
              </text>
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-2 rounded-md border bg-popover px-2.5 py-1.5 text-[11px] shadow-md"
          style={{ left: `${((hover + 0.5) / bins.length) * 100}%`, transform: 'translate(-50%, -100%)' }}
        >
          <div className="num font-medium text-foreground">
            {clockAdd(clock, bins[hover].from)}–{clockAdd(clock, bins[hover].from + 10)} IST
          </div>
          <div className="text-muted-foreground">
            {bins[hover].n} flashes · {bins[hover].cg} cloud-to-ground
          </div>
        </div>
      )}
    </div>
  )
}

/** Forecast area (km²) with P(lightning) ≥ 50 %, per lead time. */
export function LightningAreaLine({ run, outage }: { run: RunBundle; outage: boolean }) {
  const pts = useMemo(() => {
    const v = outage && run.outage ? run.outage : run.normal
    const thr = Math.round(0.5 * 255)
    return v.pLightning.data.map((d, i) => {
      let n = 0
      for (let k = 0; k < d.length; k++) if (d[k] >= thr) n++
      return { lead: v.pLightning.times[i], km2: n * 9 }
    })
  }, [run, outage])
  const [hover, setHover] = useState<number | null>(null)
  const W = 360
  const H = 110
  const max = Math.max(1000, ...pts.map((p) => p.km2))
  const nice = Math.ceil(max / 5000) * 5000
  const x = (i: number) => (i / (pts.length - 1)) * W
  const y = (v: number) => H - (v / nice) * H
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.km2).toFixed(1)}`).join('')
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H + 18}`}
        className="w-full overflow-visible"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          setHover(Math.max(0, Math.min(pts.length - 1, Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1)))))
        }}
        onMouseLeave={() => setHover(null)}
      >
        {[0.5, 1].map((g) => (
          <g key={g}>
            <line x1={0} x2={W} y1={H - H * g} y2={H - H * g} stroke="#1C2638" strokeDasharray="2 3" />
            <text x={W} y={H - H * g - 3} textAnchor="end" fontSize={9} fill="#8A9BB5" className="num">
              {(nice * g).toLocaleString('en-IN')}
            </text>
          </g>
        ))}
        <line x1={0} x2={W} y1={H} y2={H} stroke="#2A3650" />
        <path d={`${d} L${W},${H} L0,${H} Z`} fill="#38D0F0" opacity={0.1} />
        <path d={d} fill="none" stroke="#38D0F0" strokeWidth={2} strokeLinejoin="round" />
        {[0, 6, 12, 18].map((i) => (
          <text key={i} x={x(i)} y={H + 13} textAnchor={i === 0 ? 'start' : i === 18 ? 'end' : 'middle'} fontSize={9} fill="#8A9BB5" className="num">
            {pts[i]?.lead === 0 ? 'now' : `+${pts[i]?.lead}`}
          </text>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="#8A9BB5" strokeOpacity={0.5} />
            <circle cx={x(hover)} cy={y(pts[hover].km2)} r={4} fill="#38D0F0" stroke="#0C1320" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-2 rounded-md border bg-popover px-2.5 py-1.5 text-[11px] shadow-md"
          style={{ left: `${(hover / (pts.length - 1)) * 100}%`, transform: `translate(${hover > 12 ? '-100%' : '0'}, -100%)` }}
        >
          <div className="num font-medium text-foreground">
            {pts[hover].lead === 0 ? 'now' : `+${pts[hover].lead} min`} · {clockAdd(run.manifest.nowClock, pts[hover].lead)} IST
          </div>
          <div className="text-muted-foreground">{pts[hover].km2.toLocaleString('en-IN')} km² with P(lightning) ≥ 50 %</div>
        </div>
      )}
    </div>
  )
}
