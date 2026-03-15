import type { AxialCoord } from '../simulation/HexMap'
import type { HexTile, TerrainType } from '../simulation/TerrainType'

/** Distance axiale (hex Manhattan distance) en coordonnées axiales */
function hexDistance(q: number, r: number): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r))
}

/** Tous les hexes dans le disque de rayon maxRadius depuis le centre (0,0) */
function hexDisk(maxRadius: number): AxialCoord[] {
  const coords: AxialCoord[] = []
  for (let q = -maxRadius; q <= maxRadius; q++) {
    const rMin = Math.max(-maxRadius, -q - maxRadius)
    const rMax = Math.min(maxRadius, -q + maxRadius)
    for (let r = rMin; r <= rMax; r++) {
      coords.push({ q, r })
    }
  }
  return coords
}

/** Terrain selon distance au centre :
 *  dist 0-2 → plain (19 tuiles)
 *  dist 3   → forest (18 tuiles)
 *  dist 4   → water / non-constructible (24 tuiles)
 */
function getTerrain(q: number, r: number): TerrainType {
  const dist = hexDistance(q, r)
  if (dist >= 4) return 'water'
  if (dist >= 3) return 'forest'
  return 'plain'
}

/**
 * Île statique de 61 tuiles hex (disque axial de rayon 4).
 * Distribution : 19 plain, 18 forest, 24 water.
 * Les tuiles water sont visuellement distinctes (bleu) — non-constructibles (Story 2.5+).
 *
 * ⚠️ PATTERN Story 2.5+ : NE PAS muter les objets HexTile de cette constante.
 * Le champ `claimed` doit être dérivé dynamiquement depuis HexMap.isClaimed(hexId)
 * et injecté dans un nouveau tableau lors de la construction du SimulationSnapshot.
 * Exemple correct dans TickOrchestrator.getSnapshot() (Story 2.3+) :
 *   hexTiles: ISLAND_TILES.map(t => ({ ...t, claimed: hexMap.isClaimed(t.hexId) }))
 */
export const ISLAND_TILES: readonly HexTile[] = hexDisk(4).map(({ q, r }) => ({
  hexId: `${q},${r}`,
  q,
  r,
  terrain: getTerrain(q, r),
  claimed: false,
}))

/** Coordonnées axiales de l'île — utilisées par HexMap et TickOrchestrator (Story 2.3+) */
export const ISLAND_COORDS: readonly AxialCoord[] = ISLAND_TILES.map(({ q, r }) => ({ q, r }))
