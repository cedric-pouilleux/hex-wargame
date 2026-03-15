import type { SimulationState, Building } from './SimulationState'
import type { IFluxNetwork } from './IFluxNetwork'
import type { HexMap } from './HexMap'

export class BuildingNotFoundError extends Error {
  constructor(id: string) {
    super(`Building not found: ${id}`)
    this.name = 'BuildingNotFoundError'
  }
}

export class WorkerInvariantError extends Error {
  constructor(total: number, civils: number) {
    super(`Worker invariant violated: ${total} workers > ${civils} civils`)
    this.name = 'WorkerInvariantError'
  }
}

export class BuildingRegistry {
  private readonly state: SimulationState
  private readonly fluxNetwork: IFluxNetwork
  private readonly hexMap: HexMap

  constructor(state: SimulationState, fluxNetwork: IFluxNetwork, hexMap: HexMap) {
    this.state = state
    this.fluxNetwork = fluxNetwork
    this.hexMap = hexMap
  }

  addBuilding(building: Building): void {
    if (this.state.buildings.has(building.id)) {
      throw new Error(`Building already registered: ${building.id}`)
    }
    this.hexMap.claimHex(building.hexId, building.id)
    this.state.buildings.set(building.id, building)
    this.state.buildingOrder.push(building.id)
  }

  /**
   * Suppression atomique : retire le bâtiment du registry, nettoie ses edges FluxNetwork,
   * et libère sa tile HexMap — en une seule opération synchrone.
   * Throw BuildingNotFoundError si l'id est inconnu (fail-fast).
   */
  removeBuilding(id: string): void {
    const building = this.state.buildings.get(id)
    if (building === undefined) {
      throw new BuildingNotFoundError(id)
    }
    this.state.buildings.delete(id)
    const idx = this.state.buildingOrder.indexOf(id)
    if (idx === -1) {
      throw new Error(`buildingOrder out of sync: ${id} in buildings but not in buildingOrder`)
    }
    this.state.buildingOrder.splice(idx, 1)
    this.fluxNetwork.removeEdgesFor(id)
    this.hexMap.releaseHex(building.hexId)
  }

  /**
   * Assertion de fin de tick (architecture §Failure Mode Preventions §BuildingRegistry).
   * Throw si sum(allocatedWorkers) > civils — détecte les incohérences d'allocation.
   * Appelé par TickOrchestrator (Story 1.10) après PopulationSystem.allocateWorkers().
   */
  assertWorkersConsistency(civils: number): void {
    let total = 0
    for (const building of this.state.buildings.values()) {
      total += building.workers
    }
    if (total > civils) {
      throw new WorkerInvariantError(total, civils)
    }
  }
}
