import type { ResourceDefinition } from '../simulation/ResourceDefinition'
import type { BuildingDefinition } from '../simulation/BuildingDefinition'
import rawResources from './resources.json'
import rawBuildings from './buildings.json'

export { DEFAULT_CONFIG } from '../simulation/GameConfig'

export const resources = rawResources satisfies ResourceDefinition[]
// TypeScript infers overly-narrow literal types from JSON arrays where objects have different
// keys in Record fields (e.g., ferme.outputs has "Bois?: undefined" inferred from sibling objects).
// The intermediate cast is safe because the JSON structure matches BuildingDefinition[].
export const buildings = (rawBuildings as BuildingDefinition[]) satisfies BuildingDefinition[]
