import type { SimulationState } from './SimulationState'
import type { GameConfig } from './GameConfig'

export class PopulationSystem {
  private readonly state: SimulationState
  private readonly config: Readonly<GameConfig>

  constructor(state: SimulationState, config: Readonly<GameConfig>) {
    this.state = state
    this.config = config
  }

  /**
   * Appelé à chaque tick par TickOrchestrator.
   * Ordre : croissance → famine → recalcul civils → reset receivedSubsistance.
   *
   * "Délai famine 1 tick" : comportement intentionnel — FluxNetwork fixe le flag
   * AVANT que PopulationSystem s'exécute dans l'ordre du tick.
   * Ville à 0 jamais supprimée (architecture §Failure Mode Preventions §PopulationSystem).
   */
  tick(currentTick: number): void {
    for (const city of this.state.cities.values()) {
      if (currentTick % this.config.populationGrowthPeriod === 0 && city.receivedSubsistance) {
        city.population = Math.min(this.config.populationMax, Math.max(0, city.population + 1))
      }
      if (currentTick % this.config.faminePeriod === 0 && !city.receivedSubsistance) {
        city.population = Math.max(0, city.population - 2)
      }
      // Sans militaryRatio (introduit Story 4.4) : civils = population
      city.civils = Math.max(0, city.population)
      city.receivedSubsistance = false
    }
  }

  /**
   * Distribue les workers aux bâtiments en ordre de buildingOrder (priorité d'allocation).
   * Chaque bâtiment reçoit 1 worker (demande POC) dans la limite des civils disponibles.
   * Appelé par TickOrchestrator après tick().
   */
  allocateWorkers(): void {
    let remainingCivils = 0
    for (const city of this.state.cities.values()) {
      remainingCivils += city.civils
    }
    remainingCivils = Math.max(0, remainingCivils)

    for (const id of this.state.buildingOrder) {
      const building = this.state.buildings.get(id)
      if (building === undefined) continue
      building.workers = Math.min(1, remainingCivils)
      remainingCivils = Math.max(0, remainingCivils - building.workers)
    }
  }
}
