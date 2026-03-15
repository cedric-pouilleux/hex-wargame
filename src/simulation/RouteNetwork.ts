import type { GameConfig } from './GameConfig'

export class RouteNetwork {
  private readonly config: Readonly<GameConfig>
  // Graphe non-directionnel : hexId → Set des hexes adjacents via route
  private readonly adjacency = new Map<string, Set<string>>()
  // Résultat de compute() : hexId → Set des hexes atteignables via routes
  private reachable = new Map<string, Set<string>>()

  routesDirty = false // public — lu par TickOrchestrator (Story 1.10)

  constructor(config: Readonly<GameConfig>) {
    this.config = config
  }

  /**
   * Ajoute une route non-directionnelle entre deux hexes.
   * Guard self-route : hexId1 === hexId2 ignoré (pas de self-boost possible).
   * Guard idempotence : si la route existe déjà, retourne sans markDirty() (évite Dijkstra inutile).
   * Initialisation lazy des Sets d'adjacence.
   * Appelle markDirty() pour déclencher un recalcul Dijkstra au prochain compute().
   */
  addRoute(hexId1: string, hexId2: string): void {
    // Guard self-route : une route vers soi-même n'a pas de sens (M4)
    if (hexId1 === hexId2) return

    // Guard idempotence : ne marque dirty que si la route est réellement nouvelle (M1)
    if (this.adjacency.get(hexId1)?.has(hexId2)) return

    if (!this.adjacency.has(hexId1)) this.adjacency.set(hexId1, new Set())
    if (!this.adjacency.has(hexId2)) this.adjacency.set(hexId2, new Set())
    const neighbors1 = this.adjacency.get(hexId1)
    const neighbors2 = this.adjacency.get(hexId2)
    if (neighbors1 !== undefined) neighbors1.add(hexId2)
    if (neighbors2 !== undefined) neighbors2.add(hexId1)
    this.markDirty()
  }

  /**
   * Supprime la route non-directionnelle entre deux hexes.
   * Nettoie les Sets vides après suppression.
   * Appelle markDirty() pour déclencher un recalcul Dijkstra au prochain compute().
   */
  removeRoute(hexId1: string, hexId2: string): void {
    this.adjacency.get(hexId1)?.delete(hexId2)
    this.adjacency.get(hexId2)?.delete(hexId1)
    // Nettoyage des Sets vides pour éviter des entrées orphelines
    if (this.adjacency.get(hexId1)?.size === 0) this.adjacency.delete(hexId1)
    if (this.adjacency.get(hexId2)?.size === 0) this.adjacency.delete(hexId2)
    this.markDirty()
  }

  /**
   * Marque le graphe comme modifié — force un recalcul Dijkstra au prochain compute().
   * Appelé par addRoute(), removeRoute(), et les UI handlers (Story 1.10+).
   */
  markDirty(): void {
    this.routesDirty = true
  }

  /**
   * Recalcule la matrice d'accessibilité via Dijkstra (poids uniforme = 1 par route).
   * Guard routesDirty : ne recalcule pas si le graphe n'a pas changé (idempotence).
   * routesDirty = false UNIQUEMENT après recalcul complet réussi.
   */
  compute(): void {
    if (!this.routesDirty) return

    this.reachable = new Map()
    for (const hexId of this.adjacency.keys()) {
      this.reachable.set(hexId, this.dijkstra(hexId))
    }
    this.routesDirty = false // reset après recalcul complet — jamais avant
  }

  /**
   * Retourne le boost de débit si hexId1 et hexId2 sont reliés par des routes.
   * Nécessite un appel préalable à compute() pour un résultat à jour.
   * Retourne 1.0 si pas de connexion (pas de boost).
   */
  getBoostFactor(hexId1: string, hexId2: string): number {
    if (this.reachable.get(hexId1)?.has(hexId2)) {
      return this.config.routeBoostFactor
    }
    return 1.0
  }

  /**
   * Dijkstra avec poids uniforme (= 1 par segment de route).
   * Retourne le Set des hexes atteignables depuis startHex (startHex exclu).
   * Graphe vide → Set vide, pas d'erreur.
   * Complexité : O(V²) avec scan linéaire — acceptable pour ≤ 50 hex (NFR14).
   */
  private dijkstra(startHex: string): Set<string> {
    const dist = new Map<string, number>()
    const visited = new Set<string>()

    // Initialiser toutes les distances à Infinity
    for (const hexId of this.adjacency.keys()) {
      dist.set(hexId, Infinity)
    }
    dist.set(startHex, 0)

    while (true) {
      // Trouver le nœud non-visité avec distance minimale
      let minDist = Infinity
      let minHex: string | undefined
      for (const [hexId, d] of dist.entries()) {
        if (!visited.has(hexId) && d < minDist) {
          minDist = d
          minHex = hexId
        }
      }

      if (minHex === undefined) break // tous les nœuds visités ou aucun atteignable

      visited.add(minHex)

      for (const neighbor of this.adjacency.get(minHex) ?? []) {
        const newDist = minDist + 1 // poids uniforme = 1
        if (newDist < (dist.get(neighbor) ?? Infinity)) {
          dist.set(neighbor, newDist)
        }
      }
    }

    // Retourner les hexes atteignables (dist < Infinity), startHex exclu
    const reachable = new Set<string>()
    for (const [hexId, d] of dist.entries()) {
      if (d < Infinity && hexId !== startHex) {
        reachable.add(hexId)
      }
    }
    return reachable
  }
}
