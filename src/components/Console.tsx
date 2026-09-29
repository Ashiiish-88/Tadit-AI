import { useApp } from '@/state/store'
import { LeftRail } from './LeftRail'
import { Timeline } from './Timeline'
import { MapView } from '@/map/MapView'
import { RightPanel } from '@/panels/RightPanel'
import { PhonePreview } from './PhonePreview'
import { Caption } from './PresentationLayer'

/** The map console: layer rail · map · timeline · right panel. Used by Operations and Replay. */
export function Console() {
  const hide = useApp((s) => s.hidePanels)
  const panelOpen = useApp((s) => s.panelOpen)
  return (
    <div className="flex h-full min-h-0">
      {!hide && <LeftRail />}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <MapView />
          <PhonePreview />
          <Caption />
        </div>
        {!hide && <Timeline />}
      </div>
      {!hide && panelOpen && <RightPanel />}
    </div>
  )
}
