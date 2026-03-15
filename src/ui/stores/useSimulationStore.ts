import { defineStore } from 'pinia'
import { ISLAND_TILES } from '../../config/island-map'
import { DEFAULT_CONFIG } from '../../simulation/GameConfig'
import type { Building, City, Edge, SimulationSnapshot } from '../../simulation/SimulationState'
import type { HexTile } from '../../simulation/TerrainType'

export const useSimulationStore = defineStore('simulation', {
  state: () => ({
    hexTiles:      [...ISLAND_TILES] as HexTile[],  // initialisé avec la carte statique (claimed=false)
    buildings:     [] as Building[],
    cities:        [] as City[],
    edges:         [] as Edge[],
    buildingOrder: [] as string[],
    currentTick:   0,
    money:         DEFAULT_CONFIG.startingMoney,
  }),
  actions: {
    /**
     * Met à jour le store depuis un snapshot simulation.
     * Appelé via TickOrchestrator.onSnapshot (Story 2.5+).
     * $patch est atomique — les watchers Vue sont déclenchés après mutation complète.
     */
    setSnapshot(snapshot: SimulationSnapshot): void {
      this.$patch({
        hexTiles:      [...snapshot.hexTiles],
        buildings:     [...snapshot.buildings],
        cities:        [...snapshot.cities],
        edges:         [...snapshot.edges],
        buildingOrder: [...snapshot.buildingOrder],
        currentTick:   snapshot.currentTick,
        money:         snapshot.money,
      })
    },
  },
})
