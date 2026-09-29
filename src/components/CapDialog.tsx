import { Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { selectWarnings, useApp } from '@/state/store'
import { buildCap } from '@/lib/cap'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function highlight(xml: string) {
  // tiny, safe highlighter: escape then colour tags
  const esc = xml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/(&lt;\/?)([\w:]+)/g, '$1<span style="color:#38D0F0">$2</span>')
    .replace(/(&lt;status&gt;)(Exercise)/, '$1<span style="color:#FFC53D;font-weight:600">$2</span>')
}

export function CapDialog() {
  const id = useApp((s) => s.capOpenFor)
  const rec = useApp((s) => (id ? selectWarnings(s)[id] : null))
  const w = rec?.draft
  const ui = rec
  const xml = rec ? buildCap({ id: rec.id, dateIso: rec.dateIso, nowClock: rec.nowClock }, rec.draft, rec) : ''

  return (
    <Dialog open={!!w} onOpenChange={(o) => !o && useApp.getState().setCapOpen(null)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            CAP 1.2 alert <Badge variant="amber">status: Exercise</Badge>
          </DialogTitle>
          <DialogDescription>Generated from the {ui?.status === 'issued' ? 'approved' : 'draft'} nowcast.</DialogDescription>
        </DialogHeader>
        <pre
          className="num max-h-[52vh] overflow-auto rounded-md border bg-background p-4 text-[11.5px] leading-relaxed text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: highlight(xml) }}
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(xml).then(() => toast('CAP XML copied (Exercise)'))
            }}
          >
            <Copy /> Copy
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const blob = new Blob([xml], { type: 'application/xml' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `${rec?.id ?? 'alert'}-exercise.cap.xml`
              a.click()
              URL.revokeObjectURL(a.href)
            }}
          >
            <Download /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
