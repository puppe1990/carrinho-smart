import { createContext, useContext } from 'react'

export interface SessionUser {
  id: string
  email: string
  name: string
  image: string | null
}

export const AuthContext = createContext<SessionUser | null>(null)

export function useAuthUser(): SessionUser | null {
  return useContext(AuthContext)
}
