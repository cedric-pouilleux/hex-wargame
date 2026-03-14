import type { ResourceDefinition } from '../simulation/ResourceDefinition'
import type { BuildingDefinition } from '../simulation/BuildingDefinition'
import rawResources from './resources.json'
import rawBuildings from './buildings.json'

export { DEFAULT_CONFIG } from '../simulation/GameConfig'

export const resources = rawResources satisfies ResourceDefinition[]

// inputs/outputs sont Partial<Record<string, number>> — compatible avec l'inférence littérale
// TypeScript pour les arrays JSON hétérogènes (clés absentes = undefined, non number).
export const buildings = rawBuildings satisfies BuildingDefinition[]
