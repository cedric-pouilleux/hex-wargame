import { describe, it, expect, beforeEach } from 'vitest'
import { FluxNetwork, CyclicGraphError, DuplicateEdgeError } from './FluxNetwork'
import { SimulationState, type Building, type City } from './SimulationState'

// ─── maxStock de test ──────────────────────────────────────────────────────────

const MAX_STOCK: Readonly<Record<string, number>> = {
  Subsistance: 10,
  Bois: 10,
  Fer: 20,
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBuilding(
  id: string,
  hexId: string,
  stock: Partial<Record<string, number>> = {},
): Building {
  return { id, type: 'ferme', hexId, workers: 0, stock, enabled: true, status: 'active' }
}

function makeCity(id: string, hexId: string): City {
  return { id, hexId, population: 10, civils: 10, receivedSubsistance: false }
}

// ─── FluxNetwork.addEdge ──────────────────────────────────────────────────────

describe('FluxNetwork.addEdge — ajout basic', () => {
  let state: SimulationState
  let flux: FluxNetwork

  beforeEach(() => {
    state = new SimulationState()
    flux = new FluxNetwork(state, MAX_STOCK)
  })

  it('AC#1 — addEdge(A, B) insère un edge dans state.edges', () => {
    state.buildings.set('farm-test-1', makeBuilding('farm-test-1', '0,0'))
    state.buildings.set('hub-test-1', makeBuilding('hub-test-1', '1,0'))

    flux.addEdge('farm-test-1', 'hub-test-1', 'Subsistance')

    const edgeId = 'edge-farm-test-1-hub-test-1-Subsistance'
    expect(state.edges.has(edgeId)).toBe(true)
    const edge = state.edges.get(edgeId)
    expect(edge?.from).toBe('farm-test-1')
    expect(edge?.to).toBe('hub-test-1')
    expect(edge?.resource).toBe('Subsistance')
    expect(edge?.flow).toBe(0)
    expect(edge?.ratio).toBe(100)
  })

  it('addEdge sur graphe vide (nœud source isolé) ne throw pas', () => {
    expect(() => flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')).not.toThrow()
  })

  it('plusieurs edges de types différents entre les mêmes nodes sont acceptés', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    flux.addEdge('farm-test-1', 'hub-test-1', 'Subsistance')

    expect(state.edges.size).toBe(2)
  })

  it('M1 — addEdge doublon (même from/to/resource) → throw DuplicateEdgeError', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')

    expect(() => flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')).toThrow(DuplicateEdgeError)
  })

  it('M1 — state.edges inchangé après DuplicateEdgeError', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    const sizeBefore = state.edges.size

    try {
      flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    } catch {
      // expected
    }

    expect(state.edges.size).toBe(sizeBefore)
  })
})

describe('FluxNetwork.addEdge — DFS anti-cycle', () => {
  let state: SimulationState
  let flux: FluxNetwork

  beforeEach(() => {
    state = new SimulationState()
    flux = new FluxNetwork(state, MAX_STOCK)
  })

  it('AC#2 — cycle direct A→B + B→A → throw CyclicGraphError', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Subsistance')

    expect(() => flux.addEdge('hub-test-1', 'farm-test-1', 'Subsistance')).toThrow(CyclicGraphError)
  })

  it('AC#3 — cycle transitif A→B→C + C→A → throw CyclicGraphError', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    flux.addEdge('hub-test-1', 'mine-test-1', 'Bois')

    expect(() => flux.addEdge('mine-test-1', 'farm-test-1', 'Bois')).toThrow(CyclicGraphError)
  })

  it('cycle indirect A→B→C→D→A → throw CyclicGraphError', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    flux.addEdge('hub-test-1', 'mine-test-1', 'Bois')
    flux.addEdge('mine-test-1', 'warehouse-test-1', 'Bois')

    expect(() => flux.addEdge('warehouse-test-1', 'farm-test-1', 'Bois')).toThrow(CyclicGraphError)
  })

  it('ajout vers un nœud différent (DAG valide) ne throw pas', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')

    // A→C ne crée pas de cycle (C ne peut pas atteindre A)
    expect(() => flux.addEdge('farm-test-1', 'mine-test-1', 'Bois')).not.toThrow()
  })

  it('addEdge sur lui-même → throw CyclicGraphError', () => {
    expect(() => flux.addEdge('farm-test-1', 'farm-test-1', 'Bois')).toThrow(CyclicGraphError)
  })

  it('CyclicGraphError a le bon name', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Subsistance')
    try {
      flux.addEdge('hub-test-1', 'farm-test-1', 'Subsistance')
      expect.fail('devrait avoir throw')
    } catch (e) {
      expect(e).toBeInstanceOf(CyclicGraphError)
      expect((e as CyclicGraphError).name).toBe('CyclicGraphError')
    }
  })

  it('edge non-ajouté après CyclicGraphError — state.edges inchangé', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    const sizeBefore = state.edges.size

    try {
      flux.addEdge('hub-test-1', 'farm-test-1', 'Bois')
    } catch {
      // expected
    }

    expect(state.edges.size).toBe(sizeBefore)
  })
})

// ─── FluxNetwork.tick ─────────────────────────────────────────────────────────

describe('FluxNetwork.tick — backpressure', () => {
  let state: SimulationState
  let flux: FluxNetwork

  beforeEach(() => {
    state = new SimulationState()
    flux = new FluxNetwork(state, MAX_STOCK)
  })

  it('AC#4 — B saturé → edge.flow = 0, stock A inchangé', () => {
    const farm = makeBuilding('farm-test-1', '0,0', { Bois: 5 })
    const hub = makeBuilding('hub-test-1', '1,0', { Bois: MAX_STOCK['Bois'] }) // saturé
    state.buildings.set(farm.id, farm)
    state.buildings.set(hub.id, hub)
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')

    flux.tick()

    const edge = state.edges.get('edge-farm-test-1-hub-test-1-Bois')
    expect(edge?.flow).toBe(0)
    expect(farm.stock['Bois']).toBe(5) // A accumule — inchangé
    expect(hub.stock['Bois']).toBe(MAX_STOCK['Bois']) // B toujours plein
  })

  it('AC#5 — B non saturé → edge.flow > 0, stocks mis à jour', () => {
    const farm = makeBuilding('farm-test-1', '0,0', { Bois: 5 })
    const hub = makeBuilding('hub-test-1', '1,0', { Bois: 0 })
    state.buildings.set(farm.id, farm)
    state.buildings.set(hub.id, hub)
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')

    flux.tick()

    const edge = state.edges.get('edge-farm-test-1-hub-test-1-Bois')
    expect(edge?.flow).toBeGreaterThan(0)
    expect(hub.stock['Bois']).toBeGreaterThan(0)   // B a reçu
    expect(farm.stock['Bois']).toBeLessThan(5)       // A a été débité
  })

  it('source vide → edge.flow = 0', () => {
    const farm = makeBuilding('farm-test-1', '0,0', { Bois: 0 })
    const hub = makeBuilding('hub-test-1', '1,0', { Bois: 0 })
    state.buildings.set(farm.id, farm)
    state.buildings.set(hub.id, hub)
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')

    flux.tick()

    const edge = state.edges.get('edge-farm-test-1-hub-test-1-Bois')
    expect(edge?.flow).toBe(0)
    expect(hub.stock['Bois']).toBe(0)
  })

  it('tick() sur graphe vide ne throw pas', () => {
    expect(() => flux.tick()).not.toThrow()
  })

  it('edge orphelin (building absent) → flow = 0, pas de throw', () => {
    // Edge ajouté directement sans les buildings (simulation d'état incohérent)
    state.edges.set('edge-ghost-hub-test-1-Bois', {
      id: 'edge-ghost-hub-test-1-Bois',
      from: 'ghost',
      to: 'hub-test-1',
      resource: 'Bois',
      flow: 5,
      ratio: 100,
    })

    expect(() => flux.tick()).not.toThrow()
    const edge = state.edges.get('edge-ghost-hub-test-1-Bois')
    expect(edge?.flow).toBe(0)
  })

  it('snapshot T immuable — A→B et B→C au même tick : B distribue depuis snapshot (pas les ressources reçues de A)', () => {
    // A→B→C : B commence avec 0 Bois
    // A a 5 Bois, A→B transporte, B→C ne doit PAS transporter le Bois reçu de A (T+1)
    const nodeA = makeBuilding('farm-test-1', '0,0', { Bois: 5 })
    const nodeB = makeBuilding('hub-test-1', '1,0', { Bois: 0 })
    const nodeC = makeBuilding('mine-test-1', '2,0', { Bois: 0 })
    state.buildings.set(nodeA.id, nodeA)
    state.buildings.set(nodeB.id, nodeB)
    state.buildings.set(nodeC.id, nodeC)

    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    flux.addEdge('hub-test-1', 'mine-test-1', 'Bois')

    flux.tick()

    // B a reçu de A mais N'a PAS transféré à C (snapshot B = 0 au début du tick)
    expect(nodeB.stock['Bois']).toBeGreaterThan(0) // B a reçu de A
    expect(nodeC.stock['Bois']).toBe(0)             // C n'a rien reçu (snapshot B = 0)
  })

  it('M2 — source multi-edges : stock A ne dépasse pas son stock initial (anti over-commitment)', () => {
    // A (10 Bois) → B (vide) et A (10 Bois) → C (vide)
    // Sans fix, les deux edges voient snapshot=10, chacun transfère 10 → 20 total prélevés sur 10 disponibles
    const nodeA = makeBuilding('farm-test-1', '0,0', { Bois: 10 })
    const nodeB = makeBuilding('hub-test-1', '1,0', { Bois: 0 })
    const nodeC = makeBuilding('mine-test-1', '2,0', { Bois: 0 })
    state.buildings.set(nodeA.id, nodeA)
    state.buildings.set(nodeB.id, nodeB)
    state.buildings.set(nodeC.id, nodeC)

    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    flux.addEdge('farm-test-1', 'mine-test-1', 'Bois')

    flux.tick()

    // Total reçu par B et C ne peut pas dépasser le stock initial de A (10)
    const totalReceived = (nodeB.stock['Bois'] ?? 0) + (nodeC.stock['Bois'] ?? 0)
    expect(totalReceived).toBeLessThanOrEqual(10)
    // A ne doit pas être en négatif
    expect(nodeA.stock['Bois'] ?? 0).toBeGreaterThanOrEqual(0)
    // Invariant : ce que A a perdu = ce que B+C ont reçu
    const aLost = 10 - (nodeA.stock['Bois'] ?? 0)
    expect(totalReceived).toBe(aLost)
  })

  it('destination multi-inflows : stock destination ne dépasse pas maxStock', () => {
    // A→C et B→C : deux sources alimentent C (vide, maxStock=10)
    const nodeA = makeBuilding('farm-test-1', '0,0', { Bois: 8 })
    const nodeB = makeBuilding('mine-test-1', '1,0', { Bois: 8 })
    const nodeC = makeBuilding('hub-test-1', '2,0', { Bois: 0 })
    state.buildings.set(nodeA.id, nodeA)
    state.buildings.set(nodeB.id, nodeB)
    state.buildings.set(nodeC.id, nodeC)

    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    flux.addEdge('mine-test-1', 'hub-test-1', 'Bois')

    flux.tick()

    expect(nodeC.stock['Bois'] ?? 0).toBeLessThanOrEqual(MAX_STOCK['Bois'])
    expect(nodeC.stock['Bois'] ?? 0).toBeGreaterThanOrEqual(0)
  })

  it('ratio 50% → effective = floor(transferable * 0.5)', () => {
    const farm = makeBuilding('farm-test-1', '0,0', { Bois: 6 })
    const hub = makeBuilding('hub-test-1', '1,0', { Bois: 0 })
    state.buildings.set(farm.id, farm)
    state.buildings.set(hub.id, hub)
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')

    // Modifier le ratio à 50%
    const edge = state.edges.get('edge-farm-test-1-hub-test-1-Bois')!
    edge.ratio = 50

    flux.tick()

    expect(edge.flow).toBe(3) // Math.floor(6 * 50/100) = 3
    expect(hub.stock['Bois']).toBe(3)
    expect(farm.stock['Bois']).toBe(3)
  })
})

describe('FluxNetwork.tick — receivedSubsistance', () => {
  let state: SimulationState
  let flux: FluxNetwork

  beforeEach(() => {
    state = new SimulationState()
    flux = new FluxNetwork(state, MAX_STOCK)
  })

  it('Subsistance reçue → city.receivedSubsistance = true', () => {
    const farm = makeBuilding('farm-test-1', '1,0', { Subsistance: 5 })
    const hub = makeBuilding('hub-test-1', '0,0', { Subsistance: 0 }) // même hex que city
    const city = makeCity('city-test-1', '0,0')
    state.buildings.set(farm.id, farm)
    state.buildings.set(hub.id, hub)
    state.cities.set(city.id, city)
    flux.addEdge('farm-test-1', 'hub-test-1', 'Subsistance')

    flux.tick()

    expect(city.receivedSubsistance).toBe(true)
  })

  it('Subsistance non reçue (source vide) → city.receivedSubsistance reste false', () => {
    const farm = makeBuilding('farm-test-1', '1,0', { Subsistance: 0 }) // vide
    const hub = makeBuilding('hub-test-1', '0,0', { Subsistance: 0 })
    const city = makeCity('city-test-1', '0,0')
    state.buildings.set(farm.id, farm)
    state.buildings.set(hub.id, hub)
    state.cities.set(city.id, city)
    flux.addEdge('farm-test-1', 'hub-test-1', 'Subsistance')

    flux.tick()

    expect(city.receivedSubsistance).toBe(false)
  })

  it('Subsistance backpressure → city.receivedSubsistance reste false', () => {
    const farm = makeBuilding('farm-test-1', '1,0', { Subsistance: 5 })
    const hub = makeBuilding('hub-test-1', '0,0', { Subsistance: MAX_STOCK['Subsistance'] }) // saturé
    const city = makeCity('city-test-1', '0,0')
    state.buildings.set(farm.id, farm)
    state.buildings.set(hub.id, hub)
    state.cities.set(city.id, city)
    flux.addEdge('farm-test-1', 'hub-test-1', 'Subsistance')

    flux.tick()

    expect(city.receivedSubsistance).toBe(false) // flow = 0, pas de subsistance
  })
})

// ─── FluxNetwork.removeEdge ───────────────────────────────────────────────────

describe('FluxNetwork.removeEdge', () => {
  let state: SimulationState
  let flux: FluxNetwork

  beforeEach(() => {
    state = new SimulationState()
    flux = new FluxNetwork(state, MAX_STOCK)
  })

  it('removeEdge(A, B) supprime uniquement l\'edge A→B', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    flux.addEdge('farm-test-1', 'mine-test-1', 'Bois')

    flux.removeEdge('farm-test-1', 'hub-test-1')

    expect(state.edges.has('edge-farm-test-1-hub-test-1-Bois')).toBe(false)
    expect(state.edges.has('edge-farm-test-1-mine-test-1-Bois')).toBe(true)
  })

  it('removeEdge sur edge inexistant ne throw pas', () => {
    expect(() => flux.removeEdge('farm-test-1', 'hub-test-1')).not.toThrow()
  })

  it('removeEdge supprime tous les edges entre les deux nodes (tous types de ressource)', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    flux.addEdge('farm-test-1', 'hub-test-1', 'Subsistance')

    flux.removeEdge('farm-test-1', 'hub-test-1')

    expect(state.edges.size).toBe(0)
  })
})

// ─── FluxNetwork.removeEdgesFor ───────────────────────────────────────────────

describe('FluxNetwork.removeEdgesFor', () => {
  let state: SimulationState
  let flux: FluxNetwork

  beforeEach(() => {
    state = new SimulationState()
    flux = new FluxNetwork(state, MAX_STOCK)
  })

  it('AC#6 — removeEdgesFor(A) supprime tous les edges où from=A ou to=A', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    flux.addEdge('farm-test-1', 'mine-test-1', 'Bois')
    flux.addEdge('warehouse-test-1', 'farm-test-1', 'Fer') // to=A

    flux.removeEdgesFor('farm-test-1')

    expect(state.edges.size).toBe(0)
  })

  it('removeEdgesFor ne touche pas les edges qui ne concernent pas le building', () => {
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')
    flux.addEdge('mine-test-1', 'warehouse-test-1', 'Fer') // edge sans farm-test-1

    flux.removeEdgesFor('farm-test-1')

    expect(state.edges.has('edge-mine-test-1-warehouse-test-1-Fer')).toBe(true)
    expect(state.edges.size).toBe(1)
  })

  it('removeEdgesFor sur building sans edges ne throw pas', () => {
    expect(() => flux.removeEdgesFor('farm-test-1')).not.toThrow()
  })

  it('removeEdgesFor sur state vide ne throw pas', () => {
    expect(() => flux.removeEdgesFor('farm-test-1')).not.toThrow()
    expect(state.edges.size).toBe(0)
  })
})

// ─── AC#7 — N ticks headless ──────────────────────────────────────────────────

describe('FluxNetwork — N ticks headless', () => {
  it('AC#7 — N ticks avec backpressure active → city.civils >= 0', () => {
    const state = new SimulationState()
    const flux = new FluxNetwork(state, MAX_STOCK)

    // City avec civils initiaux
    const city = makeCity('city-test-1', '0,0')
    city.civils = 5
    state.cities.set(city.id, city)

    // Farm → Hub saturé (backpressure dès le tick 1)
    const farm = makeBuilding('farm-test-1', '1,0', { Subsistance: 10 })
    const hub = makeBuilding('hub-test-1', '0,0', { Subsistance: MAX_STOCK['Subsistance'] })
    state.buildings.set(farm.id, farm)
    state.buildings.set(hub.id, hub)
    flux.addEdge('farm-test-1', 'hub-test-1', 'Subsistance')

    // N ticks en mode accéléré
    for (let i = 0; i < 20; i++) {
      flux.tick()
    }

    expect(city.civils).toBeGreaterThanOrEqual(0)
  })

  it('N ticks avec flux actif — stocks restent dans les limites [0, maxStock]', () => {
    const state = new SimulationState()
    const flux = new FluxNetwork(state, MAX_STOCK)

    const farm = makeBuilding('farm-test-1', '0,0', { Bois: 10 })
    const hub = makeBuilding('hub-test-1', '1,0', { Bois: 0 })
    state.buildings.set(farm.id, farm)
    state.buildings.set(hub.id, hub)
    flux.addEdge('farm-test-1', 'hub-test-1', 'Bois')

    for (let i = 0; i < 10; i++) {
      flux.tick()
    }

    expect(farm.stock['Bois'] ?? 0).toBeGreaterThanOrEqual(0)
    expect(hub.stock['Bois'] ?? 0).toBeGreaterThanOrEqual(0)
    expect(hub.stock['Bois'] ?? 0).toBeLessThanOrEqual(MAX_STOCK['Bois'])
  })
})
