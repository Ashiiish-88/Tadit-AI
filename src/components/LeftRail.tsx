import { CircleDot, CloudLightning, Flame, Map as MapIcon, Radar, Satellite, Target, Zap, Activity } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useApp } from '@/state/store'
import type { LayerKey } from '@/scenarios/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const ITEMS: { key: LayerKey; label: string; icon: LucideIcon }[] = [
  { key: 'radar', label: 'Radar reflectivity (dBZ)', icon: Radar },
  { key: 'pThunder', label: 'P(thunderstorm) · ≥45 dBZ', icon: CloudLightning },
  { key: 'pLightning', label: 'P(lightning) · within 10 km', icon: Activity },
  { key: 'strikes', label: 'Lightning strikes', icon: Zap },
  { key: 'sat', label: 'Satellite IR (K)', icon: Satellite },
  { key: 'cape', label: 'NWP CAPE (J/kg)', icon: Flame },
  { key: 'cells', label: 'Storm cells + tracks', icon: Target },
  { key: 'warnings', label: 'District warnings', icon: MapIcon },
  { key: 'rings', label: 'Radar sites + 250 km rings', icon: CircleDot },
]

export function LeftRail() {
  const layers = useApp((s) => s.layers)
  return (
    <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r bg-card py-3">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Layers</div>
      {ITEMS.map(({ key, label, icon: Icon }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <button
              onClick={() => useApp.getState().toggleLayer(key)}
              aria-pressed={layers[key]}
              aria-label={label}
              className={cn(
                'grid h-11 w-11 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground',
                layers[key] && 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ))}
    </nav>
  )
}
