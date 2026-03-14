export interface ResourceDefinition {
  name: string      // Identifiant unique (ex. "Subsistance")
  unit: string      // Unité d'affichage (ex. "rations")
  maxStock: number  // Capacité max dans un hub standard (> 0)
}
