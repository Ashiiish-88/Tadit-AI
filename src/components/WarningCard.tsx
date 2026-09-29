import { useState } from 'react'
import { Check, FileCode2, Pencil, Smartphone, Sparkles, X } from 'lucide-react'
import { selectWarnings, useApp, type WarningRecord } from '@/state/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DISTRICTS } from '@/data/districtHQ'
import { LEVEL_COLORS } from '@/config'
import { PHRASES, messageFor, validity, type MsgLang } from '@/lib/messages'
import { LANG_NAMES } from '@/scenarios/types'
import { SCENARIO_BY_ID } from '@/scenarios'
import { cn } from '@/lib/utils'

export const LEVEL_LABEL = { yellow: 'Yellow', orange: 'Orange', red: 'Red', green: 'Green' } as const

export const STATUS_LABEL: Record<WarningRecord['status'], string> = {
  draft: 'Draft',
  issued: 'Issued (exercise)',
  rejected: 'Rejected',
  superseded: 'Superseded',
  expired: 'Expired',
}

export function StatusBadge({ status }: { status: WarningRecord['status'] }) {
  const variant = status === 'issued' ? 'default' : status === 'draft' ? 'amber' : 'outline'
  return (
    <Badge variant={variant} className="shrink-0 text-[10px]">
      {STATUS_LABEL[status]}
    </Badge>
  )
}

export function WarningCard({ w, compact }: { w: WarningRecord; compact?: boolean }) {
  const phoneFor = useApp((s) => s.phoneFor)
  const role = useApp((s) => s.user?.role)
  const regional = SCENARIO_BY_ID[w.world]?.language ?? 'hi'
  const msg = messageFor(w.lang, regional, w.draft, w, w.nowClock)
  const { start, end } = validity(w.draft, w.nowClock)
  const upd = (p: Partial<WarningRecord>) => useApp.getState().updateWarning(w.id, p)
  const color = LEVEL_COLORS[w.draft.level]
  const isDraft = w.status === 'draft'
  const observer = role === 'observer'

  return (
    <div id={`warn-${w.id}`} className={cn('overflow-hidden rounded-lg border bg-background/30', (w.status === 'rejected' || w.status === 'superseded' || w.status === 'expired') && 'opacity-70')}>
      <div className="flex items-center gap-2 border-b px-3 py-2" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
        <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-black" style={{ background: color }}>
          {LEVEL_LABEL[w.draft.level]}
        </span>
        <span className="truncate text-xs font-medium">{w.draft.districtIds.map((id) => DISTRICTS[id].name).join(', ')}</span>
        <span className="ml-auto" />
        {!compact && <span className="num text-[10px] text-muted-foreground">{w.id}</span>}
        {w.status !== 'draft' && <StatusBadge status={w.status} />}
      </div>
      <div className="space-y-3 p-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" /> Drafted by TADIT AI · run of {w.createdClock} IST
        </div>
        <div className="flex items-center justify-between gap-2">
          <ToggleGroup type="single" value={w.lang} onValueChange={(v) => v && upd({ lang: v as MsgLang })}>
            <ToggleGroupItem value="en">EN</ToggleGroupItem>
            <ToggleGroupItem value="hi">हिंदी</ToggleGroupItem>
            {regional !== 'hi' && <ToggleGroupItem value="regional">{LANG_NAMES[regional]}</ToggleGroupItem>}
          </ToggleGroup>
          <span className="num text-[11px] text-muted-foreground">
            Valid {start}–{end} IST
          </span>
        </div>
        {msg.pending && (
          <Badge variant="amber" className="text-[10px]">
            {LANG_NAMES[regional]} translation pending native-speaker review{'fallback' in msg ? ' · showing English' : ''}
          </Badge>
        )}
        <p className={cn('text-[13px] leading-relaxed', w.lang === 'hi' && 'text-[14px]')}>{msg.text}</p>

        {isDraft && (
          <div className="space-y-1.5">
            <Label htmlFor={`gust-${w.id}`} className="flex items-center justify-between">
              <span>
                Gust speed (forecaster) <span className="text-imd-red">*</span>
              </span>
              <span className="font-normal">TADIT does not forecast wind</span>
            </Label>
            <div className="relative">
              <Input
                id={`gust-${w.id}`}
                value={w.gust}
                placeholder="e.g. 40–50"
                disabled={observer}
                onChange={(e) => upd({ gust: e.target.value })}
                className="num pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km/h</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {isDraft && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" onClick={() => useApp.getState().approveWarning(w.id)} disabled={!w.gust.trim() || observer}>
                      <Check /> Approve
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{observer ? 'Observers cannot approve' : w.gust.trim() ? 'Generates a CAP 1.2 alert (Exercise)' : 'Enter the forecaster gust speed first'}</TooltipContent>
              </Tooltip>
              <Button size="sm" variant="outline" disabled={observer} onClick={() => useApp.getState().setEditFor(w.id)}>
                <Pencil /> Edit
              </Button>
              <Button size="sm" variant="ghost" disabled={observer} onClick={() => useApp.getState().rejectWarning(w.id)}>
                <X /> Reject
              </Button>
            </>
          )}
          <div className="ml-auto flex gap-1">
            <Button size="xs" variant="ghost" onClick={() => useApp.getState().setCapOpen(w.id)}>
              <FileCode2 /> View CAP
            </Button>
            <Button size="xs" variant={phoneFor === w.id ? 'secondary' : 'ghost'} onClick={() => useApp.getState().setPhoneFor(phoneFor === w.id ? null : w.id)}>
              <Smartphone /> Phone
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EditDialog() {
  const id = useApp((s) => s.editFor)
  const rec = useApp((s) => (id ? selectWarnings(s)[id] : null))
  const [draft, setDraft] = useState<WarningRecord | null>(null)
  const cur = draft ?? rec
  if (!rec || !cur) return null
  const close = () => {
    useApp.getState().setEditFor(null)
    setDraft(null)
  }
  const phraseIdx = Math.max(0, PHRASES.findIndex((p) => p.en === cur.phrase))
  const changes = () => {
    const c: string[] = []
    if (cur.intensity !== rec.intensity) c.push(`intensity ${rec.intensity} → ${cur.intensity}`)
    if (cur.phrase !== rec.phrase) c.push(`extent “${cur.phrase}”`)
    if (cur.gust !== rec.gust) c.push(`gust ${cur.gust} km/h`)
    if (cur.hailNote !== rec.hailNote) c.push('hail/other note')
    return c.length ? `Edited: ${c.join(', ')}` : undefined
  }
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit nowcast draft · {rec.id}</DialogTitle>
          <DialogDescription>Changes are the forecaster’s and go into the audit trail. The model never fills wind or hail.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Intensity</Label>
              <Select value={cur.intensity} onValueChange={(v) => setDraft({ ...cur, intensity: v as WarningRecord['intensity'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['Light', 'Moderate', 'Severe'] as const).map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Spatial phrase</Label>
              <Select value={String(phraseIdx)} onValueChange={(v) => setDraft({ ...cur, phrase: PHRASES[+v].en, phraseHi: PHRASES[+v].hi })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHRASES.map((p, i) => (
                    <SelectItem key={p.en} value={String(i)}>
                      {p.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-gust">
              Gust speed (forecaster), km/h <span className="text-imd-red">*</span>
            </Label>
            <Input id="edit-gust" className="num" placeholder="e.g. 40–50" value={cur.gust} onChange={(e) => setDraft({ ...cur, gust: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-hail">Hail / other note (optional)</Label>
            <Textarea id="edit-hail" value={cur.hailNote} placeholder="e.g. Hail possible with the severe core." onChange={(e) => setDraft({ ...cur, hailNote: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!cur.gust.trim()}
            onClick={() => {
              useApp.getState().updateWarning(rec.id, { intensity: cur.intensity, phrase: cur.phrase, phraseHi: cur.phraseHi, gust: cur.gust, hailNote: cur.hailNote }, changes())
              close()
            }}
          >
            Save draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
