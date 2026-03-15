import type { IRenderer } from './IRenderer'
import type { SimulationSnapshot } from '../simulation/SimulationState'

export class MockRenderer implements IRenderer {
  renderCallCount = 0
  lastSnapshot: SimulationSnapshot | undefined

  async init(_canvas: HTMLCanvasElement): Promise<void> {
    // no-op headless
  }

  renderState(snapshot: SimulationSnapshot): void {
    this.renderCallCount++
    this.lastSnapshot = snapshot
  }

  destroy(): void {
    // no-op
  }
}
