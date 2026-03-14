import { describe, it, expect } from 'vitest'
import type { BuildingDefinition } from './BuildingDefinition'
import { buildings } from '../config/default-config'

describe('BuildingDefinition', () => {
  it('buildings.json has at least 3 entries', () => {
    expect(buildings.length).toBeGreaterThanOrEqual(3)
  })

  it('each building has required fields with correct types', () => {
    for (const b of buildings) {
      expect(typeof b.type).toBe('string')
      expect(b.type.length).toBeGreaterThan(0)
      expect(typeof b.inputs).toBe('object')
      expect(typeof b.outputs).toBe('object')
      expect(typeof b.workers).toBe('number')
      expect(b.workers).toBeGreaterThanOrEqual(0)
      expect(typeof b.cost).toBe('number')
      expect(b.cost).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(b.terrain)).toBe(true)
      expect(b.terrain.length).toBeGreaterThan(0)
    }
  })

  it('buildings.json contains ferme, mine, entrepot', () => {
    const types = buildings.map(b => b.type)
    expect(types).toContain('ferme')
    expect(types).toContain('mine')
    expect(types).toContain('entrepot')
  })

  it('ferme produces Subsistance with no inputs', () => {
    const ferme = buildings.find(b => b.type === 'ferme')
    expect(ferme).toBeDefined()
    expect(Object.keys(ferme!.inputs)).toHaveLength(0)
    expect(ferme!.outputs['Subsistance']).toBeGreaterThan(0)
  })

  it('entrepot has empty inputs and outputs', () => {
    const entrepot = buildings.find(b => b.type === 'entrepot')
    expect(entrepot).toBeDefined()
    expect(Object.keys(entrepot!.inputs)).toHaveLength(0)
    expect(Object.keys(entrepot!.outputs)).toHaveLength(0)
  })

  it('AC#2 — compile-time check: workers must be a number', () => {
    const invalid = {
      type: 'test',
      inputs: {},
      outputs: {},
      // @ts-expect-error — workers must be number, not string
      workers: '2',
      cost: 0,
      terrain: ['plaine'],
    } satisfies BuildingDefinition
    expect(invalid.type).toBe('test')
  })
})
