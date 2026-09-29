import { DISTRICTS } from '@/data/districtHQ'
import { clockAdd } from './time'
import type { LangCode } from '@/scenarios/types'
import type { WarningDraft } from '@/types/run'

export type MsgLang = 'en' | 'hi' | 'regional'

export interface WarningEdits {
  intensity: WarningDraft['intensity']
  phrase: string
  phraseHi: string
  /** forecaster-entered; never produced by the model */
  gust: string
  hailNote: string
}

const INTENSITY_HI: Record<WarningDraft['intensity'], string> = {
  Light: 'हल्का',
  Moderate: 'मध्यम',
  Severe: 'तीव्र',
}

export const PHRASES = [
  { en: 'at one or two places', hi: 'एक या दो स्थानों पर' },
  { en: 'at a few places', hi: 'कुछ स्थानों पर' },
  { en: 'at many places', hi: 'अनेक स्थानों पर' },
]

function joinEn(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
function joinHi(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} और ${names[names.length - 1]}`
}

export function validity(w: WarningDraft, nowClock: string) {
  return { start: clockAdd(nowClock, w.validFromMin), end: clockAdd(nowClock, w.validToMin) }
}

export function messageEn(w: WarningDraft, e: WarningEdits, nowClock: string) {
  const { start, end } = validity(w, nowClock)
  const names = joinEn(w.districtIds.map((id) => DISTRICTS[id].name))
  let s = `${e.intensity} thunderstorm with lightning is very likely ${e.phrase} over ${names} districts during the next 3 hours. Valid ${start}–${end} IST.`
  if (e.gust.trim()) s += ` Gusty winds ${e.gust.trim()} km/h likely (forecaster assessment).`
  if (e.hailNote.trim()) s += ` ${e.hailNote.trim()}`
  return s
}

export function messageHi(w: WarningDraft, e: WarningEdits, nowClock: string) {
  const { start, end } = validity(w, nowClock)
  const names = joinHi(w.districtIds.map((id) => DISTRICTS[id].hi))
  let s = `अगले 3 घंटों में ${names} ज़िलों में ${e.phraseHi} बिजली गिरने के साथ ${INTENSITY_HI[e.intensity]} गरज-चमक वाला तूफ़ान आने की बहुत संभावना है। वैध: ${start}–${end} IST।`
  if (e.gust.trim()) s += ` ${e.gust.trim()} किमी/घंटा की तेज़ हवाएँ संभव (पूर्वानुमानकर्ता आकलन)।`
  return s
}

/**
 * Regional-language templates. Deliberately empty: drafts must be written and checked by a
 * native speaker before use. Until then the UI shows the English text with a
 * "translation pending native-speaker review" badge.
 */
export const REGIONAL_TEMPLATES: Partial<Record<LangCode, (w: WarningDraft, e: WarningEdits, nowClock: string) => string>> = {}

export function messageFor(lang: MsgLang, regional: LangCode, w: WarningDraft, e: WarningEdits, nowClock: string) {
  if (lang === 'hi' || (lang === 'regional' && regional === 'hi')) return { text: messageHi(w, e, nowClock), pending: false }
  if (lang === 'regional') {
    const tpl = REGIONAL_TEMPLATES[regional]
    return tpl ? { text: tpl(w, e, nowClock), pending: true } : { text: messageEn(w, e, nowClock), pending: true, fallback: true }
  }
  return { text: messageEn(w, e, nowClock), pending: false }
}

export function smsText(lang: MsgLang, regional: LangCode, w: WarningDraft, e: WarningEdits, nowClock: string) {
  const m = messageFor(lang, regional, w, e, nowClock)
  const head = lang === 'hi' ? '[अभ्यास / EXERCISE] ' : '[EXERCISE] '
  return head + m.text
}
