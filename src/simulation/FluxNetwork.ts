import type { SimulationState } from './SimulationState'
import type { IFluxNetwork } from './IFluxNetwork'

export class CyclicGraphError extends Error {
  constructor(from: string, to: string) {
    super(`Adding edge ${from}→${to} would create a cycle in the DAG`)
    this.name = 'CyclicGraphError'
  }
}

export class DuplicateEdgeError extends Error {
  constructor(id: string) {
    super(`Edge already exists: ${id}`)
    this.name = 'DuplicateEdgeError'
  }
}

export class FluxNetwork implements IFluxNetwork {
  private readonly state: SimulationState
  private readonly maxStockByResource: Readonly<Record<string, number>>

  constructor(state: SimulationState, maxStockByResource: Readonly<Record<string, number>>) {
    this.state = state
    this.maxStockByResource = maxStockByResource
  }

  /**
   * Ajoute un edge A→B pour un type de ressource donné.
   * Exécute un DFS complet avant insertion pour garantir l'absence de cycle (DAG invariant).
   * Throws CyclicGraphError si l'ajout créerait un cycle.
   * Throws DuplicateEdgeError si l'edge (from, to, resource) existe déjà.
   */
  addEdge(from: string, to: string, resource: string): void {
    const id = `edge-${from}-${to}-${resource}`

    // Guard doublon : fail-fast, cohérent avec BuildingRegistry.addBuilding
    if (this.state.edges.has(id)) {
      throw new DuplicateEdgeError(id)
    }

    // DFS anti-cycle : si `to` peut atteindre `from`, l'ajout créerait un cycle
    if (this.canReach(to, from)) {
      throw new CyclicGraphError(from, to)
    }

    this.state.edges.set(id, { id, from, to, resource, flow: 0, ratio: 100 })
  }

  /**
   * Supprime tous les edges de `from` vers `to` (indépendamment du type de ressource).
   * Collecte les IDs avant suppression — safe sur Map.
   */
  removeEdge(from: string, to: string): void {
    const toDelete: string[] = []
    for (const [id, edge] of this.state.edges.entries()) {
      if (edge.from === from && edge.to === to) {
        toDelete.push(id)
      }
    }
    for (const id of toDelete) {
      this.state.edges.delete(id)
    }
  }

  /**
   * Supprime tous les edges impliquant `buildingId` (comme source ou destination).
   * Implémente IFluxNetwork — appelé par BuildingRegistry.removeBuilding() atomique.
   * Collecte les IDs avant suppression — safe sur Map.
   */
  removeEdgesFor(buildingId: string): void {
    const toDelete: string[] = []
    for (const [id, edge] of this.state.edges.entries()) {
      if (edge.from === buildingId || edge.to === buildingId) {
        toDelete.push(id)
      }
    }
    for (const id of toDelete) {
      this.state.edges.delete(id)
    }
  }

  /**
   * Distribue les ressources en appliquant la règle T+1 latency.
   *
   * Sources : disponibilité lue depuis le snapshot T (immuable via remainingAvailable).
   *   → Garantit la T+1 latency : une ressource reçue par B au tick T ne peut pas
   *     être redistribuée par B au même tick.
   *   → Garantit l'anti over-commitment source : si A→B et A→C, A ne peut pas
   *     donner plus que son stock T total.
   *
   * Destinations : capacité lue depuis le state courant (post-mutations du tick).
   *   → Empêche l'overflow si plusieurs edges alimentent la même destination.
   *   → Backpressure correcte même avec inflows multiples.
   *
   * receivedSubsistance : si resource === 'Subsistance' (doit correspondre à resources.json#name)
   *   et effective > 0, les cities dont city.hexId === toBuilding.hexId reçoivent le flag
   *   (protocole PopulationSystem — FluxNetwork fixe AVANT l'exécution de PopulationSystem).
   */
  tick(): void {
    // remainingAvailable : snapshot T du stock source, décrémenté au fil des edges.
    // Anti over-commitment : A→B et A→C ne peuvent pas dépasser le stock T de A.
    const remainingAvailable = new Map<string, Partial<Record<string, number>>>()
    for (const [id, building] of this.state.buildings.entries()) {
      remainingAvailable.set(id, { ...building.stock })
    }

    for (const edge of this.state.edges.values()) {
      const fromBuilding = this.state.buildings.get(edge.from)
      const toBuilding = this.state.buildings.get(edge.to)

      // Défensif : edge orphelin (ne devrait pas exister si removeEdgesFor est appelé)
      if (fromBuilding === undefined || toBuilding === undefined) {
        edge.flow = 0
        continue
      }

      const maxStock = this.maxStockByResource[edge.resource] ?? Infinity

      // Capacité destination depuis état courant (post-mutations) — empêche l'overflow
      const toCurrentStock = toBuilding.stock[edge.resource] ?? 0
      if (toCurrentStock >= maxStock) {
        edge.flow = 0
        continue
      }

      // Disponibilité source depuis snapshot T (anti over-commitment)
      const fromAvailable = remainingAvailable.get(edge.from)?.[edge.resource] ?? 0
      if (fromAvailable <= 0) {
        edge.flow = 0
        continue
      }

      const capacity = maxStock - toCurrentStock
      const transferable = Math.min(fromAvailable, capacity)
      // Appliquer ratio FR38 (défaut 100) — Math.floor pour quantités entières
      const effective = Math.floor(transferable * edge.ratio / 100)

      edge.flow = effective

      // Décrémenter remainingAvailable source (anti over-commitment)
      const fromRem = remainingAvailable.get(edge.from) ?? {}
      fromRem[edge.resource] = Math.max(0, (fromRem[edge.resource] ?? 0) - effective)
      remainingAvailable.set(edge.from, fromRem)

      // Muter les stocks dans le state courant (seront le snapshot T+1)
      fromBuilding.stock[edge.resource] = Math.max(
        0,
        (fromBuilding.stock[edge.resource] ?? 0) - effective,
      )
      // Cap à maxStock — protection overflow destination (inflows multiples)
      toBuilding.stock[edge.resource] = Math.min(
        maxStock,
        Math.max(0, toCurrentStock + effective),
      )

      // Protocole receivedSubsistance : FluxNetwork fixe le flag AVANT PopulationSystem
      // 'Subsistance' doit correspondre au nom de ressource dans resources.json
      if (edge.resource === 'Subsistance' && effective > 0) {
        for (const city of this.state.cities.values()) {
          if (city.hexId === toBuilding.hexId) {
            city.receivedSubsistance = true
          }
        }
      }
    }
  }

  /**
   * Vérifie si `target` est atteignable depuis `from` dans le graphe actuel (DFS).
   * Utilisé par addEdge pour garantir l'invariant DAG.
   */
  private canReach(from: string, target: string): boolean {
    const visited = new Set<string>()
    return this.dfs(from, target, visited)
  }

  private dfs(current: string, target: string, visited: Set<string>): boolean {
    if (current === target) return true
    if (visited.has(current)) return false
    visited.add(current)
    for (const edge of this.state.edges.values()) {
      if (edge.from === current) {
        if (this.dfs(edge.to, target, visited)) return true
      }
    }
    return false
  }
}
