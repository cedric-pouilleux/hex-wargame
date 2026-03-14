export interface IFluxNetwork {
  removeEdgesFor(buildingId: string): void
}

/**
 * Implémentation minimale de IFluxNetwork pour les tests de Story 1.4–1.6.
 * Remplacée par FluxNetwork (Story 1.8) sans modifier les consommateurs.
 */
export class FluxNetworkStub implements IFluxNetwork {
  private readonly edgesByBuilding = new Map<string, Set<string>>()

  /** Setup test : enregistre un edge pour un bâtiment donné */
  addEdge(buildingId: string, edgeId: string): void {
    if (!this.edgesByBuilding.has(buildingId)) {
      this.edgesByBuilding.set(buildingId, new Set())
    }
    this.edgesByBuilding.get(buildingId)!.add(edgeId)
  }

  removeEdgesFor(buildingId: string): void {
    this.edgesByBuilding.delete(buildingId)
  }

  /** Vérification test : retourne les edge IDs enregistrés pour un bâtiment */
  getEdgesFor(buildingId: string): string[] {
    return [...(this.edgesByBuilding.get(buildingId) ?? [])]
  }
}
