import { useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_RULES, useApp } from '@/state/store'
import type { RulesConfig } from '@/types/run'
import { SCENARIOS } from '@/scenarios'
import { rerunCurrent } from '@/live/liveEngine'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MsgLang } from '@/lib/messages'

const RULE_FIELDS: { key: keyof RulesConfig; label: string; hint: string }[] = [
  { key: 'yellowPLightning', label: 'Yellow · P(lightning) ≥', hint: 'or P(≥45 dBZ) below' },
  { key: 'yellowP45', label: 'Yellow · P(≥45 dBZ) ≥', hint: '' },
  { key: 'orangeP45', label: 'Orange · P(≥45 dBZ) ≥', hint: 'or P(≥54 dBZ) below' },
  { key: 'orangeP54', label: 'Orange · P(≥54 dBZ) ≥', hint: '' },
  { key: 'redP54', label: 'Red · P(≥54 dBZ) ≥', hint: '' },
]

const CADENCES = [
  { v: 20, label: 'Every 20 s (accelerated)' },
  { v: 60, label: 'Every 60 s (default)' },
  { v: 180, label: 'Every 3 min' },
  { v: 600, label: 'Every 10 min (real time)' },
]

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[280px_1fr]">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-[12px] text-muted-foreground">{desc}</div>
      </div>
      <div>{children}</div>
    </Card>
  )
}

export function SettingsPage() {
  const settings = useApp((s) => s.settings)
  const user = useApp((s) => s.user)
  const [rules, setRules] = useState<RulesConfig>(settings.rules)
  const [confirm, setConfirm] = useState(false)
  const observer = user?.role === 'observer'
  const dirty = JSON.stringify(rules) !== JSON.stringify(settings.rules)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1100px] space-y-4 p-5">
        <Section title="Live cycle" desc="How often the system ingests data and publishes a new nowcast.">
          <div className="grid max-w-md gap-4">
            <div className="space-y-1.5">
              <Label>Cycle cadence</Label>
              <Select
                value={String(settings.cadenceSec)}
                onValueChange={(v) => {
                  useApp.getState().updateSettings({ cadenceSec: Number(v) })
                  useApp.setState((s) => ({ live: { ...s.live, nextCycleAt: Math.min(s.live.nextCycleAt, Date.now() + Number(v) * 1000) } }))
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CADENCES.map((c) => (
                    <SelectItem key={c.v} value={String(c.v)}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Active region</Label>
              <Select value={settings.worldMode} onValueChange={(v) => useApp.getState().updateSettings({ worldMode: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[50vh]">
                  <SelectItem value="auto">Rotate through all regions</SelectItem>
                  {SCENARIOS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground">A fixed region takes effect at the next cycle.</div>
            </div>
          </div>
        </Section>

        <Section title="Warning thresholds" desc="District colour rules applied to the 3-hour maxima. Changing them re-runs the current cycle and re-drafts warnings.">
          <div className="grid max-w-xl grid-cols-2 gap-4">
            {RULE_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  type="number"
                  min={0.05}
                  max={0.95}
                  step={0.05}
                  disabled={observer}
                  className="num"
                  value={rules[f.key]}
                  onChange={(e) => setRules({ ...rules, [f.key]: Math.max(0.05, Math.min(0.95, Number(e.target.value) || 0)) })}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              disabled={!dirty || observer}
              onClick={() => {
                useApp.getState().updateSettings({ rules })
                useApp.getState().addActivity('user', `${user?.name ?? 'Forecaster'} changed warning thresholds`)
                rerunCurrent()
                toast('Thresholds applied', { description: 'Re-running the current cycle with the new rules.' })
              }}
            >
              Apply and re-run cycle
            </Button>
            <Button variant="ghost" disabled={observer} onClick={() => setRules(DEFAULT_RULES)}>
              Reset to defaults
            </Button>
          </div>
          {observer && <div className="mt-2 text-[11px] text-muted-foreground">Observers cannot change thresholds.</div>}
        </Section>

        <Section title="Messages" desc="Language new AI drafts open in. Forecasters can switch per warning.">
          <div className="max-w-xs space-y-1.5">
            <Label>Default draft language</Label>
            <Select value={settings.defaultLang} onValueChange={(v) => useApp.getState().updateSettings({ defaultLang: v as MsgLang })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                <SelectItem value="regional">Regional (pending review)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Section>

        <Section title="Account" desc="Your profile for this shift.">
          <div className="flex items-center gap-4 text-[13px]">
            <div>
              <div className="font-medium">{user?.name}</div>
              <div className="capitalize text-muted-foreground">
                {user?.role} · {user?.desk}
              </div>
            </div>
            <Button variant="outline" className="ml-auto" onClick={() => useApp.getState().signOut()}>
              Sign out
            </Button>
          </div>
        </Section>

        <Section title="Workspace data" desc="Warnings, outbox, run history and activity for this workstation.">
          <Button variant="destructive" onClick={() => setConfirm(true)}>
            Clear workspace
          </Button>
        </Section>

      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear workspace?</DialogTitle>
            <DialogDescription>Clears warnings, outbox, run history, activity and settings on this workstation.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                useApp.getState().resetDemoData()
                setRules(DEFAULT_RULES)
                setConfirm(false)
                toast('Workspace cleared')
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
