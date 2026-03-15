import type { SimulationSnapshot } from '../simulation/SimulationState'

export interface IRenderer {
  /**
   * Initialise le renderer sur le canvas fourni.
   * Async car Pixi.js v8 requiert un init asynchrone (WebGL context).
   */
  init(canvas: HTMLCanvasElement): Promise<void>

  /**
   * Met à jour le rendu à partir du snapshot courant de la simulation.
   * Appelé par TickOrchestrator via le callback onSnapshot.
   * NE PAS bloquer — doit être synchrone (RAF géré par GameCanvas.vue en Epic 2).
   */
  renderState(snapshot: SimulationSnapshot): void

  /**
   * Libère toutes les ressources. Idempotent.
   */
  destroy(): void
}
