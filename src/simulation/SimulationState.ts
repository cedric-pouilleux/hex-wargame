export interface Building {
  id: string
  type: string                            // références BuildingDefinition.type (ex. "ferme")
  hexId: string                           // hex occupé
  workers: number                         // workers alloués ce tick (>= 0)
  stock: Partial<Record<string, number>>  // stock courant par ressource — absent = 0 implicite
  enabled: boolean                        // actif/inactif (FR05)
  status: 'active' | 'inactive' | 'under-construction'  // état visuel (FR30a)
}

export interface City {
  id: string
  hexId: string
  population: number            // habitants total
  civils: number                // disponibles pour allocation workers
  receivedSubsistance: boolean  // flag reset à chaque tick — utilisé par PopulationSystem (FR24)
}

export interface Edge {
  id: string
  from: string      // buildingId source
  to: string        // buildingId destination
  resource: string  // nom de ressource (ex. "Subsistance")
  flow: number      // débit courant (unités/tick) — 0 si backpressure
  ratio: number     // ratio d'allocation 0–100 (FR38, Story 3.8) — défaut 100
}

export type SimulationSnapshot = {
  readonly buildings: readonly Building[]
  readonly cities: readonly City[]
  readonly edges: readonly Edge[]
  readonly buildingOrder: readonly string[]
  readonly currentTick: number
  readonly money: number
}

export class SimulationState {
  readonly buildings = new Map<string, Building>()
  readonly cities = new Map<string, City>()
  readonly edges = new Map<string, Edge>()
  buildingOrder: string[] = []  // ordre insertion = priorité allocation workers
  currentTick = 0
  money = 0  // pool global Money (FR26)

  /**
   * Retourne un snapshot readonly du state courant.
   * Shallow copy : les tableaux sont des copies, mais les objets Building/City/Edge
   * à l'intérieur sont les mêmes références que dans les Maps — ne pas muter leurs propriétés.
   */
  getSnapshot(): SimulationSnapshot {
    return {
      buildings: [...this.buildings.values()],
      cities: [...this.cities.values()],
      edges: [...this.edges.values()],
      buildingOrder: [...this.buildingOrder],
      currentTick: this.currentTick,
      money: this.money,
    }
  }
}
