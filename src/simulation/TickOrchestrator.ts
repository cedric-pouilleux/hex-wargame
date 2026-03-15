import type { GameConfig } from './GameConfig'
import type { BuildingDefinition } from './BuildingDefinition'
import type { ResourceDefinition } from './ResourceDefinition'
import type { SimulationSnapshot } from './SimulationState'
import type { HexTile } from './TerrainType'
import { SimulationState } from './SimulationState'
import { HexMap } from './HexMap'
import { BuildingRegistry } from './BuildingRegistry'
import { FluxNetwork } from './FluxNetwork'
import { RouteNetwork } from './RouteNetwork'
import { PopulationSystem } from './PopulationSystem'

export class TickOrchestrator {
  // Champs privés — config + helpers internes
  private readonly config: Readonly<GameConfig>
  private readonly buildingDefs: readonly BuildingDefinition[]
  private readonly maxStockByResource: Record<string, number>
  private readonly onSnapshot: ((snapshot: SimulationSnapshot) => void) | undefined
  private readonly hexTiles: readonly HexTile[]
  private intervalId: ReturnType<typeof setInterval> | undefined

  // Champs publics readonly — accessibles aux tests headless pour manipulation directe du state
  readonly state: SimulationState
  readonly hexMap: HexMap
  readonly buildingRegistry: BuildingRegistry
  readonly fluxNetwork: FluxNetwork
  readonly routeNetwork: RouteNetwork
  readonly populationSystem: PopulationSystem

  constructor(
    config: Readonly<GameConfig>,
    buildingDefs: readonly BuildingDefinition[] = [],
    resourceDefs: readonly ResourceDefinition[] = [],
    hexTiles: readonly HexTile[] = [],
    onSnapshot?: (snapshot: SimulationSnapshot) => void,
  ) {
    this.config = config
    this.buildingDefs = buildingDefs
    this.hexTiles = hexTiles

    // Construire maxStockByResource depuis resourceDefs
    const maxStock: Record<string, number> = {}
    for (const res of resourceDefs) {
      maxStock[res.name] = res.maxStock
    }
    this.maxStockByResource = maxStock

    // Instancier les sous-composants — ordre : state en premier (dépendance transversale)
    this.state = new SimulationState()
    this.state.money = config.startingMoney  // initialiser le pool Money de départ (FR07)
    this.hexMap = new HexMap(hexTiles.map(t => ({ q: t.q, r: t.r })))
    this.fluxNetwork = new FluxNetwork(this.state, this.maxStockByResource)
    this.buildingRegistry = new BuildingRegistry(this.state, this.fluxNetwork, this.hexMap)
    this.routeNetwork = new RouteNetwork(config)
    this.populationSystem = new PopulationSystem(this.state, config)
    this.onSnapshot = onSnapshot
  }

  /** Démarre la boucle de simulation via setInterval (1 tick par 1000/tickRate ms). Idempotent. */
  start(): void {
    if (this.intervalId !== undefined) return // guard idempotence — évite double interval
    this.intervalId = setInterval(() => { this.tick() }, 1000 / this.config.tickRate)
  }

  /** Arrête la boucle de simulation. Idempotent. */
  stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
  }

  /**
   * Exécute N ticks de simulation en mode accéléré (NFR14).
   * Synchrone — sans délai réel. Utile pour les tests headless.
   */
  runTicks(n: number): void {
    for (let i = 0; i < n; i++) {
      this.tick()
    }
  }

  /**
   * Exécute un tick de simulation.
   * NE PAS RÉORDONNER sans mise à jour du PRD §Tick Order.
   *
   * Zero try/catch — toute exception propage immédiatement (fail-fast, architecture §TickOrchestrator).
   * RAF exclusivement pour le renderer — tick via setInterval uniquement.
   */
  tick(): void {
    // NE PAS RÉORDONNER sans mise à jour du PRD §Tick Order

    // Step 1 : PopulationSystem — croissance/famine, reset receivedSubsistance
    // Guard tick=0 dans PopulationSystem.tick() — comportement intentionnel (stabilité au tick initial)
    this.populationSystem.tick(this.state.currentTick)

    // Step 2 : allocateWorkers — distribue les civils aux bâtiments selon buildingOrder
    this.populationSystem.allocateWorkers()

    // Step 3 : ResourceEngine — production/consommation de ressources par bâtiment
    this.runResourceEngine()

    // Step 4 : RouteNetwork (lazy Dijkstra) + FluxNetwork — distribution des ressources
    // Note : route boost (FR17) sera intégré en Story 2.8 — RouteNetwork compute est préparé ici
    if (this.routeNetwork.routesDirty) {
      this.routeNetwork.compute()
    }
    this.fluxNetwork.tick()

    // Step 5 : SaturationCheck — mise à jour des status visuels des bâtiments
    this.runSaturationCheck()

    // Step 6 : MoneyEngine — génération Money proportionnelle aux civils (FR26)
    this.runMoneyEngine()

    // Step 7 : incrémenter le tick courant
    this.state.currentTick++

    // Step 8 : snapshot UIState — hexTiles avec claimed dynamique (Story 2.5+)
    // ⚠️ Ne pas muter les objets ISLAND_TILES — spread pour créer un nouveau tableau
    this.onSnapshot?.({
      ...this.state.getSnapshot(),
      hexTiles: this.hexTiles.map(t => ({ ...t, claimed: this.hexMap.isClaimed(t.hexId) })),
    })
  }

  /**
   * ResourceEngine — production/consommation des bâtiments actifs (Step 3).
   * Conditions de production :
   *   - building.enabled === true
   *   - building.status !== 'under-construction'
   *   - building.workers >= def.workers (0 workers requis → source infinie, produit toujours)
   *   - tous les inputs sont disponibles dans building.stock
   * Skip silencieux si def non trouvée (tolérance pour tests sans BuildingDefinition complète).
   */
  private runResourceEngine(): void {
    for (const building of this.state.buildings.values()) {
      if (!building.enabled || building.status === 'under-construction') continue

      const def = this.buildingDefs.find(d => d.type === building.type)
      if (def === undefined) continue

      // Workers suffisants (def.workers === 0 → pas de contrainte workers)
      if (def.workers > 0 && building.workers < def.workers) continue

      // Vérifier disponibilité de tous les inputs
      let canProduce = true
      for (const [resource, amount] of Object.entries(def.inputs)) {
        if (amount === undefined) continue
        if ((building.stock[resource] ?? 0) < amount) {
          canProduce = false
          break
        }
      }
      if (!canProduce) continue

      // Déduire les inputs (Math.max(0, ...) guard)
      for (const [resource, amount] of Object.entries(def.inputs)) {
        if (amount === undefined) continue
        building.stock[resource] = Math.max(0, (building.stock[resource] ?? 0) - amount)
      }

      // Créditer les outputs (cap à maxStockByResource)
      for (const [resource, amount] of Object.entries(def.outputs)) {
        if (amount === undefined) continue
        const maxStk = this.maxStockByResource[resource] ?? Infinity
        building.stock[resource] = Math.min(maxStk, (building.stock[resource] ?? 0) + amount)
      }
    }
  }

  /**
   * SaturationCheck — met à jour building.status (Step 5).
   * Transitions : 'under-construction' → 'active'/'inactive' au premier tick.
   * POC : états 'saturated' et 'shortage' sont Epic 3 (Stories 3.3/3.4).
   */
  private runSaturationCheck(): void {
    for (const building of this.state.buildings.values()) {
      building.status = building.enabled ? 'active' : 'inactive'
    }
  }

  /**
   * MoneyEngine — génération Money proportionnelle aux civils (Step 6, FR26).
   * state.money += sum(city.civils) * config.moneyRate
   * Math.max(0, ...) guard : money ne peut pas être négatif.
   */
  private runMoneyEngine(): void {
    let totalCivils = 0
    for (const city of this.state.cities.values()) {
      totalCivils += city.civils
    }
    this.state.money = Math.max(0, this.state.money + totalCivils * this.config.moneyRate)
  }
}
