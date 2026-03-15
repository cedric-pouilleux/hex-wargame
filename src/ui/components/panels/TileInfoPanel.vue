<script setup lang="ts">
import type { TerrainType } from '../../../simulation/TerrainType'

interface Building {
  type: string
  enabled: boolean
  status: 'active' | 'inactive' | 'under-construction'
}

defineProps<{
  hexId: string | null
  terrain: TerrainType | null
  claimed: boolean
  building: Building | null
}>()

const emit = defineEmits<{
  'toggle-building': []
}>()
</script>

<template>
  <div v-if="hexId" class="tile-info-panel">
    <p class="coords">Coordonnées : {{ hexId }}</p>
    <p>Terrain : {{ terrain }}</p>
    <p>Statut : {{ claimed ? 'occupé' : 'libre' }}</p>
    <template v-if="building">
      <hr />
      <p>Bâtiment : {{ building.type }}</p>
      <p>État : {{ building.status }}</p>
      <button
        v-if="building.status !== 'under-construction'"
        class="toggle-btn"
        @click="emit('toggle-building')"
      >
        {{ building.enabled ? 'Désactiver' : 'Activer' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.tile-info-panel {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #eee;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  pointer-events: none;
  min-width: 160px;
}
.coords {
  font-weight: bold;
  margin-bottom: 4px;
}
hr {
  border-color: rgba(255, 255, 255, 0.2);
  margin: 6px 0;
}
.toggle-btn {
  pointer-events: all;
  background: #444;
  color: #eee;
  border: 1px solid #666;
  border-radius: 3px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12px;
  margin-top: 4px;
}
.toggle-btn:hover {
  background: #555;
}
</style>
