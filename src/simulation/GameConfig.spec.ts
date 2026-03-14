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

  it('validates populationGrowthPeriod > 0', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, populationGrowthPeriod: 0 })
    ).toThrow(/populationGrowthPeriod/)
  })

  it('validates faminePeriod > 0', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, faminePeriod: 0 })
    ).toThrow(/faminePeriod/)
  })

  it('validates populationMax > 0', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, populationMax: 0 })
    ).toThrow(/populationMax/)
  })

  it('L1 — rejects empty version string', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, version: '' })
    ).toThrow(/version/)
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
    expect(DEFAULT_CONFIG.populationGrowthPeriod).toBeGreaterThan(0)
    expect(DEFAULT_CONFIG.faminePeriod).toBeGreaterThan(0)
    expect(DEFAULT_CONFIG.populationMax).toBeGreaterThan(0)
  })

  it('AC#4 — Readonly<GameConfig> is a compile-time-only constraint (TypeScript enforced)', () => {
    const config: Readonly<GameConfig> = { ...DEFAULT_CONFIG }
    // @ts-expect-error — TypeScript rejects this assignment at compile-time (Readonly<T>)
    // Note: Readonly is TS-only — the mutation happens at runtime, but DEFAULT_CONFIG is unaffected
    // because `config` is a spread copy, not a reference to DEFAULT_CONFIG
    config.tickRate = 99
    expect(DEFAULT_CONFIG.tickRate).toBe(1)  // DEFAULT_CONFIG is never mutated
  })
})
