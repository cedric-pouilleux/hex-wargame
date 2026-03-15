export interface GameConfig {
  version: string
  tickRate: number
  routeBoostFactor: number
  moneyRate: number           // Money/hab/tick — derives from PRD §FR26: 0.1/hab/10s ÷ 10 ticks = 0.01
  populationGrowthPeriod: number  // ticks between each +1 population (with Subsistence)
  faminePeriod: number            // ticks between each -2 population (without Subsistence)
  populationMax: number
  startingMoney: number       // Initial Money pool at game start (before any generation — FR07)
}

export const DEFAULT_CONFIG: Readonly<GameConfig> = {
  version: '1.0.0',
  tickRate: 1,
  routeBoostFactor: 2.0,
  moneyRate: 0.01,            // 0.1 Money/hab/10s ÷ 10 ticks/s = 0.01/hab/tick [PRD §FR26]
  populationGrowthPeriod: 10, // +1 inhabitant every 10 ticks (at 1 tick/s = every 10s) [PRD §FR24]
  faminePeriod: 5,            // -2 inhabitants every 5 ticks (at 1 tick/s = every 5s) [PRD §FR24]
  populationMax: 50,
  startingMoney: 500,         // POC default — enough to place ~3-5 buildings [FR07]
}

export function validateConfig(config: GameConfig): void {
  const violations: string[] = []

  if (!config.version || config.version.trim() === '')
    violations.push('version must be a non-empty string')
  if (config.tickRate <= 0)
    violations.push(`tickRate must be > 0, got ${config.tickRate}`)
  if (config.routeBoostFactor < 1.0)
    violations.push(`routeBoostFactor must be >= 1.0, got ${config.routeBoostFactor}`)
  if (config.moneyRate <= 0)
    violations.push(`moneyRate must be > 0, got ${config.moneyRate}`)
  if (config.populationGrowthPeriod <= 0)
    violations.push(`populationGrowthPeriod must be > 0, got ${config.populationGrowthPeriod}`)
  if (config.faminePeriod <= 0)
    violations.push(`faminePeriod must be > 0, got ${config.faminePeriod}`)
  if (config.populationMax <= 0)
    violations.push(`populationMax must be > 0, got ${config.populationMax}`)
  if (config.startingMoney < 0)
    violations.push(`startingMoney must be >= 0, got ${config.startingMoney}`)

  if (violations.length > 0) {
    throw new Error(`Invalid GameConfig:\n${violations.join('\n')}`)
  }
}
