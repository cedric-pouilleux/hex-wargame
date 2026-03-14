import { describe, it, expect, beforeEach } from 'vitest'
import { SimulationState, type Building, type City, type Edge } from './SimulationState'
import { FluxNetworkStub } from './IFluxNetwork'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBuilding(id: string): Building {
  return {
    id,
    type: 'ferme',
    hexId: 'hex-test-1',
    workers: 0,
    stock: {},
    enabled: true,
    status: 'active',
  }
}

function makeCity(id: string): City {
  return {
    id,
    hexId: 'hex-test-2',
    population: 10,
    civils: 10,
    receivedSubsistance: false,
  }
}

function makeEdge(id: string, from: string, to: string): Edge {
  return {
    id,
    from,
    to,
    resource: 'Subsistance',
    flow: 5,
    ratio: 100,
  }
}

// ─── SimulationState ───────────────────────────────────────────────────────────

describe('SimulationState', () => {
  let state: SimulationState

  beforeEach(() => {
    state = new SimulationState()
  })

  it('AC#1 — buildings.set → buildings.get retourne le bâtiment en O(1)', () => {
    const building = makeBuilding('farm-test-1')
    state.buildings.set('farm-test-1', building)
    expect(state.buildings.get('farm-test-1')).toBe(building)
  })

  it('AC#2 — buildingOrder préserve l\'ordre d\'insertion', () => {
    state.buildingOrder.push('id-A', 'id-B', 'id-C')
    expect(state.buildingOrder).toEqual(['id-A', 'id-B', 'id-C'])
  })

  it('AC#2 — buildingOrder ordre strict : A avant B avant C', () => {
    state.buildingOrder.push('id-A')
    state.buildingOrder.push('id-B')
    state.buildingOrder.push('id-C')
    expect(state.buildingOrder[0]).toBe('id-A')
    expect(state.buildingOrder[1]).toBe('id-B')
    expect(state.buildingOrder[2]).toBe('id-C')
  })

  it('cities lookup fonctionne identiquement aux buildings', () => {
    const city = makeCity('city-test-1')
    state.cities.set('city-test-1', city)
    expect(state.cities.get('city-test-1')).toBe(city)
  })

  it('edges lookup fonctionne identiquement aux buildings', () => {
    const edge = makeEdge('edge-test-1', 'farm-test-1', 'city-test-1')
    state.edges.set('edge-test-1', edge)
    expect(state.edges.get('edge-test-1')).toBe(edge)
  })

  it('money et currentTick initiaux sont 0', () => {
    expect(state.money).toBe(0)
    expect(state.currentTick).toBe(0)
  })
})

// ─── SimulationSnapshot ────────────────────────────────────────────────────────

describe('SimulationState.getSnapshot', () => {
  let state: SimulationState

  beforeEach(() => {
    state = new SimulationState()
  })

  it('AC#3 — snapshot.buildings est un Array (pas un Map)', () => {
    state.buildings.set('farm-test-1', makeBuilding('farm-test-1'))
    const snapshot = state.getSnapshot()
    expect(Array.isArray(snapshot.buildings)).toBe(true)
    expect(snapshot.buildings).not.toHaveProperty('set')
    expect(snapshot.buildings).not.toHaveProperty('delete')
  })

  it('AC#3 — snapshot.cities et snapshot.edges sont des Arrays', () => {
    state.cities.set('city-test-1', makeCity('city-test-1'))
    state.edges.set('edge-test-1', makeEdge('edge-test-1', 'farm-test-1', 'city-test-1'))
    const snapshot = state.getSnapshot()
    expect(Array.isArray(snapshot.cities)).toBe(true)
    expect(Array.isArray(snapshot.edges)).toBe(true)
  })

  it('AC#3 bis — snapshot est une copie : mutations du state ne propagent pas', () => {
    const building = makeBuilding('farm-test-1')
    state.buildings.set('farm-test-1', building)
    const snapshot1 = state.getSnapshot()
    expect(snapshot1.buildings).toHaveLength(1)

    // Ajout d'un second bâtiment APRÈS le snapshot
    state.buildings.set('farm-test-2', makeBuilding('farm-test-2'))
    const snapshot2 = state.getSnapshot()

    // Snapshot1 n'est pas affecté (c'est une copie)
    expect(snapshot1.buildings).toHaveLength(1)
    expect(snapshot2.buildings).toHaveLength(2)
  })

  it('AC#3 TypeScript — snapshot est readonly (compile-time)', () => {
    const snapshot = state.getSnapshot()
    // @ts-expect-error — snapshot.buildings est readonly, pas assignable
    snapshot.buildings = []
  })

  it('snapshot.buildingOrder est une copie de buildingOrder', () => {
    state.buildingOrder.push('id-A', 'id-B')
    const snapshot = state.getSnapshot()
    expect(snapshot.buildingOrder).toEqual(['id-A', 'id-B'])
    // Mutation du state après snapshot ne propage pas
    state.buildingOrder.push('id-C')
    expect(snapshot.buildingOrder).toHaveLength(2)
  })

  it('snapshot.currentTick et snapshot.money reflètent le state', () => {
    state.currentTick = 42
    state.money = 99.5
    const snapshot = state.getSnapshot()
    expect(snapshot.currentTick).toBe(42)
    expect(snapshot.money).toBe(99.5)
  })
})

// ─── FluxNetworkStub ───────────────────────────────────────────────────────────

describe('FluxNetworkStub', () => {
  it('AC#4 — removeEdgesFor vide les edges d\'un bâtiment', () => {
    const stub = new FluxNetworkStub()
    stub.addEdge('farm-test-1', 'edge-test-1')
    stub.addEdge('farm-test-1', 'edge-test-2')
    expect(stub.getEdgesFor('farm-test-1')).toHaveLength(2)

    stub.removeEdgesFor('farm-test-1')
    expect(stub.getEdgesFor('farm-test-1')).toEqual([])
  })

  it('removeEdgesFor sur un bâtiment sans edge ne throw pas', () => {
    const stub = new FluxNetworkStub()
    expect(() => stub.removeEdgesFor('farm-test-1')).not.toThrow()
    expect(stub.getEdgesFor('farm-test-1')).toEqual([])
  })

  it('removeEdgesFor ne supprime que les edges du bâtiment ciblé', () => {
    const stub = new FluxNetworkStub()
    stub.addEdge('farm-test-1', 'edge-test-1')
    stub.addEdge('mine-test-1', 'edge-test-2')

    stub.removeEdgesFor('farm-test-1')

    expect(stub.getEdgesFor('farm-test-1')).toEqual([])
    expect(stub.getEdgesFor('mine-test-1')).toHaveLength(1)
  })

  it('addEdge accumule plusieurs edges pour le même bâtiment', () => {
    const stub = new FluxNetworkStub()
    stub.addEdge('farm-test-1', 'edge-test-1')
    stub.addEdge('farm-test-1', 'edge-test-2')
    stub.addEdge('farm-test-1', 'edge-test-3')
    expect(stub.getEdgesFor('farm-test-1')).toHaveLength(3)
  })
})
