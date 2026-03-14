import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG, validateConfig } from './GameConfig'
import type { GameConfig } from './GameConfig'

describe('validateConfig', () => {
  it('AC#1 — does not throw on valid config', () => {
    expect(() => validateConfig(DEFAULT_CONFIG)).not.toThrow()
  })

  it('AC#2 — throws when tickRate is 0, message contains "tickRate"', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, tickRate: 0 })
    ).toThrow(/tickRate/)
  })

  it('AC#2 — throws when tickRate is negative', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, tickRate: -1 })
    ).toThrow(/tickRate/)
  })

  it('AC#2 — lists ALL violations when multiple fields are invalid', () => {
    let error: Error | null = null
    try {
      validateConfig({ ...DEFAULT_CONFIG, tickRate: 0, routeBoostFactor: 0.5 })
    } catch (e) {
      error = e as Error
    }
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/tickRate/)
    expect(error!.message).toMatch(/routeBoostFactor/)
  })

  it('validates routeBoostFactor >= 1.0', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, routeBoostFactor: 0.9 })
    ).toThrow(/routeBoostFactor/)
  })

  it('accepts routeBoostFactor exactly 1.0', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, routeBoostFactor: 1.0 })
    ).not.toThrow()
  })

  it('validates moneyRate > 0', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, moneyRate: 0 })
    ).toThrow(/moneyRate/)
  })

  it('validates populationGrowthRate > 0', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, populationGrowthRate: 0 })
    ).toThrow(/populationGrowthRate/)
  })

  it('validates famineRate > 0', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, famineRate: 0 })
    ).toThrow(/famineRate/)
  })

  it('validates populationMax > 0', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, populationMax: 0 })
    ).toThrow(/populationMax/)
  })
})

describe('DEFAULT_CONFIG', () => {
  it('AC#3 — override does not mutate DEFAULT_CONFIG', () => {
    const overridden = { ...DEFAULT_CONFIG, tickRate: 10 }
    expect(overridden.tickRate).toBe(10)
    expect(DEFAULT_CONFIG.tickRate).toBe(1)
  })

  it('AC#3 — successive test overrides are independent', () => {
    const configA = { ...DEFAULT_CONFIG, tickRate: 5 }
    const configB = { ...DEFAULT_CONFIG, tickRate: 99 }
    expect(configA.tickRate).toBe(5)
    expect(configB.tickRate).toBe(99)
    expect(DEFAULT_CONFIG.tickRate).toBe(1)
  })

  it('has required fields with valid defaults', () => {
    expect(DEFAULT_CONFIG.version).toBeTruthy()
    expect(DEFAULT_CONFIG.tickRate).toBeGreaterThan(0)
    expect(DEFAULT_CONFIG.routeBoostFactor).toBeGreaterThanOrEqual(1.0)
    expect(DEFAULT_CONFIG.moneyRate).toBeGreaterThan(0)
    expect(DEFAULT_CONFIG.populationGrowthRate).toBeGreaterThan(0)
    expect(DEFAULT_CONFIG.famineRate).toBeGreaterThan(0)
    expect(DEFAULT_CONFIG.populationMax).toBeGreaterThan(0)
  })

  it('AC#4 — Readonly<GameConfig> forbids mutation at compile-time', () => {
    const config: Readonly<GameConfig> = { ...DEFAULT_CONFIG }
    // @ts-expect-error — Readonly forbids direct mutation (TypeScript compile error)
    // If @ts-expect-error is NOT needed (no error), the build would fail — proving Readonly works
    config.tickRate = 99
    // Readonly is TypeScript-only — runtime mutation is possible but DEFAULT_CONFIG is unaffected
    expect(DEFAULT_CONFIG.tickRate).toBe(1)  // spread copy: DEFAULT_CONFIG never mutated
  })
})
