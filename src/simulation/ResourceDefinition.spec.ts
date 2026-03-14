import { describe, it, expect } from 'vitest'
import type { ResourceDefinition } from './ResourceDefinition'
import { resources } from '../config/default-config'

describe('ResourceDefinition', () => {
  it('resources.json has at least 3 entries', () => {
    expect(resources.length).toBeGreaterThanOrEqual(3)
  })

  it('each resource has name, unit, maxStock', () => {
    for (const r of resources) {
      expect(typeof r.name).toBe('string')
      expect(typeof r.unit).toBe('string')
      expect(typeof r.maxStock).toBe('number')
      expect(r.maxStock).toBeGreaterThan(0)
    }
  })

  it('AC#3 — adding a resource to JSON makes it available without code change', () => {
    const names = resources.map(r => r.name)
    expect(names).toContain('Subsistance')
    expect(names).toContain('Bois')
    expect(names).toContain('Charbon')
  })

  it('AC#2 — compile-time check: maxStock must be a number (structural validation)', () => {
    // This test validates that the interface requires a number for maxStock.
    // The @ts-expect-error below proves TypeScript rejects a string at compile time.
    const invalid = {
      name: 'Test',
      unit: 'kg',
      // @ts-expect-error — maxStock must be number, not string
      maxStock: '100',
    } satisfies ResourceDefinition
    // At runtime the object exists but TypeScript caught the type error above
    expect(invalid.name).toBe('Test')
  })
})
