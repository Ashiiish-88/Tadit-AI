import { useState } from 'react'
import { ArrowRight, Bot, CloudLightning, Radar, ShieldCheck } from 'lucide-react'
import { useApp } from '@/state/store'
import type { Role } from '@/state/types'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const DESKS = ['East desk', 'North desk', 'South desk', 'West desk', 'Central desk', 'North-east desk']
const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: 'forecaster', label: 'Duty forecaster', hint: 'Edit, approve and reject warnings' },
  { id: 'supervisor', label: 'Shift supervisor', hint: 'Same as forecaster, plus settings' },
  { id: 'observer', label: 'Observer', hint: 'Read-only: cannot approve or reject' },
]

export function LoginPage() {
  const [name, setName] = useState('A. Forecaster')
  const [role, setRole] = useState<Role>('forecaster')
  const [desk, setDesk] = useState(DESKS[0])

  return (
    <div className="relative grid h-full place-items-center overflow-hidden px-6">
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]" aria-hidden>
        {[160, 300, 440, 580, 720].map((r) => (
          <circle key={r} cx="75%" cy="50%" r={r} fill="none" stroke="#1C2638" strokeDasharray="6 8" />
        ))}
        <line x1="75%" y1="50%" x2="100%" y2="20%" stroke="#38D0F0" strokeOpacity="0.25" />
      </svg>
      <div className="relative grid w-full max-w-[1040px] grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <LogoMark size={44} />
            <div>
              <div className="text-2xl font-semibold tracking-[0.18em]">TADIT</div>
              <div className="text-xs text-muted-foreground">Thunderstorm and lightning nowcasting console</div>
            </div>
          </div>
          <h1 className="max-w-[520px] text-[28px] font-semibold leading-tight">
            Every 10 minutes: radar, satellite, lightning and NWP fused into a 3-hour nowcast — and a warning draft for the forecaster.
          </h1>
          <div className="grid max-w-[520px] gap-3 text-[13px] text-muted-foreground">
            {[
              [Radar, 'Multi-radar mosaic with INSAT-3DS and lightning when radar is missing'],
              [CloudLightning, 'P(thunderstorm) and P(lightning) every 10 min to +3 h, per storm cell'],
              [Bot, 'AI-drafted IMD-style district nowcasts and an assistant that explains them'],
              [ShieldCheck, 'Forecaster in the loop: nothing is issued without approval'],
            ].map(([Icon, text]) => {
              const I = Icon as typeof Radar
              return (
                <div key={text as string} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-md border bg-card text-primary">
                    <I className="h-4 w-4" />
                  </span>
                  {text as string}
                </div>
              )
            })}
          </div>
          <div className="text-xs text-muted-foreground">SIH 2026 · PS 26072 · MoES / IMD</div>
        </div>

        <Card className="p-6">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              useApp.getState().signIn({ name: name.trim() || 'Forecaster', role, desk })
            }}
          >
            <div>
              <div className="text-base font-semibold">Sign in</div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                Choose your role and desk to start the shift.
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground">{ROLES.find((r) => r.id === role)?.hint}</div>
            </div>
            <div className="space-y-1.5">
              <Label>Desk</Label>
              <Select value={desk} onValueChange={setDesk}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESKS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">
              Enter console <ArrowRight />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
