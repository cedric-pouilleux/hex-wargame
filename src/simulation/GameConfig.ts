export interface GameConfig {
  version: string
  tickRate: number
  routeBoostFactor: number
  moneyRate: number
  populationGrowthRate: number
  famineRate: number
  populationMax: number
}

export const DEFAULT_CONFIG: Readonly<GameConfig> = {
  version: '1.0.0',
  tickRate: 1,
  routeBoostFactor: 2.0,
  moneyRate: 0.01,
  populationGrowthRate: 10,
  famineRate: 5,
  populationMax: 50,
}

export function validateConfig(config: GameConfig): void {
  const violations: string[] = []

  if (config.tickRate <= 0)
    violations.push(`tickRate must be > 0, got ${config.tickRate}`)
  if (config.routeBoostFactor < 1.0)
    violations.push(`routeBoostFactor must be >= 1.0, got ${config.routeBoostFactor}`)
  if (config.moneyRate <= 0)
    violations.push(`moneyRate must be > 0, got ${config.moneyRate}`)
  if (config.populationGrowthRate <= 0)
    violations.push(`populationGrowthRate must be > 0, got ${config.populationGrowthRate}`)
  if (config.famineRate <= 0)
    violations.push(`famineRate must be > 0, got ${config.famineRate}`)
  if (config.populationMax <= 0)
    violations.push(`populationMax must be > 0, got ${config.populationMax}`)

  if (violations.length > 0) {
    throw new Error(`Invalid GameConfig:\n${violations.join('\n')}`)
  }
}
