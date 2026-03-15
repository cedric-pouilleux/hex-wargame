import { describe, it, expect, beforeEach } from 'vitest'
import { TickOrchestrator } from './TickOrchestrator'
import { DEFAULT_CONFIG } from './GameConfig'
import { ISLAND_TILES } from '../config/island-map'
import { buildings as buildingDefs } from '../config/default-config'
import type { Building } from './SimulationState'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeBuilding(id: string, hexId: string): Building {
  return { id, type: 'ferme', hexId, workers: 0, stock: {}, enabled: true, status: 'under-construction' }
}

// ─────────────────────────────────────────────────────────────
// Tests headless — états visuels des bâtiments (AC1, AC2, AC3, AC4)
// ─────────────────────────────────────────────────────────────

describe('État visuel des bâtiments (headless)', () => {
  let orch: TickOrchestrator

  beforeEach(() => {
    orch = new TickOrchestrator(DEFAULT_CONFIG, buildingDefs, [], ISLAND_TILES)
  })

  // ─── AC1 : placement initial → under-construction ─────────────────────────

  it('AC1 — placement initial → status = under-construction', () => {
    orch.buildingRegistry.addBuilding(makeBuilding('b1', '0,0'))
    expect(orch.state.buildings.get('b1')!.status).toBe('under-construction')
  })

  // ─── AC2 : tick suivant → active ──────────────────────────────────────────

  it('AC2 — après runTicks(1) → status = active', () => {
    orch.buildingRegistry.addBuilding(makeBuilding('b1', '0,0'))
    orch.runTicks(1)
    expect(orch.state.buildings.get('b1')!.status).toBe('active')
  })

  // ─── AC3 : désactiver → inactive ──────────────────────────────────────────

  it('AC3 — enabled=false après construction → status = inactive', () => {
    orch.buildingRegistry.addBuilding(makeBuilding('b1', '0,0'))
    orch.runTicks(1)
    orch.state.buildings.get('b1')!.enabled = false
    orch.runTicks(1)
    expect(orch.state.buildings.get('b1')!.status).toBe('inactive')
  })

  // ─── AC4 : réactiver → active ─────────────────────────────────────────────

  it('AC4 — re-enable après inactive → status = active', () => {
    orch.buildingRegistry.addBuilding(makeBuilding('b1', '0,0'))
    orch.runTicks(1)
    orch.state.buildings.get('b1')!.enabled = false
    orch.runTicks(1)
    orch.state.buildings.get('b1')!.enabled = true
    orch.runTicks(1)
    expect(orch.state.buildings.get('b1')!.status).toBe('active')
  })

  // ─── Cohérence : under-construction ne produit pas de ressources ──────────

  it('sous-construction — le bâtiment ne produit pas pendant le tick de transition', () => {
    orch.buildingRegistry.addBuilding(makeBuilding('b1', '0,0'))
    // Avant tick : stock vide
    expect(orch.state.buildings.get('b1')!.stock['Subsistance'] ?? 0).toBe(0)
    // Pendant tick 1 : building est under-construction → ResourceEngine le skip
    orch.runTicks(1)
    // Status transitionne vers active mais aucune production pendant ce tick
    expect(orch.state.buildings.get('b1')!.status).toBe('active')
    expect(orch.state.buildings.get('b1')!.stock['Subsistance'] ?? 0).toBe(0)
  })
})
