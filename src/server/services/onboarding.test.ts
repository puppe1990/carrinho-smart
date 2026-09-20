import { beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type Database } from '../db/client'
import { createRepository, type Repository } from '../db/repositories'
import { seedCatalog } from '../db/seed'
import {
  getOnboardingState,
  markWelcomeShown,
  needsWelcome,
  seedDemoForUser,
} from './onboarding-service'

const USER = 'user-new'

let db: Database
let repo: Repository

beforeEach(() => {
  db = createDatabase(':memory:')
  repo = createRepository(db)
  seedCatalog(repo, { seed: 42 })
})

describe('getOnboardingState', () => {
  it('reports an empty account as new and needing onboarding', () => {
    const state = getOnboardingState(repo, USER)
    expect(state.isEmpty).toBe(true)
    expect(state.hasDemoData).toBe(false)
    expect(state.welcomeShown).toBe(false)
    expect(state.hasCart).toBe(false)
    expect(state.hasList).toBe(false)
    expect(state.storeName).toBeTruthy()
    expect(state.productCount).toBeGreaterThan(0)
  })

  it('flags welcome for a brand new user once, and never after marking it shown', () => {
    const empty = getOnboardingState(repo, USER)
    expect(needsWelcome({ ...empty, welcomeShown: false })).toBe(true)
    expect(needsWelcome({ ...empty, welcomeShown: true })).toBe(false)

    markWelcomeShown(repo, USER)
    expect(needsWelcome(getOnboardingState(repo, USER))).toBe(false)
  })

  it('flips to populated after seeding the demo data', () => {
    seedDemoForUser(db, repo, USER)
    const state = getOnboardingState(repo, USER)
    expect(state.isEmpty).toBe(false)
    expect(state.hasDemoData).toBe(true)
    expect(state.hasCart).toBe(true)
    expect(state.hasList).toBe(true)
  })
})

describe('markWelcomeShown', () => {
  it('persists the flag and stops asking for the welcome', () => {
    expect(getOnboardingState(repo, USER).welcomeShown).toBe(false)
    markWelcomeShown(repo, USER)
    expect(getOnboardingState(repo, USER).welcomeShown).toBe(true)
    expect(needsWelcome(getOnboardingState(repo, USER))).toBe(false)
  })

  it('is idempotent', () => {
    markWelcomeShown(repo, USER)
    markWelcomeShown(repo, USER)
    expect(getOnboardingState(repo, USER).welcomeShown).toBe(true)
  })
})

describe('seedDemoForUser', () => {
  it('creates isolated demo data and a catalog-backed cart without duplicating on repeat', () => {
    seedDemoForUser(db, repo, USER)
    const firstCart = repo.carts.getActive(USER, 'store-pao-de-acucar')!
    const firstLines = repo.carts.listLines(firstCart.id)

    seedDemoForUser(db, repo, USER)
    const secondCart = repo.carts.getActive(USER, 'store-pao-de-acucar')!
    expect(secondCart.id).not.toBe(firstCart.id)
    expect(repo.carts.listLines(secondCart.id).length).toBe(firstLines.length)
    expect(repo.lists.getActive(USER)?.userId).toBe(USER)
  })
})
