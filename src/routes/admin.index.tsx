import { createFileRoute } from '@tanstack/react-router'
import { formatBRL } from '../domain/money'
import {
  AdminCell,
  AdminPageHeader,
  AdminRow,
  AdminTable,
  StatCard,
} from '../components/admin/primitives'
import { fetchAdminOverview } from '../server/functions/admin'

export const Route = createFileRoute('/admin/')({
  loader: () => fetchAdminOverview(),
  component: AdminOverviewPage,
})

function AdminOverviewPage() {
  const overview = Route.useLoaderData()

  return (
    <div>
      <AdminPageHeader
        title="Visão geral"
        description="Resumo da base de lojas, produtos, categorias e usuários."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Usuários" value={String(overview.counts.users)} icon="group" />
        <StatCard label="Lojas" value={String(overview.counts.stores)} icon="storefront" />
        <StatCard label="Produtos" value={String(overview.counts.products)} icon="inventory_2" />
        <StatCard label="Categorias" value={String(overview.counts.categories)} icon="category" />
        <StatCard label="Compras" value={String(overview.counts.purchases)} icon="receipt_long" />
      </div>

      <div className="mt-6 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Total transacionado (GMV)
        </span>
        <p className="tnum mt-1 text-3xl font-extrabold text-primary">
          {formatBRL(overview.gmvCents)}
        </p>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold text-on-surface">Compras recentes</h2>
      <AdminTable
        columns={[
          { key: 'user', label: 'Usuário' },
          { key: 'store', label: 'Loja' },
          { key: 'items', label: 'Itens', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
          { key: 'date', label: 'Data', align: 'right' },
        ]}
        empty={overview.recentPurchases.length === 0}
      >
        {overview.recentPurchases.map((purchase) => (
          <AdminRow key={purchase.id}>
            <AdminCell>{purchase.userName || '—'}</AdminCell>
            <AdminCell>{purchase.storeName || '—'}</AdminCell>
            <AdminCell align="right">{purchase.itemCount}</AdminCell>
            <AdminCell align="right">
              <span className="tnum font-semibold">{formatBRL(purchase.totalCents)}</span>
            </AdminCell>
            <AdminCell align="right">
              {new Date(purchase.purchasedAt).toLocaleDateString('pt-BR')}
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </div>
  )
}
