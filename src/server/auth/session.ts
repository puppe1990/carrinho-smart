import { getRequestHeaders } from '@tanstack/react-start/server'
import { getRuntime } from '../db/runtime'
import type { Database } from '../db/client'
import type { Repository } from '../db/repositories'
import { resolveUser, type AuthUser } from './auth'

export interface AuthContext {
  db: Database
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
  return { db: runtime.db, repo: runtime.repo, user }
}
