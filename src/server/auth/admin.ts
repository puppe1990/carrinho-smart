import type { AuthUser } from './auth'
import { getCurrentUser, requireSession, type AuthContext } from './session'

export const ADMIN_FORBIDDEN = 'FORBIDDEN_ADMIN'

/** Allowlist de e-mails admin lida de `ADMIN_EMAILS` (CSV). Vazia ⇒ ninguém é admin. */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return adminEmails().includes(email.trim().toLowerCase())
}

export async function getAdminSession(): Promise<{ user: AuthUser | null; isAdmin: boolean }> {
  const user = await getCurrentUser()
  return { user, isAdmin: isAdminEmail(user?.email) }
}

export async function requireAdmin(): Promise<AuthContext> {
  const context = await requireSession()
  if (!isAdminEmail(context.user.email)) {
    throw new Error(ADMIN_FORBIDDEN)
  }
  return context
}
