import { describe, it, expect, beforeEach } from 'vitest'
import { HexMap, HexOccupiedError, type AxialCoord } from './HexMap'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Génère n coords en ligne : q=0..n-1, r=0 */
function makeCoords(n: number): AxialCoord[] {
  return Array.from({ length: n }, (_, i) => ({ q: i, r: 0 }))
}

// ─── HexMap ────────────────────────────────────────────────────────────────────

describe('HexMap', () => {
  let map: HexMap

  beforeEach(() => {
    map = new HexMap(makeCoords(5)) // hexIds: '0,0' '1,0' '2,0' '3,0' '4,0'
  })

  // ── AC#1 ──────────────────────────────────────────────────────────────────

  it('AC#1 — isValid retourne true pour une coordonnée valide', () => {
    expect(map.isValid({ q: 0, r: 0 })).toBe(true)
    expect(map.isValid({ q: 4, r: 0 })).toBe(true)
  })

  // ── AC#2 ──────────────────────────────────────────────────────────────────

  it('AC#2 — isValid throw pour une coordonnée hors-île', () => {
    expect(() => map.isValid({ q: 99, r: 99 })).toThrow()
  })

  it('AC#2 — isValid throw pour des coordonnées négatives absentes de l\'île', () => {
    expect(() => map.isValid({ q: -1, r: 0 })).toThrow()
  })

  // ── AC#3 ──────────────────────────────────────────────────────────────────

  it('AC#3 — claimHex marque le hex occupé et stocke le buildingId', () => {
    map.claimHex('0,0', 'farm-test-1')
    expect(map.isClaimed('0,0')).toBe(true)
    expect(map.getBuildingId('0,0')).toBe('farm-test-1')
  })

  it('AC#3 — hex non réclamé : isClaimed retourne false', () => {
    expect(map.isClaimed('0,0')).toBe(false)
  })

  it('AC#3 — getBuildingId retourne undefined pour un hex libre', () => {
    expect(map.getBuildingId('0,0')).toBeUndefined()
  })

  // ── AC#4 ──────────────────────────────────────────────────────────────────

  it('AC#4 — claimHex throw HexOccupiedError si hex déjà occupé', () => {
    map.claimHex('0,0', 'farm-test-1')
    expect(() => map.claimHex('0,0', 'mine-test-1')).toThrow(HexOccupiedError)
  })

  it('AC#4 — HexOccupiedError contient l\'hexId dans le message', () => {
    map.claimHex('1,0', 'farm-test-1')
    expect(() => map.claimHex('1,0', 'mine-test-1')).toThrow('1,0')
  })

  // ── AC#5 ──────────────────────────────────────────────────────────────────

  it('AC#5 — releaseHex libère un hex occupé', () => {
    map.claimHex('0,0', 'farm-test-1')
    map.releaseHex('0,0')
    expect(map.isClaimed('0,0')).toBe(false)
    expect(map.getBuildingId('0,0')).toBeUndefined()
  })

  it('AC#5 — après releaseHex, le hex peut être réclamé à nouveau', () => {
    map.claimHex('0,0', 'farm-test-1')
    map.releaseHex('0,0')
    expect(() => map.claimHex('0,0', 'mine-test-1')).not.toThrow()
    expect(map.getBuildingId('0,0')).toBe('mine-test-1')
  })

  // ── Cas supplémentaires ───────────────────────────────────────────────────

  it('releaseHex sur un hex libre ne throw pas', () => {
    expect(() => map.releaseHex('0,0')).not.toThrow()
  })

  it('plusieurs hexes peuvent être réclamés indépendamment', () => {
    map.claimHex('0,0', 'farm-test-1')
    map.claimHex('1,0', 'city-test-1')
    map.claimHex('2,0', 'mine-test-1')
    expect(map.getBuildingId('0,0')).toBe('farm-test-1')
    expect(map.getBuildingId('1,0')).toBe('city-test-1')
    expect(map.getBuildingId('2,0')).toBe('mine-test-1')
    expect(map.isClaimed('3,0')).toBe(false)
  })

  it('coordonnées négatives valides dans l\'île sont acceptées', () => {
    const mapWithNegative = new HexMap([{ q: -1, r: -1 }, { q: 0, r: 0 }])
    expect(mapWithNegative.isValid({ q: -1, r: -1 })).toBe(true)
    expect(() => mapWithNegative.isValid({ q: 1, r: 1 })).toThrow()
  })
})
