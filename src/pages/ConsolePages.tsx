import { useEffect } from 'react'
import { Console } from '@/components/Console'
import { ReplayToolbar } from '@/components/TopBar'
import { stopPresentation } from '@/present/director'

export function OperationsPage() {
  return <Console />
}

export function ReplayPage() {
  useEffect(() => () => stopPresentation(), [])
  return (
    <div className="flex h-full flex-col">
      <ReplayToolbar />
      <div className="min-h-0 flex-1">
        <Console />
      </div>
    </div>
  )
}
