import { Link, createFileRoute } from '@tanstack/react-router'
import { formatDate } from '../domain/date'
import { formatBRL } from '../domain/money'
import {
  AdminCell,
  AdminPageHeader,
  AdminRow,
  AdminTable,
  StatCard,
} from '../components/admin/primitives'
import { fetchAdminUserDetail } from '../server/functions/admin'

export const Route = createFileRoute('/admin/usuarios/$userId')({
  loader: ({ params }) => fetchAdminUserDetail({ data: { userId: params.userId } }),
  component: AdminUserDetailPage,
})

function AdminUserDetailPage() {
  const { user, lists, carts, purchases } = Route.useLoaderData()

  return (
    <div>
      <Link to="/admin/usuarios" className="text-sm font-semibold text-primary hover:underline">
        ← Voltar para usuários
      </Link>
      <div className="mt-3">
        <AdminPageHeader title={user.name} description={user.email} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Listas" value={String(user.listCount)} icon="checklist" />
        <StatCard label="Carrinhos" value={String(user.cartCount)} icon="shopping_cart" />
        <StatCard label="Compras" value={String(user.purchaseCount)} icon="receipt_long" />
        <StatCard label="Total gasto" value={formatBRL(user.totalSpentCents)} icon="payments" />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold text-on-surface">Compras</h2>
      <AdminTable
        columns={[
          { key: 'store', label: 'Loja' },
          { key: 'items', label: 'Itens', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
          { key: 'date', label: 'Data', align: 'right' },
        ]}
        empty={purchases.length === 0}
      >
        {purchases.map((purchase) => (
          <AdminRow key={purchase.id}>
            <AdminCell>{purchase.storeName || '—'}</AdminCell>
            <AdminCell align="right">{purchase.itemCount}</AdminCell>
            <AdminCell align="right">
              <span className="tnum font-semibold">{formatBRL(purchase.totalCents)}</span>
            </AdminCell>
            <AdminCell align="right">{formatDate(purchase.purchasedAt)}</AdminCell>
          </AdminRow>
        ))}
      </AdminTable>

      <h2 className="mb-3 mt-8 text-lg font-bold text-on-surface">Listas e carrinhos</h2>
      <AdminTable
        columns={[
          { key: 'type', label: 'Tipo' },
          { key: 'name', label: 'Descrição' },
          { key: 'status', label: 'Status' },
          { key: 'date', label: 'Criado em', align: 'right' },
        ]}
        empty={lists.length === 0 && carts.length === 0}
      >
        {lists.map((list) => (
          <AdminRow key={list.id}>
            <AdminCell>Lista</AdminCell>
            <AdminCell>{list.name}</AdminCell>
            <AdminCell>{list.status}</AdminCell>
            <AdminCell align="right">{formatDate(list.shoppingDate)}</AdminCell>
          </AdminRow>
        ))}
        {carts.map((cart) => (
          <AdminRow key={cart.id}>
            <AdminCell>Carrinho</AdminCell>
            <AdminCell>{formatBRL(cart.budgetCents)} de orçamento</AdminCell>
            <AdminCell>{cart.status}</AdminCell>
            <AdminCell align="right">{formatDate(cart.createdAt)}</AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </div>
  )
}
