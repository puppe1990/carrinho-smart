import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AdminShell } from '../components/admin/AdminShell'
import { fetchAdminSession } from '../server/functions/admin'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const { user, isAdmin } = await fetchAdminSession()
    if (!user) throw redirect({ to: '/login' })
    if (!isAdmin) throw redirect({ to: '/' })
    return { user }
  },
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  )
}
