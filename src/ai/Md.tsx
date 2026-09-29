import { Fragment } from 'react'

/** Tiny markdown subset: **bold**, "- " bullets, "> " quotes, line breaks. */
export function Md({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n')
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    )
  return (
    <div className={className}>
      {lines.map((l, i) => {
        if (l.startsWith('- '))
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/70" />
              <span>{bold(l.slice(2))}</span>
            </div>
          )
        if (l.startsWith('> '))
          return (
            <div key={i} className="my-1 rounded-md border-l-2 border-primary/60 bg-background/60 px-3 py-2">
              {bold(l.slice(2))}
            </div>
          )
        return (
          <p key={i} className={i ? 'mt-1.5' : ''}>
            {bold(l)}
          </p>
        )
      })}
    </div>
  )
}
