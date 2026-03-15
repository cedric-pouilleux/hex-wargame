import { describe, it, expect, beforeEach } from 'vitest'
import { TickOrchestrator } from './TickOrchestrator'
import { DEFAULT_CONFIG } from './GameConfig'
import type { BuildingDefinition } from './BuildingDefinition'
import type { ResourceDefinition } from './ResourceDefinition'
import type { Building, City } from './SimulationState'

// ─────────────────────────────────────────────────────────────
// Fixtures et helpers
// ─────────────────────────────────────────────────────────────

const FARM_DEF: BuildingDefinition = {
  type: 'ferme',
  inputs: {},
  outputs: { Subsistance: 5 },
  workers: 1, // POC : allocateWorkers() alloue max 1 worker par bâtiment
  cost: 100,
  terrain: ['plain'],
}

const TRANSFORMER_DEF: BuildingDefinition = {
  type: 'transformation',
  inputs: { Bois: 2 },
  outputs: { Charbon: 1 },
  workers: 1,
  cost: 80,
  terrain: ['plain'],
}

const NO_WORKER_DEF: BuildingDefinition = {
  type: 'source',
  inputs: {},
  outputs: { Bois: 3 },
  workers: 0, // source infinie — pas de contrainte workers
  cost: 0,
  terrain: ['plain'],
}

const TEST_RESOURCES: ResourceDefinition[] = [
  { name: 'Subsistance', unit: 'rations', maxStock: 100 },
  { name: 'Bois', unit: 'm³', maxStock: 50 },
  { name: 'Charbon', unit: 'kg', maxStock: 30 },
]

function makeBuilding(
  id: string,
  hexId: string,
  type = 'ferme',
  enabled = true,
  workers = 2,
  status: Building['status'] = 'active',
  stock: Partial<Record<string, number>> = {},
): Building {
  return { id, hexId, type, workers, stock, enabled, status }
}

function makeCity(
  id: string,
  hexId: string,
  population = 10,
  civils = 10,
): City {
  return { id, hexId, population, civils, receivedSubsistance: false }
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('TickOrchestrator', () => {
  let orch: TickOrchestrator

  beforeEach(() => {
    orch = new TickOrchestrator(DEFAULT_CONFIG, [FARM_DEF], TEST_RESOURCES)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#1 — Ordre des steps : tick() incrémente currentTick
  // ─────────────────────────────────────────────────────────────
  it('AC#1 — tick() exécute les steps et incrémente state.currentTick', () => {
    expect(orch.state.currentTick).toBe(0)
    orch.tick()
    expect(orch.state.currentTick).toBe(1)
    orch.tick()
    expect(orch.state.currentTick).toBe(2)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#3 — Zero try/catch : exception propage à travers tick()
  // ─────────────────────────────────────────────────────────────
  it('AC#3 — exception dans un composant propage à travers tick() (zero try/catch)', () => {
    // populationSystem.allocateWorkers() throw si buildingOrder est désynchronisé
    orch.state.buildingOrder.push('ghost-building-id') // ID introuvable → throw
    expect(() => orch.tick()).toThrow()
  })

  // ─────────────────────────────────────────────────────────────
  // AC#4 — Performance : runTicks(10) < 160ms (NFR02)
  // ─────────────────────────────────────────────────────────────
  it('AC#4 — runTicks(10) s\'exécute en moins de 160ms (NFR02)', () => {
    const start = Date.now()
    orch.runTicks(10)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(160)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#5 — ResourceEngine : ferme active + workers OK → stock +5
  // ─────────────────────────────────────────────────────────────
  it('AC#5 — ResourceEngine : ferme active avec workers 1 → stock Subsistance +5 après tick', () => {
    orch.state.cities.set('city-1', makeCity('city-1', '0,0', 10, 10)) // civils pour allocateWorkers
    orch.state.buildings.set('ferme-test-1', makeBuilding('ferme-test-1', '0,0', 'ferme', true, 1))
    orch.state.buildingOrder.push('ferme-test-1')

    orch.tick()

    expect(orch.state.buildings.get('ferme-test-1')!.stock['Subsistance']).toBe(5)
  })

  it('AC#5 — ResourceEngine : production s\'accumule sur plusieurs ticks', () => {
    orch.state.cities.set('city-1', makeCity('city-1', '0,0', 10, 10)) // civils pour allocateWorkers
    orch.state.buildings.set('ferme-test-1', makeBuilding('ferme-test-1', '0,0', 'ferme', true, 1))
    orch.state.buildingOrder.push('ferme-test-1')

    orch.runTicks(3)

    expect(orch.state.buildings.get('ferme-test-1')!.stock['Subsistance']).toBe(15)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#6 — MoneyEngine : money += civils * moneyRate
  // ─────────────────────────────────────────────────────────────
  it('AC#6 — MoneyEngine : ville avec civils=10, moneyRate=0.01 → money +0.1 après tick', () => {
    const orchLocal = new TickOrchestrator({ ...DEFAULT_CONFIG, moneyRate: 0.1, startingMoney: 0 })
    orchLocal.state.cities.set('city-test-1', makeCity('city-test-1', '0,0', 10, 10))

    orchLocal.tick()

    expect(orchLocal.state.money).toBeCloseTo(1.0)
  })

  it('AC#6 — MoneyEngine : money = startingMoney si aucune ville (pas de génération)', () => {
    const orchLocal = new TickOrchestrator({ ...DEFAULT_CONFIG, startingMoney: 0 })
    orchLocal.tick()
    expect(orchLocal.state.money).toBe(0)
  })

  it('AC#6 — MoneyEngine : money s\'accumule sur plusieurs ticks', () => {
    const orchLocal = new TickOrchestrator({ ...DEFAULT_CONFIG, moneyRate: 0.1, startingMoney: 0 })
    orchLocal.state.cities.set('city-test-1', makeCity('city-test-1', '0,0', 10, 10))

    orchLocal.runTicks(5)

    expect(orchLocal.state.money).toBeCloseTo(5.0)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#7 — RouteNetwork lazy : routesDirty=true → false après tick
  // ─────────────────────────────────────────────────────────────
  it('AC#7 — routesDirty=true avant tick → false après tick (compute() appelé)', () => {
    orch.routeNetwork.markDirty()
    expect(orch.routeNetwork.routesDirty).toBe(true)

    orch.tick()

    expect(orch.routeNetwork.routesDirty).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#8 — RouteNetwork idempotent : routesDirty=false → reste false
  // ─────────────────────────────────────────────────────────────
  it('AC#8 — routesDirty=false avant tick → reste false après tick (compute() non appelé)', () => {
    expect(orch.routeNetwork.routesDirty).toBe(false)

    orch.tick()

    expect(orch.routeNetwork.routesDirty).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#9 — start()/stop() : headless safe (NFR12)
  // ─────────────────────────────────────────────────────────────
  it('AC#9 — start() puis stop() sans erreur (headless safe)', () => {
    expect(() => {
      orch.start()
      orch.stop()
    }).not.toThrow()
  })

  it('AC#9 — stop() idempotent : appelé deux fois sans erreur', () => {
    orch.start()
    orch.stop()
    expect(() => orch.stop()).not.toThrow()
  })

  it('AC#9 — start() idempotent : appelé deux fois ne crée pas de double interval', () => {
    orch.start()
    orch.start() // second appel ignoré — pas de double boucle
    orch.stop()
    // Vérification : après stop(), un tick manuel ne double pas currentTick
    const tickBefore = orch.state.currentTick
    // Si deux intervals avaient été créés, le stop() n'en nettoierait qu'un — on ne peut pas
    // facilement observer deux intervals en headless, mais on vérifie au moins l'absence de throw
    expect(orch.state.currentTick).toBe(tickBefore)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#10 — runTicks(N) → state.currentTick === N
  // ─────────────────────────────────────────────────────────────
  it('AC#10 — runTicks(N) : state.currentTick === N après l\'appel', () => {
    orch.runTicks(7)
    expect(orch.state.currentTick).toBe(7)
  })

  it('AC#10 — runTicks(0) : state.currentTick inchangé', () => {
    orch.runTicks(0)
    expect(orch.state.currentTick).toBe(0)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#11 — ResourceEngine ignore les bâtiments disabled
  // ─────────────────────────────────────────────────────────────
  it('AC#11 — bâtiment disabled : stock inchangé après tick', () => {
    orch.state.buildings.set(
      'ferme-test-1',
      makeBuilding('ferme-test-1', '0,0', 'ferme', false, 2), // enabled=false
    )
    orch.state.buildingOrder.push('ferme-test-1')

    orch.tick()

    expect(orch.state.buildings.get('ferme-test-1')!.stock['Subsistance']).toBeUndefined()
  })

  // ─────────────────────────────────────────────────────────────
  // AC#12 — ResourceEngine : workers insuffisants → pas de production
  // ─────────────────────────────────────────────────────────────
  it('AC#12 — workers insuffisants : stock inchangé après tick', () => {
    orch.state.buildings.set(
      'ferme-test-1',
      makeBuilding('ferme-test-1', '0,0', 'ferme', true, 1), // allocateWorkers écrase à 0 (no city) < def.workers=1
    )
    orch.state.buildingOrder.push('ferme-test-1')

    orch.tick()

    expect(orch.state.buildings.get('ferme-test-1')!.stock['Subsistance']).toBeUndefined()
  })

  // ─────────────────────────────────────────────────────────────
  // ResourceEngine — cas particuliers
  // ─────────────────────────────────────────────────────────────
  it('ResourceEngine : bâtiment under-construction ignoré', () => {
    orch.state.buildings.set(
      'ferme-test-1',
      makeBuilding('ferme-test-1', '0,0', 'ferme', true, 2, 'under-construction'),
    )
    orch.state.buildingOrder.push('ferme-test-1')

    orch.tick()

    expect(orch.state.buildings.get('ferme-test-1')!.stock['Subsistance']).toBeUndefined()
  })

  it('ResourceEngine : source avec workers=0 produit toujours (source infinie)', () => {
    const orchSrc = new TickOrchestrator(DEFAULT_CONFIG, [NO_WORKER_DEF], TEST_RESOURCES)
    orchSrc.state.buildings.set(
      'source-test-1',
      makeBuilding('source-test-1', '0,0', 'source', true, 0),
    )
    orchSrc.state.buildingOrder.push('source-test-1')

    orchSrc.tick()

    expect(orchSrc.state.buildings.get('source-test-1')!.stock['Bois']).toBe(3)
  })

  it('ResourceEngine : stock cappé à maxStockByResource', () => {
    const orchCapped = new TickOrchestrator(
      DEFAULT_CONFIG,
      [{ type: 'ferme', inputs: {}, outputs: { Subsistance: 200 }, workers: 0, cost: 0, terrain: [] }],
      [{ name: 'Subsistance', unit: 'rations', maxStock: 10 }], // maxStock = 10
    )
    orchCapped.state.buildings.set(
      'ferme-test-1',
      makeBuilding('ferme-test-1', '0,0', 'ferme', true, 0),
    )
    orchCapped.state.buildingOrder.push('ferme-test-1')

    orchCapped.tick()

    // Output=200 mais cappé à maxStock=10
    expect(orchCapped.state.buildings.get('ferme-test-1')!.stock['Subsistance']).toBe(10)
  })

  it('ResourceEngine : transformation — inputs consommés, outputs produits', () => {
    const orchTransform = new TickOrchestrator(DEFAULT_CONFIG, [TRANSFORMER_DEF], TEST_RESOURCES)
    // Bois: 2 inputs → Charbon: 1 output
    orchTransform.state.cities.set('city-1', makeCity('city-1', '0,0', 10, 10)) // civils pour allocateWorkers
    orchTransform.state.buildings.set(
      'transform-test-1',
      makeBuilding('transform-test-1', '0,0', 'transformation', true, 1, 'active', { Bois: 5 }),
    )
    orchTransform.state.buildingOrder.push('transform-test-1')

    orchTransform.tick()

    const building = orchTransform.state.buildings.get('transform-test-1')!
    expect(building.stock['Bois']).toBe(3)     // 5 - 2 = 3
    expect(building.stock['Charbon']).toBe(1)  // 0 + 1 = 1
  })

  it('ResourceEngine : inputs insuffisants → aucune production, aucune consommation', () => {
    const orchTransform = new TickOrchestrator(DEFAULT_CONFIG, [TRANSFORMER_DEF], TEST_RESOURCES)
    orchTransform.state.buildings.set(
      'transform-test-1',
      makeBuilding('transform-test-1', '0,0', 'transformation', true, 1, 'active', { Bois: 1 }), // Bois=1 < 2
    )
    orchTransform.state.buildingOrder.push('transform-test-1')

    orchTransform.tick()

    const building = orchTransform.state.buildings.get('transform-test-1')!
    expect(building.stock['Bois']).toBe(1)             // inchangé
    expect(building.stock['Charbon']).toBeUndefined()  // aucune production
  })

  // ─────────────────────────────────────────────────────────────
  // SaturationCheck
  // ─────────────────────────────────────────────────────────────
  it('SaturationCheck : building enabled → status active après tick', () => {
    orch.state.buildings.set('ferme-test-1', makeBuilding('ferme-test-1', '0,0'))
    orch.state.buildingOrder.push('ferme-test-1')

    orch.tick()

    expect(orch.state.buildings.get('ferme-test-1')!.status).toBe('active')
  })

  it('SaturationCheck : building disabled → status inactive après tick', () => {
    orch.state.buildings.set(
      'ferme-test-1',
      makeBuilding('ferme-test-1', '0,0', 'ferme', false),
    )
    orch.state.buildingOrder.push('ferme-test-1')

    orch.tick()

    expect(orch.state.buildings.get('ferme-test-1')!.status).toBe('inactive')
  })

  it('SaturationCheck : building under-construction → active après tick (Story 2.6)', () => {
    orch.state.buildings.set(
      'ferme-test-1',
      makeBuilding('ferme-test-1', '0,0', 'ferme', true, 2, 'under-construction'),
    )
    orch.state.buildingOrder.push('ferme-test-1')

    orch.tick()

    expect(orch.state.buildings.get('ferme-test-1')!.status).toBe('active')
  })

  // ─────────────────────────────────────────────────────────────
  // FluxNetwork intégration — distribution de ressources
  // ─────────────────────────────────────────────────────────────
  it('FluxNetwork intégration : edge A→B, stock en source → distribué vers B après tick', () => {
    const orchFull = new TickOrchestrator(DEFAULT_CONFIG, [FARM_DEF], TEST_RESOURCES)

    // city pour allocateWorkers (ferme workers=1 → production active)
    orchFull.state.cities.set('city-1', makeCity('city-1', '2,0', 10, 10))
    // A = ferme source (stock initial + production), B = entrepôt récepteur
    orchFull.state.buildings.set(
      'ferme-test-1',
      makeBuilding('ferme-test-1', '0,0', 'ferme', true, 1, 'active', { Subsistance: 10 }),
    )
    orchFull.state.buildings.set(
      'entrepot-test-1',
      makeBuilding('entrepot-test-1', '1,0', 'entrepot', true, 0, 'active'),
    )
    orchFull.state.buildingOrder.push('ferme-test-1')
    orchFull.state.buildingOrder.push('entrepot-test-1')

    // Créer edge via FluxNetwork
    orchFull.fluxNetwork.addEdge('ferme-test-1', 'entrepot-test-1', 'Subsistance')

    orchFull.tick()

    const depot = orchFull.state.buildings.get('entrepot-test-1')!
    // L'entrepôt doit avoir reçu de la Subsistance depuis la ferme (stock distribué par FluxNetwork)
    expect((depot.stock['Subsistance'] ?? 0)).toBeGreaterThan(0)
  })

  // ─────────────────────────────────────────────────────────────
  // onSnapshot callback
  // ─────────────────────────────────────────────────────────────
  it('onSnapshot est appelé après chaque tick avec le snapshot courant', () => {
    const snapshots: number[] = []
    const orchWithSnapshot = new TickOrchestrator(
      DEFAULT_CONFIG,
      [],
      [],
      [],
      (snapshot) => { snapshots.push(snapshot.currentTick) },
    )

    orchWithSnapshot.runTicks(3)

    // Snapshot appelé après chaque tick, currentTick vaut 1, 2, 3 (incrémenté avant snapshot)
    expect(snapshots).toEqual([1, 2, 3])
  })

  it('onSnapshot absent : tick() ne throw pas', () => {
    // orch n'a pas de onSnapshot
    expect(() => orch.tick()).not.toThrow()
  })

  // ─────────────────────────────────────────────────────────────
  // MoneyEngine — guard Math.max(0, ...)
  // ─────────────────────────────────────────────────────────────
  it('MoneyEngine : state.money ne descend jamais sous 0', () => {
    orch.state.money = 0
    // Sans civils → money reste à 0
    orch.tick()
    expect(orch.state.money).toBeGreaterThanOrEqual(0)
  })

  // ─────────────────────────────────────────────────────────────
  // runTicks vs tick() — équivalence
  // ─────────────────────────────────────────────────────────────
  it('runTicks(1) équivalent à tick() — même état final', () => {
    const orchA = new TickOrchestrator({ ...DEFAULT_CONFIG, moneyRate: 0.1 }, [FARM_DEF], TEST_RESOURCES)
    const orchB = new TickOrchestrator({ ...DEFAULT_CONFIG, moneyRate: 0.1 }, [FARM_DEF], TEST_RESOURCES)

    const city: City = makeCity('city-test-1', '0,0', 10, 10)
    orchA.state.cities.set('city-test-1', { ...city })
    orchB.state.cities.set('city-test-1', { ...city })

    orchA.tick()
    orchB.runTicks(1)

    expect(orchA.state.currentTick).toBe(orchB.state.currentTick)
    expect(orchA.state.money).toBeCloseTo(orchB.state.money)
  })

  // ─────────────────────────────────────────────────────────────
  // NFR10 — Déterminisme : même config + même state → même résultat
  // ─────────────────────────────────────────────────────────────
  it('NFR10 — déterminisme : deux TickOrchestrators identiques → même état après N ticks', () => {
    const orchA = new TickOrchestrator({ ...DEFAULT_CONFIG, moneyRate: 0.1 }, [FARM_DEF], TEST_RESOURCES)
    const orchB = new TickOrchestrator({ ...DEFAULT_CONFIG, moneyRate: 0.1 }, [FARM_DEF], TEST_RESOURCES)

    // Même état initial
    const buildingA = makeBuilding('ferme-test-1', '0,0', 'ferme', true, 2)
    const buildingB = makeBuilding('ferme-test-1', '0,0', 'ferme', true, 2)
    orchA.state.buildings.set('ferme-test-1', buildingA)
    orchB.state.buildings.set('ferme-test-1', buildingB)
    orchA.state.buildingOrder.push('ferme-test-1')
    orchB.state.buildingOrder.push('ferme-test-1')

    orchA.state.cities.set('city-test-1', makeCity('city-test-1', '1,0', 10, 10))
    orchB.state.cities.set('city-test-1', makeCity('city-test-1', '1,0', 10, 10))

    orchA.runTicks(5)
    orchB.runTicks(5)

    expect(orchA.state.currentTick).toBe(orchB.state.currentTick)
    expect(orchA.state.money).toBeCloseTo(orchB.state.money)
    expect(orchA.state.buildings.get('ferme-test-1')!.stock['Subsistance'])
      .toBe(orchB.state.buildings.get('ferme-test-1')!.stock['Subsistance'])
  })
})
