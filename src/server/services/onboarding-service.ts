import type { Repository } from '../db/repositories'
import { seedUserData } from '../db/seed'
import type { Database } from '../db/client'

export interface OnboardingState {
  isEmpty: boolean
  hasDemoData: boolean
  welcomeShown: boolean
  hasCart: boolean
  hasList: boolean
  storeName: string | null
  productCount: number
}

function hasAnyUserData(repo: Repository, userId: string): boolean {
  return (
    repo.carts.getLatestActive(userId) !== null ||
    repo.lists.getActive(userId) !== null ||
    repo.purchases.list(userId).length > 0
  )
}

export function getOnboardingState(repo: Repository, userId: string): OnboardingState {
  const prefs = repo.preferences.get(userId)
  const hasCart = repo.carts.getLatestActive(userId) !== null
  const hasList = repo.lists.getActive(userId) !== null

  return {
    isEmpty: !hasAnyUserData(repo, userId),
    hasDemoData: prefs.demoDataSeeded,
    welcomeShown: prefs.welcomeShown,
    hasCart,
    hasList,
    storeName: repo.stores.list()[0]?.name ?? null,
    productCount: repo.products.list().length,
  }
}

export function needsWelcome(state: OnboardingState): boolean {
  return !state.welcomeShown
}

export function markWelcomeShown(repo: Repository, userId: string): void {
  repo.preferences.update(userId, { welcomeShown: true })
}

/** Popula dados de demonstração para o usuário (ação explícita, nunca automática no cadastro). */
export function seedDemoForUser(db: Database, repo: Repository, userId: string): OnboardingState {
  seedUserData(db, repo, userId)
  repo.preferences.update(userId, { demoDataSeeded: true })
  return getOnboardingState(repo, userId)
}

export function resetDemoData(db: Database, repo: Repository, userId: string): OnboardingState {
  seedUserData(db, repo, userId)
  repo.preferences.update(userId, { demoDataSeeded: true })
  return getOnboardingState(repo, userId)
}
