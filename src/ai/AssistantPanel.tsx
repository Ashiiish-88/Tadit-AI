import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, Loader2, Sparkles, X } from 'lucide-react'
import { selectWarnings, simClock, useApp } from '@/state/store'
import { runCache } from '@/state/runCache'
import type { ChatMessage, Page } from '@/state/types'
import { answer, SUGGESTIONS, type AiAction } from './assistant'
import { Md } from './Md'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const streamed = new Set<string>()
const uid = () => Math.random().toString(36).slice(2, 10)

export function ask(q: string) {
  const s = useApp.getState()
  const run = s.run
  if (!run || !q.trim()) return
  const reply = answer(q, {
    run,
    prev: s.mode === 'live' ? runCache.get(s.prevRunId) : null,
    cfg: s.scenario,
    warnings: Object.values(selectWarnings(s)),
    outage: s.outage,
  })
  const at = simClock(s)
  const user: ChatMessage = { id: uid(), role: 'user', text: q.trim(), at }
  const bot: ChatMessage = { id: uid(), role: 'assistant', text: reply.text, thinking: reply.thinking, actions: reply.actions, at }
  useApp.setState((st) => ({ chat: [...st.chat, user, bot].slice(-40), assistantOpen: true }))
}

export function runAction(a: AiAction) {
  const s = useApp.getState()
  if (a.kind === 'page') {
    const page = a.arg === 'verification' ? 'ops' : (a.arg as Page)
    s.setPage(page)
    if (a.arg === 'verification') useApp.getState().setTab('verification')
  } else if (a.kind === 'cell') {
    if (s.page !== 'ops' && s.page !== 'replay') s.setPage('ops')
    useApp.getState().setT(0)
    useApp.getState().setTab('cells')
    useApp.getState().selectCell(a.arg ?? null)
  } else if (a.kind === 'warning') {
    if (s.mode === 'replay') {
      s.setTab('warnings')
    } else {
      s.setPage('warnings')
      useApp.setState({ focusWarningId: a.arg ?? null })
    }
  } else if (a.kind === 'compare') {
    if (s.page !== 'ops' && s.page !== 'replay') s.setPage('ops')
    useApp.getState().setTab('compare')
  }
}

function Reply({ m, last }: { m: ChatMessage; last: boolean }) {
  // decided once per mount so a re-render can't stop the animation half-way
  const [animate] = useState(() => last && !streamed.has(m.id))
  const [steps, setSteps] = useState(animate ? 0 : (m.thinking?.length ?? 0))
  const [chars, setChars] = useState(animate ? 0 : m.text.length)
  useEffect(() => {
    if (!animate) return
    streamed.add(m.id)
    let cancelled = false
    const n = m.thinking?.length ?? 0
    let i = 0
    const stepT = window.setInterval(() => {
      i++
      if (!cancelled) setSteps(i)
      if (i >= n) {
        clearInterval(stepT)
        let c = 0
        typeT = window.setInterval(() => {
          c += 4
          if (!cancelled) setChars(c)
          if (c >= m.text.length) clearInterval(typeT)
        }, 16)
      }
    }, 420)
    let typeT = 0
    return () => {
      cancelled = true
      clearInterval(stepT)
      clearInterval(typeT)
    }
  }, [animate, m])
  const n = m.thinking?.length ?? 0
  const thinkingDone = steps >= n
  return (
    <div className="space-y-2">
      {n > 0 && (
        <div className="space-y-1 rounded-md border border-dashed px-2.5 py-2">
          {m.thinking!.slice(0, Math.max(steps, thinkingDone ? n : steps + 1)).map((t, i) => (
            <div key={t} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {i < steps ? <Check className="h-3 w-3 text-primary" /> : <Loader2 className="h-3 w-3 animate-spin" />}
              {t}
            </div>
          ))}
        </div>
      )}
      {thinkingDone && <Md text={m.text.slice(0, chars)} className="text-[13px] leading-relaxed text-muted-foreground" />}
      {thinkingDone && chars >= m.text.length && m.actions && m.actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {m.actions.map((a) => (
            <Button key={a.label} size="xs" variant="outline" onClick={() => runAction(a)}>
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AssistantPanel() {
  const open = useApp((s) => s.assistantOpen)
  const chat = useApp((s) => s.chat)
  const hasRun = useApp((s) => !!s.run)
  const [q, setQ] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  })
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])
  if (!open) return null
  const lastBot = [...chat].reverse().find((m) => m.role === 'assistant')?.id

  return (
    <aside className="fixed bottom-0 right-0 top-14 z-40 flex w-[440px] flex-col border-l bg-card shadow-2xl animate-in slide-in-from-right-8 fade-in-0 duration-300">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Ask TADIT</div>
          <div className="text-[11px] text-muted-foreground">AI assistant · grounded in the latest nowcast run</div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => useApp.getState().setAssistantOpen(false)} aria-label="Close assistant">
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {chat.length === 0 && (
          <div className="space-y-3">
            <div className="text-[13px] text-muted-foreground">
              Ask about storms, districts, warnings or feeds. I read the latest nowcast run and answer from its data.
            </div>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  disabled={!hasRun}
                  onClick={() => ask(s)}
                  className="rounded-md border bg-background/40 px-3 py-2 text-left text-[13px] transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-lg rounded-br-sm bg-primary/15 px-3 py-2 text-[13px] text-foreground">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <Reply m={m} last={m.id === lastBot} />
              </div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      {chat.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto border-t px-4 py-2">
          {SUGGESTIONS.slice(0, 4).map((s) => (
            <button key={s} onClick={() => ask(s)} className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault()
          ask(q)
          setQ('')
        }}
      >
        <Input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={hasRun ? 'Ask about this nowcast…' : 'Waiting for the first run…'} disabled={!hasRun} />
        <Button type="submit" size="icon" disabled={!q.trim() || !hasRun} aria-label="Send">
          <ArrowUp />
        </Button>
      </form>
      <div className={cn('px-4 pb-3 text-[10px] text-muted-foreground')}>
        Answers are generated from the latest run. Check critical decisions against the map.
      </div>
    </aside>
  )
}
