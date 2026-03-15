import { describe, it, expect, beforeEach } from 'vitest'
import { RouteNetwork } from './RouteNetwork'
import { DEFAULT_CONFIG } from './GameConfig'

// Config de test avec routeBoostFactor = 2.0 (DEFAULT_CONFIG)
const TEST_CONFIG = { ...DEFAULT_CONFIG, routeBoostFactor: 2.0 }

describe('RouteNetwork', () => {
  let rn: RouteNetwork

  beforeEach(() => {
    rn = new RouteNetwork(TEST_CONFIG)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#1 — Graphe vide : compute() sans erreur, routesDirty = false
  // ─────────────────────────────────────────────────────────────
  it('AC#1 — graphe vide : compute() ne throw pas et routesDirty est false après', () => {
    expect(() => rn.compute()).not.toThrow()
    expect(rn.routesDirty).toBe(false)
  })

  it('AC#1 — graphe vide : getBoostFactor retourne 1.0 sans routes', () => {
    rn.compute()
    expect(rn.getBoostFactor('0,0', '1,0')).toBe(1.0)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#2 — Route A-B → compute() → getBoostFactor(A, B) = routeBoostFactor
  // ─────────────────────────────────────────────────────────────
  it('AC#2 — route A-B : getBoostFactor(A, B) retourne routeBoostFactor après compute()', () => {
    rn.addRoute('0,0', '1,0')
    rn.compute()
    expect(rn.getBoostFactor('0,0', '1,0')).toBe(2.0)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#3 — Symétrie : getBoostFactor(B, A) = routeBoostFactor
  // ─────────────────────────────────────────────────────────────
  it('AC#3 — symétrie : getBoostFactor(B, A) retourne routeBoostFactor (routes non-directionnelles)', () => {
    rn.addRoute('0,0', '1,0')
    rn.compute()
    expect(rn.getBoostFactor('1,0', '0,0')).toBe(2.0)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#4 — Pas de route A-C → getBoostFactor retourne 1.0
  // ─────────────────────────────────────────────────────────────
  it('AC#4 — pas de route A-C : getBoostFactor retourne 1.0', () => {
    rn.addRoute('0,0', '1,0') // A-B exists, mais pas A-C
    rn.compute()
    expect(rn.getBoostFactor('0,0', '2,0')).toBe(1.0)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#5 — Idempotence : compute() sans dirty ne recalcule pas
  // ─────────────────────────────────────────────────────────────
  it('AC#5 — idempotence : compute() sans dirty → routesDirty reste false', () => {
    rn.addRoute('0,0', '1,0')
    rn.compute() // premier compute → dirty = false
    expect(rn.routesDirty).toBe(false)
    rn.compute() // deuxième compute sans changement → doit rester false
    expect(rn.routesDirty).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#6 — markDirty() → routesDirty = true
  // ─────────────────────────────────────────────────────────────
  it('AC#6 — markDirty() : routesDirty devient true', () => {
    expect(rn.routesDirty).toBe(false)
    rn.markDirty()
    expect(rn.routesDirty).toBe(true)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#7 — compute() après markDirty() → routesDirty = false après compute
  // ─────────────────────────────────────────────────────────────
  it('AC#7 — markDirty() puis compute() : routesDirty = false après compute', () => {
    rn.addRoute('0,0', '1,0')
    rn.compute()
    rn.markDirty()
    expect(rn.routesDirty).toBe(true)
    rn.compute()
    expect(rn.routesDirty).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#8 — Chaîne A-B-C → getBoostFactor(A, C) = routeBoostFactor (transitif)
  // ─────────────────────────────────────────────────────────────
  it('AC#8 — chaîne A-B-C : getBoostFactor(A, C) retourne routeBoostFactor (transitif)', () => {
    rn.addRoute('0,0', '1,0') // A-B
    rn.addRoute('1,0', '2,0') // B-C
    rn.compute()
    expect(rn.getBoostFactor('0,0', '2,0')).toBe(2.0)
  })

  it('AC#8 — chaîne A-B-C : getBoostFactor(C, A) retourne routeBoostFactor (symétrie transitive)', () => {
    rn.addRoute('0,0', '1,0')
    rn.addRoute('1,0', '2,0')
    rn.compute()
    expect(rn.getBoostFactor('2,0', '0,0')).toBe(2.0)
  })

  // ─────────────────────────────────────────────────────────────
  // AC#9 — addRoute puis removeRoute → compute() → getBoostFactor = 1.0
  // ─────────────────────────────────────────────────────────────
  it('AC#9 — route supprimée : getBoostFactor retourne 1.0 après suppression et compute()', () => {
    rn.addRoute('0,0', '1,0')
    rn.compute()
    expect(rn.getBoostFactor('0,0', '1,0')).toBe(2.0) // route présente

    rn.removeRoute('0,0', '1,0')
    rn.compute()
    expect(rn.getBoostFactor('0,0', '1,0')).toBe(1.0) // route supprimée
  })

  // ─────────────────────────────────────────────────────────────
  // Comportements internes — addRoute/removeRoute appellent markDirty()
  // ─────────────────────────────────────────────────────────────
  it('addRoute() appelle markDirty() : routesDirty = true après addRoute', () => {
    expect(rn.routesDirty).toBe(false)
    rn.addRoute('0,0', '1,0')
    expect(rn.routesDirty).toBe(true)
  })

  it('removeRoute() appelle markDirty() : routesDirty = true après removeRoute', () => {
    rn.addRoute('0,0', '1,0')
    rn.compute() // reset dirty
    expect(rn.routesDirty).toBe(false)
    rn.removeRoute('0,0', '1,0')
    expect(rn.routesDirty).toBe(true)
  })

  // ─────────────────────────────────────────────────────────────
  // Self-loop — getBoostFactor(A, A) = 1.0 (pas de self-boost)
  // ─────────────────────────────────────────────────────────────
  it('self-loop : getBoostFactor(A, A) retourne 1.0 (pas de self-boost)', () => {
    rn.addRoute('0,0', '1,0')
    rn.compute()
    expect(rn.getBoostFactor('0,0', '0,0')).toBe(1.0)
  })

  // ─────────────────────────────────────────────────────────────
  // routeBoostFactor paramétrable
  // ─────────────────────────────────────────────────────────────
  it('routeBoostFactor paramétrable : config { routeBoostFactor: 3.0 } → getBoostFactor retourne 3.0', () => {
    const rn3 = new RouteNetwork({ ...DEFAULT_CONFIG, routeBoostFactor: 3.0 })
    rn3.addRoute('0,0', '1,0')
    rn3.compute()
    expect(rn3.getBoostFactor('0,0', '1,0')).toBe(3.0)
  })

  // ─────────────────────────────────────────────────────────────
  // Graphe déconnecté — deux composantes indépendantes
  // ─────────────────────────────────────────────────────────────
  it('graphe déconnecté : getBoostFactor entre composantes indépendantes retourne 1.0', () => {
    rn.addRoute('0,0', '1,0') // composante 1 : A-B
    rn.addRoute('2,0', '3,0') // composante 2 : C-D
    rn.compute()
    expect(rn.getBoostFactor('0,0', '2,0')).toBe(1.0) // A-C non connectés
    expect(rn.getBoostFactor('1,0', '3,0')).toBe(1.0) // B-D non connectés
    expect(rn.getBoostFactor('0,0', '1,0')).toBe(2.0) // A-B connectés
    expect(rn.getBoostFactor('2,0', '3,0')).toBe(2.0) // C-D connectés
  })

  // ─────────────────────────────────────────────────────────────
  // M2 fix — contrat API : getBoostFactor retourne 1.0 AVANT compute()
  // ─────────────────────────────────────────────────────────────
  it('getBoostFactor retourne 1.0 avant compute() — données périmées (contrat API Story 1.10)', () => {
    rn.addRoute('0,0', '1,0')
    // PAS de compute() — reachable est vide ou périmé
    expect(rn.getBoostFactor('0,0', '1,0')).toBe(1.0)
  })

  // ─────────────────────────────────────────────────────────────
  // M3 fix — AC#1 variante : graphe vide + markDirty() + compute() → dirty=false
  // ─────────────────────────────────────────────────────────────
  it('AC#1 variante — graphe vide + markDirty() : compute() parcourt la boucle vide et remet dirty=false', () => {
    rn.markDirty() // routesDirty = true sur graphe vide
    expect(rn.routesDirty).toBe(true)
    rn.compute() // doit parcourir adjacency.keys() (vide) et poser routesDirty = false
    expect(rn.routesDirty).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────
  // M1 fix — addRoute idempotent : double appel ne déclenche pas markDirty() en trop
  // ─────────────────────────────────────────────────────────────
  it('addRoute idempotent : double appel ne marque pas dirty après compute()', () => {
    rn.addRoute('0,0', '1,0')
    rn.compute() // dirty = false
    rn.addRoute('0,0', '1,0') // route déjà existante — ne doit PAS marquer dirty
    expect(rn.routesDirty).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────
  // M4 fix — self-route ignorée : addRoute(A, A) ne crée pas d'entrée en adjacency
  // ─────────────────────────────────────────────────────────────
  it('addRoute(A, A) self-route : ignorée, ne marque pas dirty', () => {
    rn.addRoute('0,0', '0,0') // self-route — doit être ignorée
    expect(rn.routesDirty).toBe(false) // markDirty() pas appelé
    rn.compute()
    expect(rn.getBoostFactor('0,0', '0,0')).toBe(1.0)
  })

  // ─────────────────────────────────────────────────────────────
  // removeRoute sur hex inexistant — pas d'erreur
  // ─────────────────────────────────────────────────────────────
  it('removeRoute sur hex inexistant : pas d\'erreur (opération idempotente)', () => {
    expect(() => rn.removeRoute('0,0', '99,99')).not.toThrow()
  })

  // ─────────────────────────────────────────────────────────────
  // Nettoyage des Sets vides après removeRoute
  // ─────────────────────────────────────────────────────────────
  it('removeRoute supprime la dernière route d\'un hex : compute() ne boost plus le hex', () => {
    rn.addRoute('0,0', '1,0')
    rn.compute()
    expect(rn.getBoostFactor('0,0', '1,0')).toBe(2.0)

    rn.removeRoute('0,0', '1,0') // les deux hexes n'ont plus aucune route
    rn.compute()
    expect(rn.getBoostFactor('0,0', '1,0')).toBe(1.0)
    expect(rn.getBoostFactor('1,0', '0,0')).toBe(1.0)
  })

  // ─────────────────────────────────────────────────────────────
  // Chaîne longue : vérifier tous les chemins transitifs
  // ─────────────────────────────────────────────────────────────
  it('chaîne A-B-C-D : tous les chemins transitifs sont boostés', () => {
    rn.addRoute('0,0', '1,0') // A-B
    rn.addRoute('1,0', '2,0') // B-C
    rn.addRoute('2,0', '3,0') // C-D
    rn.compute()

    expect(rn.getBoostFactor('0,0', '3,0')).toBe(2.0) // A-D (transitif)
    expect(rn.getBoostFactor('3,0', '0,0')).toBe(2.0) // D-A (symétrie transitive)
    expect(rn.getBoostFactor('0,0', '2,0')).toBe(2.0) // A-C
    expect(rn.getBoostFactor('1,0', '3,0')).toBe(2.0) // B-D
  })
})
