import { describe, it, expect } from 'vitest'

describe('Simulation env check', () => {
  it('should run in node environment (no DOM)', () => {
    expect(typeof window).toBe('undefined')
  })
})
