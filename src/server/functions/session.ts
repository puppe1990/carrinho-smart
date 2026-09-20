import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '../auth/session'

export const fetchSession = createServerFn({ method: 'GET' }).handler(() => getCurrentUser())
