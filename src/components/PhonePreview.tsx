import { X } from 'lucide-react'
import { selectWarnings, useApp } from '@/state/store'
import type { WarningRecord } from '@/state/types'
import { SCENARIO_BY_ID } from '@/scenarios'
import { smsText } from '@/lib/messages'
import { LANG_NAMES } from '@/scenarios/types'
import { clockAdd } from '@/lib/time'

/** Phone mock-up showing the public SMS / cell-broadcast text for a warning. */
export function PhoneMock({ w }: { w: WarningRecord }) {
  const scenario = SCENARIO_BY_ID[w.world]
  const text = smsText(w.lang, scenario.language, w.draft, w, w.nowClock)
  const pending = w.lang === 'regional' && scenario.language !== 'hi'
  return (
    <div className="w-[260px] rounded-[34px] border border-[#2A3650] bg-[#05080F] p-2.5 shadow-2xl">
      <div className="overflow-hidden rounded-[26px] bg-[#0B111D]">
        <div className="num flex items-center justify-between px-5 pb-1 pt-2.5 text-[10px] text-muted-foreground">
          <span>{clockAdd(w.nowClock, 1)}</span>
          <span className="mx-auto h-4 w-16 rounded-full bg-black" />
          <span>4G</span>
        </div>
        <div className="px-3 pb-5 pt-3">
          <div className="mb-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">Cell broadcast · preview</div>
          <div className="rounded-2xl border border-[#FFC53D]/30 bg-[#161B27] p-3">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#FFC53D]">
              <span>Weather alert · exercise</span>
              <span className="num normal-case text-muted-foreground">{w.lang === 'regional' ? LANG_NAMES[scenario.language] : w.lang === 'hi' ? 'हिंदी' : 'EN'}</span>
            </div>
            <p className="text-[12px] leading-snug text-foreground">{text}</p>
          </div>
          {pending && <div className="mt-2 text-center text-[10px] text-[#F3D58A]">Translation pending native-speaker review</div>}
          <div className="mt-2 text-center text-[10px] text-muted-foreground">Preview</div>
        </div>
      </div>
    </div>
  )
}

/** Floating phone preview over the map (toggled from a warning card). */
export function PhonePreview() {
  const id = useApp((s) => s.phoneFor)
  const w = useApp((s) => (id ? selectWarnings(s)[id] : null))
  if (!w) return null
  return (
    <div className="absolute right-6 top-16 z-20 animate-in fade-in-0 slide-in-from-right-4 duration-300">
      <div className="relative">
        <button
          className="absolute -right-2 -top-2 z-10 rounded-full border bg-card p-1 text-muted-foreground hover:text-foreground"
          onClick={() => useApp.getState().setPhoneFor(null)}
          aria-label="Close phone preview"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <PhoneMock w={w} />
      </div>
    </div>
  )
}
