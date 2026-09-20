import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { migrate } from './schema'

export type Database = Database.Database

export const DEFAULT_DB_PATH = 'data/carrinhosmart.db'

export function createDatabase(filename: string): Database {
  if (filename !== ':memory:') {
    const folder = dirname(filename)
    if (folder && folder !== '.' && !existsSync(folder)) {
      mkdirSync(folder, { recursive: true })
    }
  }

  const db = new Database(filename)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

let cached: Database | null = null

export function getDatabase(): Database {
  if (!cached) {
    cached = createDatabase(process.env.DATABASE_URL ?? DEFAULT_DB_PATH)
  }
  return cached
}

export function createTestDatabase(): Database {
  return createDatabase(':memory:')
}
