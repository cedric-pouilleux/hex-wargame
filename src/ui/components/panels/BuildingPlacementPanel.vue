<script setup lang="ts">
import { computed } from 'vue'
import { buildings } from '../../../config/default-config'
import type { TerrainType } from '../../../simulation/TerrainType'

const props = defineProps<{
  terrain: TerrainType
  money: number
}>()

const emit = defineEmits<{
  place: [buildingType: string]
}>()

// Filtrer les types de bâtiments compatibles avec le terrain de la tuile (FR08)
const compatibleBuildings = computed(() =>
  buildings.filter(def => def.terrain.includes(props.terrain as string))
)
</script>

<template>
  <div class="placement-panel">
    <p class="panel-title">Placer un bâtiment</p>
    <div
      v-for="def in compatibleBuildings"
      :key="def.type"
      class="building-item"
    >
      <span class="building-name">{{ def.type }}</span>
      <span class="building-cost">{{ def.cost }} 💰</span>
      <button
        :disabled="money < def.cost"
        class="place-btn"
        @click="emit('place', def.type)"
      >
        Placer
      </button>
    </div>
    <p v-if="compatibleBuildings.length === 0" class="no-buildings">
      Aucun bâtiment compatible avec ce terrain.
    </p>
  </div>
</template>

<style scoped>
.placement-panel {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.85);
  color: #eee;
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 13px;
  pointer-events: all;
  min-width: 200px;
}
.panel-title {
  font-weight: bold;
  margin-bottom: 8px;
  color: #ffd700;
}
.building-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.building-name {
  flex: 1;
  text-transform: capitalize;
}
.building-cost {
  font-size: 12px;
  color: #ffd700;
}
.place-btn {
  background: #2a6a2a;
  color: #eee;
  border: none;
  border-radius: 3px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12px;
}
.place-btn:disabled {
  background: #444;
  color: #888;
  cursor: not-allowed;
}
.place-btn:not(:disabled):hover {
  background: #3a8a3a;
}
.no-buildings {
  color: #888;
  font-style: italic;
}
</style>
