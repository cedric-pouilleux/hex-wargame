import { describe, it, expect, beforeEach } from 'vitest'
import { MockRenderer } from './MockRenderer'
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
