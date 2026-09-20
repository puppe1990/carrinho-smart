import { createAuth, migrateAuth } from '../auth/auth'
import { createDatabase, DEFAULT_DB_PATH } from './client'
import { DEMO_USER, seedDatabase } from './seed'

const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DB_PATH
const seed = Number(process.env.SEED ?? 42)

const db = createDatabase(databaseUrl)
const auth = createAuth(db)
await migrateAuth(auth)

let userId = (
  db.prepare('SELECT id FROM user WHERE email = ?').get(DEMO_USER.email) as
    { id: string } | undefined
)?.id

if (!userId) {
  const created = await auth.api.signUpEmail({
    body: { email: DEMO_USER.email, password: DEMO_USER.password, name: DEMO_USER.name },
  })
  userId = created.user.id
}

const result = seedDatabase(db, { seed, userId })

console.log(`Banco carregado em ${databaseUrl}`)
console.table(result)
console.log(`Login de demonstração: ${DEMO_USER.email} / ${DEMO_USER.password}`)
