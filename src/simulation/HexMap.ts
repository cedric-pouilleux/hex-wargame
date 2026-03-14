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

export class InvalidHexCoordError extends Error {
  constructor(coord: AxialCoord) {
    super(`Invalid hex coord: ${coord.q},${coord.r}`)
    this.name = 'InvalidHexCoordError'
  }
}

export class HexMap {
  /** Ensemble de tous les hexIds valides de l'île — format "q,r" */
  readonly coords: ReadonlySet<string>

  /** Occupation : hexId → buildingId (ou cityId) */
  private readonly claims = new Map<string, string>()

  constructor(axialCoords: readonly AxialCoord[]) {
    this.coords = new Set(axialCoords.map(HexMap.coordToId))
  }

  /** Convertit une coordonnée axiale en hexId string "q,r". */
  static coordToId(coord: AxialCoord): string {
    return `${coord.q},${coord.r}`
  }

  /**
   * Vérifie si la coord appartient à l'île.
   * Retourne `true` si valide, throw InvalidHexCoordError si absent
   * (fail-fast — architecture §Failure Mode Preventions).
   */
  isValid(coord: AxialCoord): true {
    if (!this.coords.has(HexMap.coordToId(coord))) {
      throw new InvalidHexCoordError(coord)
    }
    return true
  }

  /**
   * Réclame un hex libre pour un bâtiment ou une ville.
   * Throw si hexId hors-île (invariant island) ou si déjà occupé (HexOccupiedError).
   */
  claimHex(hexId: string, buildingId: string): void {
    if (!this.coords.has(hexId)) {
      throw new Error(`Cannot claim hex outside island: ${hexId}`)
    }
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
