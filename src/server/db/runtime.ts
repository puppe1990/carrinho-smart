import { createAuth, migrateAuth, type Auth } from '../auth/auth'
import { getDatabase, type Database } from './client'
import { importReceipts } from './receipt-imports'
import { createRepository, type Repository } from './repositories'
import { seedCatalog } from './seed'

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

  // Contas novas começam vazias: dados de demonstração são opcionais (tela /bem-vindo).
  const auth = createAuth(db)

  await migrateAuth(auth)

  importReceipts(repo, db)

  return { db, repo, auth }
}
