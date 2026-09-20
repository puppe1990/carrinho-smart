import { createAuth, migrateAuth, type Auth } from '../auth/auth'
import { getDatabase, type Database } from './client'
import { createRepository, type Repository } from './repositories'
import { ensureUserData, seedCatalog } from './seed'

export interface Runtime {
  db: Database
  repo: Repository
  auth: Auth
}

let runtimePromise: Promise<Runtime> | null = null

export function getRuntime(): Promise<Runtime> {
  if (!runtimePromise) runtimePromise = initRuntime()
  return runtimePromise
}

async function initRuntime(): Promise<Runtime> {
  const db = getDatabase()
  const repo = createRepository(db)

  if (repo.stores.list().length === 0) {
    seedCatalog(repo, { seed: Number(process.env.SEED ?? 42) })
  }

  const auth = createAuth(db, {
    onUserCreated: (user) => {
      ensureUserData(db, repo, user.id)
    },
  })

  await migrateAuth(auth)

  return { db, repo, auth }
}
