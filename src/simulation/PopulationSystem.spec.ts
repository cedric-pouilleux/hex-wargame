import { describe, it, expect, beforeEach } from 'vitest'
import { PopulationSystem } from './PopulationSystem'
import { SimulationState, type City, type Building } from './SimulationState'
import { DEFAULT_CONFIG, type GameConfig } from './GameConfig'

// ─── Config de test ────────────────────────────────────────────────────────────
// populationGrowthPeriod=10 ET faminePeriod=10 pour que les ACs correspondent
// au rythme "+1/10s" et "-2/10s" (DEFAULT_CONFIG.faminePeriod=5 déclencherait 2 famines)

const testConfig: GameConfig = {
  ...DEFAULT_CONFIG,
  populationGrowthPeriod: 10,
  faminePeriod: 10,
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCity(id: string, population: number, civils?: number): City {
  return {
    id,
    hexId: '0,0',
    population,
    civils: civils ?? population,
    receivedSubsistance: false,
  }
}

function makeBuilding(id: string, hexId: string): Building {
  return { id, type: 'ferme', hexId, workers: 0, stock: {}, enabled: true, status: 'active' }
}

// ─── PopulationSystem.tick ────────────────────────────────────────────────────

describe('PopulationSystem.tick — croissance', () => {
  let state: SimulationState
  let system: PopulationSystem

  beforeEach(() => {
    state = new SimulationState()
    system = new PopulationSystem(state, testConfig)
  })

  it('AC#1 — 10 ticks avec subsistance → population passe de 10 à 11', () => {
    const city = makeCity('city-test-1', 10)
    state.cities.set('city-test-1', city)

    for (let t = 1; t <= 10; t++) {
      city.receivedSubsistance = true  // simule FluxNetwork
      system.tick(t)
    }

    expect(city.population).toBe(11)
  })

  it('croissance ne s\'applique pas aux ticks non-multiples de growthPeriod', () => {
    const city = makeCity('city-test-1', 10)
    state.cities.set('city-test-1', city)

    for (let t = 1; t <= 9; t++) {
      city.receivedSubsistance = true
      system.tick(t)
    }

    expect(city.population).toBe(10) // aucun multiple de 10 atteint
  })

  it('AC#6 — croissance plafonnée à populationMax', () => {
    const city = makeCity('city-test-1', testConfig.populationMax)
    state.cities.set('city-test-1', city)

    city.receivedSubsistance = true
    system.tick(10)

    expect(city.population).toBe(testConfig.populationMax)
  })
})

describe('PopulationSystem.tick — famine', () => {
  let state: SimulationState
  let system: PopulationSystem

  beforeEach(() => {
    state = new SimulationState()
    system = new PopulationSystem(state, testConfig)
  })

  it('AC#2 — 10 ticks sans subsistance → population passe de 10 à 8', () => {
    const city = makeCity('city-test-1', 10)
    state.cities.set('city-test-1', city)

    for (let t = 1; t <= 10; t++) {
      // receivedSubsistance reste false (remis à false par tick())
      system.tick(t)
    }

    expect(city.population).toBe(8)
  })

  it('AC#4 — famine avec population faible → jamais négatif (Math.max guard)', () => {
    const city = makeCity('city-test-1', 1)
    state.cities.set('city-test-1', city)

    system.tick(10) // famine -2 sur population=1

    expect(city.population).toBe(0)
    expect(city.population).toBeGreaterThanOrEqual(0)
  })

  it('famine ne s\'applique pas aux ticks non-multiples de faminePeriod', () => {
    const city = makeCity('city-test-1', 10)
    state.cities.set('city-test-1', city)

    for (let t = 1; t <= 9; t++) {
      system.tick(t)
    }

    expect(city.population).toBe(10)
  })

  it('ville à 0 jamais supprimée du state', () => {
    const city = makeCity('city-test-1', 0)
    state.cities.set('city-test-1', city)

    system.tick(10)

    expect(state.cities.has('city-test-1')).toBe(true)
    expect(city.population).toBe(0)
  })
})

describe('PopulationSystem.tick — civils et reset', () => {
  let state: SimulationState
  let system: PopulationSystem

  beforeEach(() => {
    state = new SimulationState()
    system = new PopulationSystem(state, testConfig)
  })

  it('AC#5 — receivedSubsistance remis à false après tick', () => {
    const city = makeCity('city-test-1', 10)
    state.cities.set('city-test-1', city)
    city.receivedSubsistance = true

    system.tick(1)

    expect(city.receivedSubsistance).toBe(false)
  })

  it('civils mis à jour après croissance', () => {
    const city = makeCity('city-test-1', 10)
    state.cities.set('city-test-1', city)

    city.receivedSubsistance = true
    system.tick(10)

    expect(city.civils).toBe(11)
  })

  it('civils mis à jour après famine', () => {
    const city = makeCity('city-test-1', 10)
    state.cities.set('city-test-1', city)

    system.tick(10)

    expect(city.civils).toBe(8)
  })

  it('civils jamais négatif (Math.max guard)', () => {
    const city = makeCity('city-test-1', 1)
    state.cities.set('city-test-1', city)

    system.tick(10) // famine → population 0

    expect(city.civils).toBeGreaterThanOrEqual(0)
  })
})

// ─── PopulationSystem.allocateWorkers ─────────────────────────────────────────

describe('PopulationSystem.allocateWorkers', () => {
  let state: SimulationState
  let system: PopulationSystem

  beforeEach(() => {
    state = new SimulationState()
    system = new PopulationSystem(state, testConfig)
  })

  it('AC#3 — 5 civils, 10 bâtiments → sum(workers) ≤ 5', () => {
    const city = makeCity('city-test-1', 5, 5)
    state.cities.set('city-test-1', city)

    for (let i = 0; i < 10; i++) {
      const building = makeBuilding(`farm-test-${i + 1}`, `${i},0`)
      state.buildings.set(building.id, building)
      state.buildingOrder.push(building.id)
    }

    system.allocateWorkers()

    let total = 0
    for (const b of state.buildings.values()) total += b.workers
    expect(total).toBeLessThanOrEqual(5)
  })

  it('AC#3 — city.civils reste ≥ 0 après allocateWorkers', () => {
    const city = makeCity('city-test-1', 5, 5)
    state.cities.set('city-test-1', city)

    for (let i = 0; i < 10; i++) {
      const building = makeBuilding(`farm-test-${i + 1}`, `${i},0`)
      state.buildings.set(building.id, building)
      state.buildingOrder.push(building.id)
    }

    system.allocateWorkers()

    expect(city.civils).toBeGreaterThanOrEqual(0)
  })

  it('les premiers bâtiments dans buildingOrder ont la priorité', () => {
    const city = makeCity('city-test-1', 2, 2)
    state.cities.set('city-test-1', city)

    const farm = makeBuilding('farm-test-1', '0,0')
    const mine = makeBuilding('mine-test-1', '1,0')
    const warehouse = makeBuilding('warehouse-test-1', '2,0')
    state.buildings.set(farm.id, farm)
    state.buildings.set(mine.id, mine)
    state.buildings.set(warehouse.id, warehouse)
    state.buildingOrder.push(farm.id, mine.id, warehouse.id)

    system.allocateWorkers()

    expect(farm.workers).toBe(1)
    expect(mine.workers).toBe(1)
    expect(warehouse.workers).toBe(0) // civils épuisés
  })

  it('state vide — allocateWorkers ne throw pas', () => {
    expect(() => system.allocateWorkers()).not.toThrow()
  })

  it('0 civils — tous les bâtiments reçoivent 0 worker', () => {
    const city = makeCity('city-test-1', 0, 0)
    state.cities.set('city-test-1', city)

    const farm = makeBuilding('farm-test-1', '0,0')
    state.buildings.set(farm.id, farm)
    state.buildingOrder.push(farm.id)

    system.allocateWorkers()

    expect(farm.workers).toBe(0)
  })
})
