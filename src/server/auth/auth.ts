import { betterAuth } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import type { Database } from '../db/client'

export const DEV_AUTH_SECRET = 'carrinhosmart-development-secret-change-me'
export const DEFAULT_AUTH_URL = 'http://localhost:3000'

export interface AuthUser {
  id: string
  email: string
  name: string
  image: string | null
}

export interface CreateAuthOptions {
  secret?: string
  baseURL?: string
  onUserCreated?: (user: AuthUser) => void | Promise<void>
}

export function createAuth(db: Database, options: CreateAuthOptions = {}) {
  return betterAuth({
    database: db,
    secret: options.secret ?? process.env.BETTER_AUTH_SECRET ?? DEV_AUTH_SECRET,
    baseURL: options.baseURL ?? process.env.BETTER_AUTH_URL ?? DEFAULT_AUTH_URL,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    ...(options.onUserCreated
      ? {
          databaseHooks: {
            user: {
              create: {
                after: async (user: {
                  id: string
                  email: string
                  name: string
                  image?: string | null
                }) => {
                  await options.onUserCreated?.({
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image ?? null,
                  })
                },
              },
            },
          },
        }
      : {}),
  })
}

export type Auth = ReturnType<typeof createAuth>

export async function migrateAuth(auth: Auth): Promise<void> {
  const { runMigrations } = await getMigrations(auth.options)
  await runMigrations()
}

export async function resolveUser(auth: Auth, headers: Headers): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers })
  if (!session?.user) return null
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image ?? null,
  }
}
