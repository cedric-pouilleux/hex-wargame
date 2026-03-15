import { Application, Container, Graphics } from 'pixi.js'
import type { IRenderer } from './IRenderer'
import type { Building, SimulationSnapshot } from '../simulation/SimulationState'
import type { HexTile, TerrainType } from '../simulation/TerrainType'

const HEX_SIZE = 36
const CANVAS_OFFSET_X = 400
const CANVAS_OFFSET_Y = 300

/** Limites axiales de la caméra en pixels (±360px depuis le centre) */
export const CAMERA_BOUNDS = HEX_SIZE * 4 * 2.5  // 360px

/** Vitesse de déplacement caméra par keydown (px) */
export const CAMERA_SPEED = 8

const TERRAIN_COLORS: Record<TerrainType, number> = {
  plain:  0x90c060,
  forest: 0x2d5a27,
  water:  0x4a9eda,
}

const BUILDING_STATUS_STYLE: Record<Building['status'], { color: number; alpha: number }> = {
  'under-construction': { color: 0xffaa00, alpha: 0.5 },
  'active':             { color: 0x44ff44, alpha: 1.0 },
  'inactive':           { color: 0x888888, alpha: 0.7 },
}

/**
 * Clamp un offset caméra dans ±bounds.
 * Fonction pure — testable sans WebGL.
 */
export function clampCamera(current: number, delta: number, bounds: number): number {
  return Math.max(-bounds, Math.min(bounds, current + delta))
}

/**
 * Conversion pixel local (container) → coordonnées axiales hex (flat-top).
 * Utilise l'arrondi cube pour trouver le hex le plus proche.
 * Fonction pure — testable sans WebGL.
 *
 * @param localX - Coordonnée X locale au hexContainer
 * @param localY - Coordonnée Y locale au hexContainer
 * @param hexSize - Taille d'un hexagone (HEX_SIZE)
 */
export function pixelToAxial(localX: number, localY: number, hexSize: number): { q: number; r: number } {
  const qFrac = (2 / 3 * localX) / hexSize
  const rFrac = (-1 / 3 * localX + Math.sqrt(3) / 3 * localY) / hexSize
  const sFrac = -qFrac - rFrac

  let q = Math.round(qFrac)
  let r = Math.round(rFrac)
  const s = Math.round(sFrac)

  const dq = Math.abs(q - qFrac)
  const dr = Math.abs(r - rFrac)
  const ds = Math.abs(s - sFrac)

  if (dq > dr && dq > ds) {
    q = -r - s
  } else if (dr > ds) {
    r = -q - s
  }

  return { q, r }
}

export class PixiRenderer implements IRenderer {
  private app: Application | undefined
  private hexContainer: Container | undefined
  private hexGraphics: Graphics | undefined  // réutilisé via clear() — évite la fuite GPU
  private cameraX: number
  private cameraY: number
  private selectedHexId: string | null

  constructor() {
    this.app = undefined
    this.hexContainer = undefined
    this.hexGraphics = undefined
    this.cameraX = 0
    this.cameraY = 0
    this.selectedHexId = null
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.app !== undefined) return  // guard idempotence — évite double WebGL context leak
    this.app = new Application()
    await this.app.init({
      canvas,
      width: canvas.width || 800,
      height: canvas.height || 600,
      backgroundColor: 0x1a1a2e,
      antialias: true,
    })
    this.hexContainer = new Container()
    this.hexGraphics = new Graphics()
    this.hexContainer.addChild(this.hexGraphics)
    this.app.stage.addChild(this.hexContainer)
  }

  /**
   * Déplace la caméra de (dx, dy) pixels avec clamping dans ±CAMERA_BOUNDS.
   * Pan naturel : glisser à droite → cameraX diminue → carte se déplace à droite.
   */
  moveCamera(dx: number, dy: number): void {
    this.cameraX = clampCamera(this.cameraX, dx, CAMERA_BOUNDS)
    this.cameraY = clampCamera(this.cameraY, dy, CAMERA_BOUNDS)
  }

  /** Définit la tuile sélectionnée (null = désélection). */
  setSelectedHex(hexId: string | null): void {
    this.selectedHexId = hexId
  }

  /**
   * Convertit des coordonnées client (souris) en coordonnées axiales hex.
   * Tient compte de la position courante de la caméra.
   *
   * @param clientX - e.clientX de l'événement pointer
   * @param clientY - e.clientY de l'événement pointer
   * @param canvasRect - getBoundingClientRect() du canvas
   */
  pickHex(clientX: number, clientY: number, canvasRect: DOMRect): { q: number; r: number } {
    const canvasX = clientX - canvasRect.left
    const canvasY = clientY - canvasRect.top
    // Inverse de hexContainer.position = (CANVAS_OFFSET_X - cameraX, CANVAS_OFFSET_Y - cameraY)
    const localX = canvasX - (CANVAS_OFFSET_X - this.cameraX)
    const localY = canvasY - (CANVAS_OFFSET_Y - this.cameraY)
    return pixelToAxial(localX, localY, HEX_SIZE)
  }

  renderState(snapshot: SimulationSnapshot): void {
    if (this.app === undefined || this.hexContainer === undefined || this.hexGraphics === undefined) return
    // Caméra : déplace le container — tout le contenu suit (pattern standard Pixi.js)
    this.hexContainer.x = CANVAS_OFFSET_X - this.cameraX
    this.hexContainer.y = CANVAS_OFFSET_Y - this.cameraY
    // Réutilise le même objet Graphics — évite la fuite mémoire GPU à chaque frame RAF
    this.hexGraphics.clear()
    // Index bâtiments par hexId — O(1) lookup dans drawHex (alloué par frame, acceptable POC ~20 bâtiments)
    const buildingByHexId = new Map<string, Building>()
    for (const b of snapshot.buildings) {
      buildingByHexId.set(b.hexId, b)
    }
    for (const tile of snapshot.hexTiles) {
      this.drawHex(this.hexGraphics, tile, buildingByHexId.get(tile.hexId))
    }
  }

  private drawHex(g: Graphics, tile: HexTile, building: Building | undefined): void {
    const { x, y } = this.hexToPixel(tile.q, tile.r)
    // Coordonnées locales au container (CANVAS_OFFSET absorbé par hexContainer.position)
    const pts = this.hexVertices(x, y)
    const fillColor = TERRAIN_COLORS[tile.terrain]
    g.poly(pts).fill(fillColor)
    if (tile.hexId === this.selectedHexId) {
      // Surbrillance sélection (Story 2.4) — stroke jaune épais
      g.poly(pts).stroke({ width: 3, color: 0xffff44, alpha: 1 })
    } else {
      g.poly(pts).stroke({ width: 1, color: 0x222222, alpha: 0.4 })
    }
    // Marqueur bâtiment — cercle centré sur le hex, couleur selon status (Story 2.6)
    if (building !== undefined) {
      const { color, alpha } = BUILDING_STATUS_STYLE[building.status]
      g.circle(x, y, 12).fill({ color, alpha })
    }
  }

  /**
   * Conversion axiale → pixel (flat-top hexagons).
   * Retourne des coordonnées locales au hexContainer.
   */
  private hexToPixel(q: number, r: number): { x: number; y: number } {
    return {
      x: HEX_SIZE * (3 / 2 * q),
      y: HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r),
    }
  }

  /** 6 sommets d'un hexagone flat-top centré en (cx, cy). */
  private hexVertices(cx: number, cy: number): number[] {
    const pts: number[] = []
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i
      pts.push(cx + HEX_SIZE * Math.cos(angle), cy + HEX_SIZE * Math.sin(angle))
    }
    return pts
  }

  destroy(): void {
    this.app?.destroy(true)
    this.app = undefined
    this.hexContainer = undefined
    this.hexGraphics = undefined
    this.cameraX = 0
    this.cameraY = 0
    this.selectedHexId = null
  }
}
