// CAP 1.2 builder. Status is ALWAYS "Exercise" in this prototype; nothing is ever sent.

import { DISTRICTS, footprintCentre } from '@/data/districtHQ'
import type { WarningDraft } from '@/types/run'
import { istIso } from './time'
import { messageEn, messageHi, type WarningEdits } from './messages'

const SEVERITY = { yellow: 'Moderate', orange: 'Severe', red: 'Extreme' } as const

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export interface CapMeta {
  id: string
  dateIso: string
  nowClock: string
}

export function buildCap(cfg: CapMeta, w: WarningDraft, e: WarningEdits): string {
  const sent = istIso(cfg.dateIso, cfg.nowClock, 0)
  const onset = istIso(cfg.dateIso, cfg.nowClock, w.validFromMin)
  const expires = istIso(cfg.dateIso, cfg.nowClock, w.validToMin)
  const areas = w.districtIds
    .map((id) => {
      const d = DISTRICTS[id]
      const [la, lo] = footprintCentre(d)
      return `      <area>
        <areaDesc>${esc(d.name)} district, ${esc(d.state)}</areaDesc>
        <circle>${la.toFixed(2)},${lo.toFixed(2)} ${d.r}</circle>
      </area>`
    })
    .join('\n')
  const params = [
    ['IMD_COLOUR', w.level.toUpperCase()],
    ['SOURCE', 'TADIT nowcast'],
    ...(e.gust.trim() ? [['GUST_KMH_FORECASTER', e.gust.trim()]] : []),
  ]
    .map(([k, v]) => `      <parameter>\n        <valueName>${k}</valueName>\n        <value>${esc(v)}</value>\n      </parameter>`)
    .join('\n')

  const info = (lang: string, headline: string, description: string) => `  <info>
    <language>${lang}</language>
    <category>Met</category>
    <event>Thunderstorm and lightning</event>
    <responseType>Shelter</responseType>
    <urgency>Immediate</urgency>
    <severity>${SEVERITY[w.level]}</severity>
    <certainty>Likely</certainty>
    <onset>${onset}</onset>
    <expires>${expires}</expires>
    <senderName>TADIT Nowcast System</senderName>
    <headline>${esc(headline)}</headline>
    <description>${esc(description)}</description>
    <instruction>${esc(lang === 'hi-IN' ? 'खुले में न रहें; पक्के भवन में शरण लें।' : 'Avoid open fields and water bodies; take shelter in a pucca building.')}</instruction>
${params}
${areas}
  </info>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>TADIT-SIM-${cfg.id}-${cfg.dateIso.replace(/-/g, '')}${cfg.nowClock.replace(':', '')}</identifier>
  <sender>tadit.nowcast</sender>
  <sent>${sent}</sent>
  <status>Exercise</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <note>Exercise message.</note>
${info('en-IN', `${w.level[0].toUpperCase()}${w.level.slice(1)} nowcast: thunderstorm with lightning (exercise)`, messageEn(w, e, cfg.nowClock))}
${info('hi-IN', 'मौसम नाउकास्ट: गरज-चमक और बिजली (अभ्यास)', messageHi(w, e, cfg.nowClock))}
</alert>
`
}
