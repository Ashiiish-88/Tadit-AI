// Tuning aid (not part of CI): prints hero-moment facts per scenario.
// Run: npx vitest run scripts/diagnose.test.ts --config vite.config.ts --dir .
import { it } from 'vitest'
import { generateRun } from '@/engine/generate'
import { SCENARIOS } from '@/scenarios'
import { TIME } from '@/config'

it('diagnose', () => {
  for (const cfg of SCENARIOS) {
    const run = generateRun(cfg)
    const onset = run.cells.find((c) => c.id === cfg.heroOnsetCell)
    const hero = run.cells.find((c) => c.id === cfg.heroNewCell)
    const now = TIME.nowIndex
    const dw = run.normal.districtWarnings.map((d) => `${d.districtId}:${d.level[0]}(${d.maxPLightning.toFixed(2)}/${d.maxP45.toFixed(2)}/${d.maxP54.toFixed(2)} eta${d.etaMin})`)
    process.stdout.write(
      `#${cfg.num} ${run.timings.totalMs}ms flashes=${run.flashes.length} cells=${run.cells.length}\n` +
        `  onset ${onset?.id} tf=${onset?.firstFlashT} dbz0=${onset?.frames[now].maxDbz} p=${onset?.frames[now].pL30} onset=${onset?.frames[now].onset}\n` +
        `  new ${hero?.id} isNew=${hero?.isNew} tf=${hero?.firstFlashT} dbz+60=${hero?.frames[now + 6].maxDbz}\n` +
        `  warn ${run.warnings.map((w) => w.level + ':' + w.districtIds.join(',')).join(' | ')}\n  ${dw.join(' ')}
`,
    )
  }
}, 120000)
