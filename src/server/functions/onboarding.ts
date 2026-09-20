import { createServerFn } from '@tanstack/react-start'
import { requireSession } from '../auth/session'
import {
  getOnboardingState,
  markWelcomeShown,
  seedDemoForUser,
} from '../services/onboarding-service'

export const fetchOnboarding = createServerFn({ method: 'GET' }).handler(async () => {
  const { repo, user } = await requireSession()
  return getOnboardingState(repo, user.id)
})

export const startWithDemoData = createServerFn({ method: 'POST' }).handler(async () => {
  const { db, repo, user } = await requireSession()
  return seedDemoForUser(db, repo, user.id)
})

export const dismissWelcome = createServerFn({ method: 'POST' }).handler(async () => {
  const { repo, user } = await requireSession()
  markWelcomeShown(repo, user.id)
  return { welcomeShown: true }
})
