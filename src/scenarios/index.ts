import type { ScenarioConfig } from './types'
import { s01 } from './s01-odisha-norwester'
import { s02 } from './s02-kolkata-kalbaishakhi'
import { s03 } from './s03-bihar-farmland'
import { s04 } from './s04-jharkhand-gap'
import { s05 } from './s05-mumbai-onset'
import { s06 } from './s06-delhi-dust'
import { s07 } from './s07-kerala-postmonsoon'
import { s08 } from './s08-brahmaputra-nocturnal'
import { s09 } from './s09-hyderabad-urban'
import { s10 } from './s10-satpura-belt'
import { s11 } from './s11-south-odisha-outage'
import { s12 } from './s12-punjab-severe'
import { s13 } from './s13-marwar-desert'
import { s14 } from './s14-rayalaseema-winter'
import { s15 } from './s15-shekhawati-winter'

export const SCENARIOS: ScenarioConfig[] = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12, s13, s14, s15]

export const SCENARIO_BY_ID: Record<string, ScenarioConfig> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]))

export function scenarioIndex(id: string) {
  return SCENARIOS.findIndex((s) => s.id === id)
}
