import { afterEach, describe, expect, it } from 'vitest'
import { adminEmails, isAdminEmail } from './admin'

const ORIGINAL = process.env.ADMIN_EMAILS

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS
  else process.env.ADMIN_EMAILS = ORIGINAL
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
})
