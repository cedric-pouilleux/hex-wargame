import { describe, it, expect, beforeEach } from 'vitest'
import { BuildingRegistry, BuildingNotFoundError } from './BuildingRegistry'
import { SimulationState, type Building } from './SimulationState'
import { FluxNetworkStub } from './IFluxNetwork'
import { HexMap } from './HexMap'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBuilding(id: string, hexId: string, workers = 0): Building {
  return { id, type: 'ferme', hexId, workers, stock: {}, enabled: true, status: 'active' }
}

/** 5 hexes : '0,0' '1,0' '2,0' '3,0' '4,0' */
function makeHexMap(): HexMap {
  return new HexMap(Array.from({ length: 5 }, (_, i) => ({ q: i, r: 0 })))
}

// ─── BuildingRegistry ──────────────────────────────────────────────────────────

describe('BuildingRegistry', () => {
  let state: SimulationState
  let stub: FluxNetworkStub
  let hexMap: HexMap
  let registry: BuildingRegistry

  beforeEach(() => {
    state = new SimulationState()
    stub = new FluxNetworkStub()
    hexMap = makeHexMap()
    registry = new BuildingRegistry(state, stub, hexMap)
  })

  // ── AC#5 — addBuilding ─────────────────────────────────────────────────────

  it('AC#5 — addBuilding enregistre le bâtiment dans state.buildings', () => {
    const building = makeBuilding('farm-test-1', '0,0')
    registry.addBuilding(building)
    expect(state.buildings.get('farm-test-1')).toBe(building)
  })

  it('AC#5 — addBuilding ajoute l\'id en fin de buildingOrder', () => {
    registry.addBuilding(makeBuilding('farm-test-1', '0,0'))
    registry.addBuilding(makeBuilding('mine-test-1', '1,0'))
    expect(state.buildingOrder).toEqual(['farm-test-1', 'mine-test-1'])
  })

  it('AC#5 — addBuilding réclame le hex dans HexMap', () => {
    registry.addBuilding(makeBuilding('farm-test-1', '0,0'))
    expect(hexMap.isClaimed('0,0')).toBe(true)
    expect(hexMap.getBuildingId('0,0')).toBe('farm-test-1')
  })

  // ── AC#1–4 — removeBuilding ────────────────────────────────────────────────

  it('AC#1 — removeBuilding supprime le bâtiment de state.buildings', () => {
    registry.addBuilding(makeBuilding('farm-test-1', '0,0'))
    stub.addEdge('farm-test-1', 'edge-test-1')
    stub.addEdge('farm-test-1', 'edge-test-2')

    registry.removeBuilding('farm-test-1')

    expect(state.buildings.has('farm-test-1')).toBe(false)
  })

  it('AC#2 — removeBuilding retire l\'id de buildingOrder', () => {
    registry.addBuilding(makeBuilding('farm-test-1', '0,0'))
    stub.addEdge('farm-test-1', 'edge-test-1')
    stub.addEdge('farm-test-1', 'edge-test-2')

    registry.removeBuilding('farm-test-1')

    expect(state.buildingOrder).not.toContain('farm-test-1')
  })

  it('AC#3 — removeBuilding nettoie les edges via IFluxNetwork.removeEdgesFor', () => {
    registry.addBuilding(makeBuilding('farm-test-1', '0,0'))
    stub.addEdge('farm-test-1', 'edge-test-1')
    stub.addEdge('farm-test-1', 'edge-test-2')

    registry.removeBuilding('farm-test-1')

    expect(stub.getEdgesFor('farm-test-1')).toEqual([])
  })

  it('AC#4 — après removeBuilding, assertWorkersConsistency passe (workers restants ≤ civils)', () => {
    registry.addBuilding(makeBuilding('farm-test-1', '0,0', 3))
    registry.addBuilding(makeBuilding('mine-test-1', '1,0', 2))

    registry.removeBuilding('farm-test-1')

    // mine-test-1 a 2 workers, civils=5 → invariant respecté
    expect(() => registry.assertWorkersConsistency(5)).not.toThrow()
  })

  // ── AC#6 — BuildingNotFoundError ──────────────────────────────────────────

  it('AC#6 — removeBuilding throw BuildingNotFoundError si id inconnu', () => {
    expect(() => registry.removeBuilding('unknown-test-1')).toThrow(BuildingNotFoundError)
  })

  it('AC#6 — BuildingNotFoundError contient l\'id dans le message', () => {
    expect(() => registry.removeBuilding('phantom-test-1')).toThrow('phantom-test-1')
  })

  // ── Cas supplémentaires ───────────────────────────────────────────────────

  it('removeBuilding libère le hex dans HexMap', () => {
    registry.addBuilding(makeBuilding('farm-test-1', '0,0'))
    registry.removeBuilding('farm-test-1')
    expect(hexMap.isClaimed('0,0')).toBe(false)
  })

  it('suppression atomique — edges de mine-test-1 ne sont pas touchés', () => {
    registry.addBuilding(makeBuilding('farm-test-1', '0,0'))
    registry.addBuilding(makeBuilding('mine-test-1', '1,0'))
    stub.addEdge('farm-test-1', 'edge-test-1')
    stub.addEdge('mine-test-1', 'edge-test-2')

    registry.removeBuilding('farm-test-1')

    expect(stub.getEdgesFor('mine-test-1')).toHaveLength(1)
  })

  it('buildingOrder préserve l\'ordre après suppression du bâtiment du milieu', () => {
    registry.addBuilding(makeBuilding('farm-test-1', '0,0'))
    registry.addBuilding(makeBuilding('mine-test-1', '1,0'))
    registry.addBuilding(makeBuilding('city-test-1', '2,0'))

    registry.removeBuilding('mine-test-1')

    expect(state.buildingOrder).toEqual(['farm-test-1', 'city-test-1'])
  })
})

// ─── assertWorkersConsistency ─────────────────────────────────────────────────

describe('BuildingRegistry.assertWorkersConsistency', () => {
  let state: SimulationState
  let registry: BuildingRegistry

  beforeEach(() => {
    state = new SimulationState()
    registry = new BuildingRegistry(state, new FluxNetworkStub(), makeHexMap())
  })

  it('ne throw pas si sum(workers) ≤ civils', () => {
    registry.addBuilding(makeBuilding('farm-test-1', '0,0', 2))
    registry.addBuilding(makeBuilding('mine-test-1', '1,0', 3))
    expect(() => registry.assertWorkersConsistency(5)).not.toThrow()
  })

  it('throw si sum(workers) > civils', () => {
    registry.addBuilding(makeBuilding('farm-test-1', '0,0', 3))
    registry.addBuilding(makeBuilding('mine-test-1', '1,0', 3))
    expect(() => registry.assertWorkersConsistency(5)).toThrow()
  })

  it('ne throw pas sur state vide (0 workers)', () => {
    expect(() => registry.assertWorkersConsistency(0)).not.toThrow()
  })
})
