import { createDatabase, getDatabase, type Database } from './client'
import { createRepository, type Repository } from './repositories'
import { seedDatabase } from './seed'

let repository: Repository | null = null

export function getRepo(): Repository {
  if (!repository) {
    const db = getDatabase()
    repository = createRepository(db)
    ensureSeeded(db, repository)
  }
  return repository
}

function ensureSeeded(db: Database, repo: Repository): void {
  if (repo.stores.list().length === 0) {
    seedDatabase(db, { seed: Number(process.env.SEED ?? 42) })
  }
}

export function getRepoForDatabase(db: Database): Repository {
  return createRepository(db)
}

export { createDatabase }
