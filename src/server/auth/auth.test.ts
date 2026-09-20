import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase, type Database } from '../db/client'
import { createAuth, migrateAuth, resolveUser, type Auth } from './auth'

const TEST_SECRET = 'test-secret-0123456789-0123456789'
const TEST_URL = 'http://localhost:3000'

let db: Database
let auth: Auth

beforeEach(async () => {
  db = createDatabase(':memory:')
  auth = createAuth(db, { secret: TEST_SECRET, baseURL: TEST_URL })
  await migrateAuth(auth)
})

async function signUp(email = 'ana@example.com', password = 'password123', name = 'Ana') {
  const result = await auth.api.signUpEmail({
    body: { email, password, name },
    returnHeaders: true,
  })
  const cookie = result.headers.get('set-cookie')!.split(';')[0]
  return { user: result.response.user, cookie }
}

describe('auth', () => {
  it('creates the auth tables via migrations', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row: any) => row.name)
    expect(tables).toEqual(expect.arrayContaining(['user', 'session', 'account', 'verification']))
  })

  it('signs up a user and issues a session cookie', async () => {
    const { user, cookie } = await signUp()
    expect(user.email).toBe('ana@example.com')
    expect(cookie).toContain('better-auth.session_token')
  })

  it('rejects a duplicate email', async () => {
    await signUp()
    await expect(signUp()).rejects.toThrow()
  })

  it('signs in with valid credentials and rejects a wrong password', async () => {
    const { user } = await signUp()

    const signIn = await auth.api.signInEmail({
      body: { email: 'ana@example.com', password: 'password123' },
      returnHeaders: true,
    })
    expect(signIn.response.user.id).toBe(user.id)

    await expect(
      auth.api.signInEmail({ body: { email: 'ana@example.com', password: 'wrong-password' } }),
    ).rejects.toThrow()
  })

  it('resolves the session user from request headers', async () => {
    const { user, cookie } = await signUp()
    const resolved = await resolveUser(auth, new Headers({ cookie }))
    expect(resolved?.id).toBe(user.id)
    expect(resolved?.email).toBe('ana@example.com')
  })

  it('returns null when there is no session cookie', async () => {
    expect(await resolveUser(auth, new Headers())).toBeNull()
  })

  it('calls onUserCreated after a new user is created', async () => {
    const onUserCreated = vi.fn()
    const hookedAuth = createAuth(db, {
      secret: TEST_SECRET,
      baseURL: TEST_URL,
      onUserCreated,
    })
    await migrateAuth(hookedAuth)
    const { user } = await (async () => {
      const result = await hookedAuth.api.signUpEmail({
        body: { email: 'bia@example.com', password: 'password123', name: 'Bia' },
        returnHeaders: true,
      })
      return { user: result.response.user }
    })()

    expect(onUserCreated).toHaveBeenCalledTimes(1)
    expect(onUserCreated.mock.calls[0][0]).toMatchObject({ id: user.id, email: 'bia@example.com' })
  })
})
