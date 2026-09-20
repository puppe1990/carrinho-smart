import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./session', () => ({
  getCurrentUser: vi.fn(),
  requireSession: vi.fn(),
}))

import { adminEmails, getAdminSession, isAdminEmail, requireAdmin } from './admin'
import { getCurrentUser, requireSession } from './session'

const ORIGINAL = process.env.ADMIN_EMAILS

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS
  else process.env.ADMIN_EMAILS = ORIGINAL
})

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset()
  vi.mocked(requireSession).mockReset()
})

describe('admin allowlist', () => {
  it('retorna lista vazia quando ADMIN_EMAILS não está definido', () => {
    delete process.env.ADMIN_EMAILS
    expect(adminEmails()).toEqual([])
  })

  it('separa a lista por vírgula, apara e converte para minúsculas', () => {
    process.env.ADMIN_EMAILS = ' Admin@Example.com , second@x.dev '
    expect(adminEmails()).toEqual(['admin@example.com', 'second@x.dev'])
  })

  it('é fail-closed sem configuração', () => {
    delete process.env.ADMIN_EMAILS
    expect(isAdminEmail('admin@example.com')).toBe(false)
  })

  it('compara e-mails sem diferenciar maiúsculas', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    expect(isAdminEmail('ADMIN@Example.com')).toBe(true)
    expect(isAdminEmail('other@example.com')).toBe(false)
  })

  it('rejeita null e undefined', () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
  })

  it('trata configuração vazia ou só separadores como fail-closed', () => {
    process.env.ADMIN_EMAILS = ''
    expect(adminEmails()).toEqual([])
    process.env.ADMIN_EMAILS = ' , ,, '
    expect(adminEmails()).toEqual([])
    expect(isAdminEmail('admin@example.com')).toBe(false)
  })
})

describe('admin session guards', () => {
  const user = { id: 'u1', email: 'admin@example.com', name: 'Admin', image: null }

  it('requireAdmin retorna o contexto para um admin', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    const context = { user }
    vi.mocked(requireSession).mockResolvedValue(context as never)

    await expect(requireAdmin()).resolves.toMatchObject({ user })
  })

  it('requireAdmin bloqueia usuário fora da allowlist', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    vi.mocked(requireSession).mockResolvedValue({
      user: { ...user, email: 'outro@example.com' },
    } as never)

    await expect(requireAdmin()).rejects.toThrow('FORBIDDEN_ADMIN')
  })

  it('requireAdmin propaga UNAUTHENTICATED sem sessão', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    vi.mocked(requireSession).mockRejectedValue(new Error('UNAUTHENTICATED'))

    await expect(requireAdmin()).rejects.toThrow('UNAUTHENTICATED')
  })

  it('getAdminSession sinaliza admin e não-admin', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'

    vi.mocked(getCurrentUser).mockResolvedValue(user)
    await expect(getAdminSession()).resolves.toEqual({ user, isAdmin: true })

    vi.mocked(getCurrentUser).mockResolvedValue({ ...user, email: 'outro@example.com' })
    await expect(getAdminSession()).resolves.toMatchObject({ isAdmin: false })

    vi.mocked(getCurrentUser).mockResolvedValue(null)
    await expect(getAdminSession()).resolves.toEqual({ user: null, isAdmin: false })
  })
})
