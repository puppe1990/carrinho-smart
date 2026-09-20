import { getRequestHeaders } from '@tanstack/react-start/server'
import { getRuntime } from '../db/runtime'
import type { Repository } from '../db/repositories'
import { resolveUser, type AuthUser } from './auth'

export interface AuthContext {
  repo: Repository
  user: AuthUser
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { auth } = await getRuntime()
  return resolveUser(auth, getRequestHeaders())
}

export async function requireSession(): Promise<AuthContext> {
  const runtime = await getRuntime()
  const user = await resolveUser(runtime.auth, getRequestHeaders())
  if (!user) {
    throw new Error('UNAUTHENTICATED')
  }
  return { repo: runtime.repo, user }
}
