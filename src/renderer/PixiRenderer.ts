import { Application } from 'pixi.js'
import type { IRenderer } from './IRenderer'
import type { SimulationSnapshot } from '../simulation/SimulationState'

export class PixiRenderer implements IRenderer {
  private app: Application | undefined

  constructor() {
    this.app = undefined
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
  }

  renderState(_snapshot: SimulationSnapshot): void {
    // POC Story 2.1 : stub — rendu réel Story 2.2+
    // this.app?.stage contient le scene graph à mettre à jour
  }

  destroy(): void {
    this.app?.destroy(true)
    this.app = undefined
  }
}
