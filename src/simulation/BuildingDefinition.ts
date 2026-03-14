export interface BuildingDefinition {
  type: string                       // Identifiant unique (ex. "ferme")
  inputs: Record<string, number>     // { "NomRessource": unités/tick } — {} si source pure
  outputs: Record<string, number>    // { "NomRessource": unités/tick } — {} si hub pur
  workers: number                    // Civils requis pour opérer (>= 0)
  cost: number                       // Coût en Money pour placer (>= 0)
  terrain: string[]                  // Types de terrain compatibles (non vide)
}
