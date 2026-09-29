import { describe, expect, it } from 'vitest'
import { generateRun, hashRun } from './generate'
import { SCENARIOS } from '@/scenarios'
import { TIME } from '@/config'

describe('scenario engine', () => {
  it('same seed → same frame hash', () => {
    const cfg = SCENARIOS[0]
    const a = hashRun(generateRun(cfg))
    const b = hashRun(generateRun(cfg))
    expect(a).toBe(b)
  })

  it('different scenarios → different output', () => {
    expect(hashRun(generateRun(SCENARIOS[0]))).not.toBe(hashRun(generateRun(SCENARIOS[1])))
  })

  for (const cfg of SCENARIOS) {
    describe(cfg.title, () => {
      const run = generateRun(cfg)

      it('has a title and region', () => {
        expect(cfg.title.length).toBeGreaterThan(10)
        expect(cfg.region.length).toBeGreaterThan(3)
      })

      it('probabilities are capped at 0.95 and not all zero', () => {
        let max = 0
        for (const f of run.normal.pLightning.data) for (const b of f) if (b > max) max = b
        expect(max / 255).toBeLessThanOrEqual(0.951)
        expect(max).toBeGreaterThan(0)
      })

      it('hero cells behave as scripted', () => {
        const hero = run.cells.find((c) => c.id === cfg.heroNewCell)
        expect(hero?.isNew).toBe(true)
        const onset = run.cells.find((c) => c.id === cfg.heroOnsetCell)
        expect(onset?.frames[TIME.nowIndex].onset).toBe(true)
      })

      it('drafts at least one district warning', () => {
        expect(run.warnings.length).toBeGreaterThan(0)
      })

      it('never contains a wind number', () => {
        const text = JSON.stringify(run.warnings)
        expect(/km\/h|gust|wind/i.test(text)).toBe(false)
      })
    })
  }
})
