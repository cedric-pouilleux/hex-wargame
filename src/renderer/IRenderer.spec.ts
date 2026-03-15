import { describe, it, expect, beforeEach } from 'vitest'
import { MockRenderer } from './MockRenderer'
import { clampCamera, CAMERA_BOUNDS, CAMERA_SPEED, pixelToAxial } from './PixiRenderer'
import { TickOrchestrator } from '../simulation/TickOrchestrator'
import { DEFAULT_CONFIG } from '../simulation/GameConfig'
import type { IRenderer } from './IRenderer'

// ─────────────────────────────────────────────────────────────
// AC#1 — MockRenderer implémente IRenderer (contrat TypeScript)
// ─────────────────────────────────────────────────────────────

describe('IRenderer — interface contract via MockRenderer', () => {
  let mock: MockRenderer

  beforeEach(() => {
    mock = new MockRenderer()
  })

  it('AC#1 — MockRenderer satisfait IRenderer (substitution TypeScript)', () => {
    // Si MockRenderer ne satisfaisait pas IRenderer, ce code ne compilerait pas
    const renderer: IRenderer = mock
    expect(renderer).toBeDefined()
  })

  // ─────────────────────────────────────────────────────────────
  // AC#5 — MockRenderer.init() résout sans erreur
  // ─────────────────────────────────────────────────────────────
  it('AC#5 — MockRenderer.init() résout sans accès DOM réel', async () => {
    const canvas = document.createElement('canvas')
    await expect(mock.init(canvas)).resolves.toBeUndefined()
  })

  // ─────────────────────────────────────────────────────────────
  // AC#5 — MockRenderer.renderState() incrémente renderCallCount
  // ─────────────────────────────────────────────────────────────
  it('AC#5 — MockRenderer.renderState() incrémente renderCallCount', () => {
    const snapshot = {
      buildings: [],
      cities: [],
      edges: [],
      buildingOrder: [],
      currentTick: 1,
      money: 0,
      hexTiles: [],
    }

    expect(mock.renderCallCount).toBe(0)
    mock.renderState(snapshot)
    expect(mock.renderCallCount).toBe(1)
    mock.renderState(snapshot)
    expect(mock.renderCallCount).toBe(2)

    // lastSnapshot est mémorisé
    expect(mock.lastSnapshot).toBe(snapshot)
  })

  it('AC#5 — MockRenderer.destroy() ne throw pas', () => {
    expect(() => mock.destroy()).not.toThrow()
    expect(() => mock.destroy()).not.toThrow() // idempotent
  })

  // ─────────────────────────────────────────────────────────────
  // AC#5 — Intégration TickOrchestrator + MockRenderer
  // renderState() appelé N fois après runTicks(N)
  // ─────────────────────────────────────────────────────────────
  it('AC#5 — TickOrchestrator + MockRenderer : renderCallCount === N après runTicks(N)', () => {
    const renderer = new MockRenderer()
    const orch = new TickOrchestrator(
      DEFAULT_CONFIG,
      [],
      [],
      [],
      (snapshot) => { renderer.renderState(snapshot) },
    )

    orch.runTicks(5)

    expect(renderer.renderCallCount).toBe(5)
  })

  it('AC#5 — snapshot contient currentTick correct après chaque tick', () => {
    const ticks: number[] = []
    const orch = new TickOrchestrator(
      DEFAULT_CONFIG,
      [],
      [],
      [],
      (snapshot) => { ticks.push(snapshot.currentTick) },
    )

    orch.runTicks(3)

    // currentTick incrémenté AVANT snapshot (Step 7 → Step 8 dans TickOrchestrator)
    expect(ticks).toEqual([1, 2, 3])
  })

  it('AC#5 — TickOrchestrator headless avec MockRenderer : aucun accès DOM (NFR12)', () => {
    // Ce test tourne en jsdom mais MockRenderer ne crée aucun canvas réel
    const renderer = new MockRenderer()
    expect(() => {
      const orch = new TickOrchestrator(
        DEFAULT_CONFIG, [], [], [],
        (snapshot) => { renderer.renderState(snapshot) },
      )
      orch.runTicks(10)
    }).not.toThrow()
    expect(renderer.renderCallCount).toBe(10)
  })
})

// ─────────────────────────────────────────────────────────────
// clampCamera — logique de bounds caméra (Story 2.3)
// Testable sans WebGL car fonction pure
// ─────────────────────────────────────────────────────────────

describe('clampCamera — bounds caméra', () => {
  it('retourne current + delta quand dans les limites', () => {
    expect(clampCamera(0, 50, CAMERA_BOUNDS)).toBe(50)
    expect(clampCamera(100, -30, CAMERA_BOUNDS)).toBe(70)
  })

  it('clamp au maximum quand delta dépasse bounds positifs', () => {
    expect(clampCamera(0, CAMERA_BOUNDS + 1, CAMERA_BOUNDS)).toBe(CAMERA_BOUNDS)
    expect(clampCamera(CAMERA_BOUNDS - 1, 10, CAMERA_BOUNDS)).toBe(CAMERA_BOUNDS)
  })

  it('clamp au minimum quand delta dépasse bounds négatifs', () => {
    expect(clampCamera(0, -(CAMERA_BOUNDS + 1), CAMERA_BOUNDS)).toBe(-CAMERA_BOUNDS)
    expect(clampCamera(-(CAMERA_BOUNDS - 1), -10, CAMERA_BOUNDS)).toBe(-CAMERA_BOUNDS)
  })

  it('CAMERA_BOUNDS vaut 360 (HEX_SIZE=36 × 4 × 2.5)', () => {
    expect(CAMERA_BOUNDS).toBe(360)
  })

  it('CAMERA_SPEED vaut 8', () => {
    expect(CAMERA_SPEED).toBe(8)
  })

  it('déplacement clavier complet reste dans les bounds', () => {
    // 50 pressions de flèche droite depuis 0 → doit être clampé à CAMERA_BOUNDS
    let x = 0
    for (let i = 0; i < 50; i++) x = clampCamera(x, CAMERA_SPEED, CAMERA_BOUNDS)
    expect(x).toBe(CAMERA_BOUNDS)
  })
})

// ─────────────────────────────────────────────────────────────
// pixelToAxial — conversion pixel local → hex axial (Story 2.4)
// Testable sans WebGL car fonction pure
// ─────────────────────────────────────────────────────────────

describe('pixelToAxial — conversion pixel → hex axial (flat-top)', () => {
  const HEX_SIZE = 36

  // Formule directe hexToPixel(q, r) pour vérification round-trip
  function hexToPixel(q: number, r: number): { x: number; y: number } {
    return {
      x: HEX_SIZE * (3 / 2 * q),
      y: HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r),
    }
  }

  it('round-trip : hexToPixel → pixelToAxial redonne les coords originales pour (0,0)', () => {
    const { x, y } = hexToPixel(0, 0)
    expect(pixelToAxial(x, y, HEX_SIZE)).toEqual({ q: 0, r: 0 })
  })

  it('round-trip : (2, -1)', () => {
    const { x, y } = hexToPixel(2, -1)
    expect(pixelToAxial(x, y, HEX_SIZE)).toEqual({ q: 2, r: -1 })
  })

  it('round-trip : (-3, 2)', () => {
    const { x, y } = hexToPixel(-3, 2)
    expect(pixelToAxial(x, y, HEX_SIZE)).toEqual({ q: -3, r: 2 })
  })

  it('round-trip : (0, 3)', () => {
    const { x, y } = hexToPixel(0, 3)
    expect(pixelToAxial(x, y, HEX_SIZE)).toEqual({ q: 0, r: 3 })
  })

  it('arrondi : pixel légèrement décalé du centre retourne le bon hex', () => {
    // Centre de (1, 0) + décalage de 5px
    const { x, y } = hexToPixel(1, 0)
    expect(pixelToAxial(x + 5, y + 3, HEX_SIZE)).toEqual({ q: 1, r: 0 })
  })

  it('arrondi cube : pixel entre deux hexes retourne le plus proche', () => {
    // Pixel exactement entre (0,0) et (1,0) → attribué à l'un des deux
    const { x: x0 } = hexToPixel(0, 0)
    const { x: x1 } = hexToPixel(1, 0)
    const midX = (x0 + x1) / 2
    const result = pixelToAxial(midX, 0, HEX_SIZE)
    // Doit retourner l'un des deux hexes voisins
    const isValid = (result.q === 0 && result.r === 0) || (result.q === 1 && result.r === 0)
    expect(isValid).toBe(true)
  })

  it('hexSize = 0 : retourne Infinity (division par 0 — cas impossible en runtime, hexSize = 36)', () => {
    // hexSize est toujours HEX_SIZE = 36 dans le code applicatif — ce test documente le contrat
    const result = pixelToAxial(100, 100, 0)
    expect(Number.isFinite(result.q)).toBe(false)
    expect(Number.isFinite(result.r)).toBe(false)
  })
})
