export type TerrainType = 'plain' | 'forest' | 'water'

export interface HexTile {
  hexId: string      // format "q,r" — cohérent avec HexMap.coordToId()
  q: number
  r: number
  terrain: TerrainType
  claimed: boolean   // true si un bâtiment ou ville occupe ce hex
}
