export interface AxialCoord {
  q: number
  r: number
}

export class HexOccupiedError extends Error {
  constructor(hexId: string, existingId: string) {
    super(`Hex ${hexId} already claimed by ${existingId}`)
    this.name = 'HexOccupiedError'
  }
}

export class HexMap {
  /** Ensemble de tous les hexIds valides de l'île — format "q,r" */
  readonly coords: ReadonlySet<string>

  /** Occupation : hexId → buildingId (ou cityId) */
  private readonly claims = new Map<string, string>()

  constructor(axialCoords: readonly AxialCoord[]) {
    this.coords = new Set(axialCoords.map(({ q, r }) => `${q},${r}`))
  }

  /**
   * Vérifie si la coord appartient à l'île.
   * Retourne `true` si valide, throw si absent (fail-fast — architecture §Failure Mode Preventions).
   */
  isValid(coord: AxialCoord): true {
    if (!this.coords.has(`${coord.q},${coord.r}`)) {
      throw new Error(`Invalid hex coord: ${coord.q},${coord.r}`)
    }
    return true
  }

  /**
   * Réclame un hex libre pour un bâtiment ou une ville.
   * Throw HexOccupiedError si le hex est déjà occupé.
   */
  claimHex(hexId: string, buildingId: string): void {
    const existing = this.claims.get(hexId)
    if (existing !== undefined) {
      throw new HexOccupiedError(hexId, existing)
    }
    this.claims.set(hexId, buildingId)
  }

  /**
   * Libère un hex occupé (appelé par BuildingRegistry.removeBuilding — Story 1.6).
   * Silencieux si le hex n'est pas réclamé.
   */
  releaseHex(hexId: string): void {
    this.claims.delete(hexId)
  }

  isClaimed(hexId: string): boolean {
    return this.claims.has(hexId)
  }

  getBuildingId(hexId: string): string | undefined {
    return this.claims.get(hexId)
  }
}
