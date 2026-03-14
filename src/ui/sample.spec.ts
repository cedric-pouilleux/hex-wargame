import { describe, it, expect } from 'vitest'

describe('UI env check', () => {
  it('should run in jsdom environment (DOM available)', () => {
    expect(typeof document).toBe('object')
  })
})
