import { createDatabase, DEFAULT_DB_PATH } from './client'
import { seedDatabase } from './seed'

const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DB_PATH
const seed = Number(process.env.SEED ?? 42)

const db = createDatabase(databaseUrl)
const result = seedDatabase(db, { seed })

console.log(`Banco carregado em ${databaseUrl}`)
console.table(result)
