import { useApp } from '@/state/store'
import { LogoMark } from './Logo'

export function Caption() {
  const caption = useApp((s) => s.caption)
  const step = useApp((s) => s.captionStep)
  if (!caption) return null
  return (
    <div className="pointer-events-none absolute bottom-5 left-[232px] right-16 z-20 flex justify-center">
      <div key={step} className="max-w-[980px] animate-in fade-in-0 slide-in-from-bottom-2 rounded-[10px] border bg-card/90 px-6 py-4 shadow-2xl backdrop-blur-md duration-300">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-primary">
          <span className="num">{step}</span> / 8
        </div>
        <div className="text-[22px] font-medium leading-snug text-foreground">{caption}</div>
      </div>
    </div>
  )
}

export function EndCard() {
  const show = useApp((s) => s.endCard)
  if (!show) return null
  return (
    <div
      className="fixed inset-0 top-14 z-[60] grid place-items-center bg-background animate-in fade-in-0 duration-500"
      onClick={() => useApp.setState({ endCard: false })}
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <LogoMark size={96} />
        <div className="text-5xl font-semibold tracking-[0.2em]">TADIT</div>
        <div className="max-w-[720px] text-lg text-muted-foreground">
          AI nowcasting of thunderstorms and lightning from radar, satellite, lightning and NWP — with a forecaster in the loop.
        </div>
        <div className="num text-base text-primary">SIH 2026 · PS 26072</div>
        <div className="num text-lg text-foreground">[TEAM NAME] · [TEAM ID]</div>
      </div>
    </div>
  )
}
