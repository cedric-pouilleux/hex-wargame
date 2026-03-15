<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { PixiRenderer, CAMERA_SPEED } from '../../renderer/PixiRenderer'
import { TickOrchestrator } from '../../simulation/TickOrchestrator'
import { DEFAULT_CONFIG, buildings, resources } from '../../config/default-config'
import { ISLAND_TILES } from '../../config/island-map'
import { useSimulationStore } from '../stores/useSimulationStore'
import TileInfoPanel from './panels/TileInfoPanel.vue'
import BuildingPlacementPanel from './panels/BuildingPlacementPanel.vue'
import type { Building, SimulationSnapshot } from '../../simulation/SimulationState'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const renderer = new PixiRenderer()
const store = useSimulationStore()

// ─── TickOrchestrator ─────────────────────────────────────────────────────────
// Snapshot courant pour la RAF loop — ref locale pour éviter les casts Pinia
const latestSnapshot = ref<SimulationSnapshot>({
  buildings: [],
  cities: [],
  edges: [],
  buildingOrder: [],
  currentTick: 0,
  money: DEFAULT_CONFIG.startingMoney,
  hexTiles: [...ISLAND_TILES],
})

const orch = new TickOrchestrator(
  DEFAULT_CONFIG,
  buildings,
  resources,
  ISLAND_TILES,
  (snapshot) => {
    latestSnapshot.value = snapshot
    store.setSnapshot(snapshot)
  },
)

// ─── RAF ──────────────────────────────────────────────────────────────────────
let rafId: number | null = null

function startRaf(): void {
  if (rafId !== null) return  // guard idempotence — évite double boucle RAF
  function loop(): void {
    renderer.renderState(latestSnapshot.value)
    rafId = window.requestAnimationFrame(loop)
  }
  rafId = window.requestAnimationFrame(loop)
}

// ─── Drag (pan naturel) ───────────────────────────────────────────────────────
let isDragging = false
let lastX = 0
let lastY = 0
let pointerDownX = 0
let pointerDownY = 0

function onPointerDown(e: PointerEvent): void {
  isDragging = true
  lastX = e.clientX
  lastY = e.clientY
  pointerDownX = e.clientX
  pointerDownY = e.clientY
  ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!isDragging) return
  renderer.moveCamera(lastX - e.clientX, lastY - e.clientY)
  lastX = e.clientX
  lastY = e.clientY
}

function onPointerUp(e: PointerEvent): void {
  isDragging = false
  const dx = Math.abs(e.clientX - pointerDownX)
  const dy = Math.abs(e.clientY - pointerDownY)
  if (dx < 5 && dy < 5) {
    handleTileClick(e.clientX, e.clientY)
  }
}

function stopDrag(): void {
  isDragging = false
}

// ─── Sélection de tile ────────────────────────────────────────────────────────
const selectedHexId = ref<string | null>(null)

function handleTileClick(clientX: number, clientY: number): void {
  if (!canvasRef.value) return
  const { q, r } = renderer.pickHex(clientX, clientY, canvasRef.value.getBoundingClientRect())
  const hexId = `${q},${r}`
  const tile = ISLAND_TILES.find(t => t.hexId === hexId)
  // Désélectionner si hors île ou tuile water
  if (!tile || tile.terrain === 'water') {
    selectedHexId.value = null
    renderer.setSelectedHex(null)
    return
  }
  selectedHexId.value = hexId
  renderer.setSelectedHex(hexId)
}

// selectedTileData — réactif via store.buildings (Story 2.5+)
const selectedTileData = computed(() => {
  const hexId = selectedHexId.value
  if (!hexId) return null
  const tile = ISLAND_TILES.find(t => t.hexId === hexId)
  if (!tile) return null
  const building = store.buildings.find(b => b.hexId === hexId) ?? null
  return {
    hexId: tile.hexId,
    terrain: tile.terrain,
    claimed: building !== null,
    building: building ? { type: building.type, enabled: building.enabled, status: building.status } : null,
  }
})

// BuildingPlacementPanel visible si tile sélectionnée, non-water, non-occupée
const showPlacementPanel = computed(() => {
  const hexId = selectedHexId.value
  if (!hexId) return false
  const tile = ISLAND_TILES.find(t => t.hexId === hexId)
  if (!tile || tile.terrain === 'water') return false
  return !store.buildings.some(b => b.hexId === hexId)
})

// ─── Placement de bâtiment ────────────────────────────────────────────────────
function handlePlacement(buildingType: string): void {
  const hexId = selectedHexId.value
  if (!hexId) return

  const def = buildings.find(d => d.type === buildingType)
  if (!def) return

  // Guard money (double check — bouton déjà désactivé dans BuildingPlacementPanel)
  if (orch.state.money < def.cost) return

  const building: Building = {
    id: `${buildingType}-${crypto.randomUUID()}`,
    type: buildingType,
    hexId,
    workers: 0,
    stock: {},
    enabled: true,
    status: 'under-construction',
  }

  try {
    orch.buildingRegistry.addBuilding(building)
    orch.state.money = Math.max(0, orch.state.money - def.cost)
    // Forcer une mise à jour immédiate du snapshot avant le prochain tick
    const currentSnapshot = {
      ...latestSnapshot.value,
      buildings: [...orch.state.buildings.values()],
      buildingOrder: [...orch.state.buildingOrder],
      money: orch.state.money,
      hexTiles: ISLAND_TILES.map(t => ({ ...t, claimed: orch.hexMap.isClaimed(t.hexId) })),
    }
    latestSnapshot.value = currentSnapshot
    store.setSnapshot(currentSnapshot)
  } catch (err) {
    // HexOccupiedError — tile occupée (defensive coding pour AC3)
    console.warn('[GameCanvas] placement échoué:', err)
  }
}

// ─── Toggle activer/désactiver bâtiment ───────────────────────────────────────
function handleToggleBuilding(): void {
  const hexId = selectedHexId.value
  if (!hexId) return
  const building = [...orch.state.buildings.values()].find(b => b.hexId === hexId)
  if (!building) return
  building.enabled = !building.enabled
  // Mise à jour immédiate du status visuel (AC3/AC4) — sans attendre SaturationCheck au prochain tick
  building.status = building.enabled ? 'active' : 'inactive'
  // Snapshot immédiat — même pattern que handlePlacement
  const currentSnapshot = {
    ...latestSnapshot.value,
    buildings: [...orch.state.buildings.values()],
  }
  latestSnapshot.value = currentSnapshot
  store.setSnapshot(currentSnapshot)
}

// ─── Clavier ──────────────────────────────────────────────────────────────────
function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowUp')         { e.preventDefault(); renderer.moveCamera(0, -CAMERA_SPEED) }
  else if (e.key === 'ArrowDown')  { e.preventDefault(); renderer.moveCamera(0,  CAMERA_SPEED) }
  else if (e.key === 'ArrowLeft')  { e.preventDefault(); renderer.moveCamera(-CAMERA_SPEED, 0) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); renderer.moveCamera( CAMERA_SPEED, 0) }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!canvasRef.value) return
  try {
    await renderer.init(canvasRef.value)
  } catch (err) {
    console.error('[GameCanvas] PixiRenderer init failed (WebGL unavailable?):', err)
    return
  }
  window.addEventListener('keydown', handleKeydown)
  orch.start()
  startRaf()
})

onUnmounted(() => {
  if (rafId !== null) window.cancelAnimationFrame(rafId)
  window.removeEventListener('keydown', handleKeydown)
  orch.stop()
  renderer.destroy()
})
</script>

<template>
  <div style="position: relative; display: inline-block">
    <canvas
      ref="canvasRef"
      width="800"
      height="600"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="stopDrag"
    />
    <TileInfoPanel
      :hex-id="selectedTileData?.hexId ?? null"
      :terrain="selectedTileData?.terrain ?? null"
      :claimed="selectedTileData?.claimed ?? false"
      :building="selectedTileData?.building ?? null"
      @toggle-building="handleToggleBuilding"
    />
    <BuildingPlacementPanel
      v-if="showPlacementPanel && selectedTileData"
      :terrain="selectedTileData.terrain"
      :money="store.money"
      @place="handlePlacement"
    />
    <div class="money-hud">💰 {{ Math.floor(store.money) }}</div>
  </div>
</template>

<style scoped>
.money-hud {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #ffd700;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  pointer-events: none;
}
</style>
