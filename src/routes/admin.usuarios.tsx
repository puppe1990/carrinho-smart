import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { formatBRL } from '../domain/money'
import {
  AdminCell,
  AdminPageHeader,
  AdminRow,
  AdminTable,
  Pagination,
  SearchInput,
} from '../components/admin/primitives'
import { fetchAdminUsers } from '../server/functions/admin'
import { useDebouncedValue } from '../hooks/use-debounced-value'

const PAGE_SIZE = 20

interface UserSearch {
  q?: string
  pagina?: number
}

export const Route = createFileRoute('/admin/usuarios')({
  validateSearch: (search: Record<string, unknown>): UserSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    pagina: Number(search.pagina) > 0 ? Number(search.pagina) : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q, pagina: search.pagina }),
  loader: ({ deps }) =>
    fetchAdminUsers({
      data: { search: deps.q, page: deps.pagina ?? 1, pageSize: PAGE_SIZE },
    }),
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const { items, total, page, pageSize } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const [query, setQuery] = useState(search.q ?? '')
  const debouncedQuery = useDebouncedValue(query)
  const lastDebounced = useRef(debouncedQuery)

  useEffect(() => {
    const urlValue = search.q ?? ''
    setQuery((current) => (current === urlValue ? current : urlValue))
  }, [search.q])

  useEffect(() => {
    if (debouncedQuery === lastDebounced.current) return
    lastDebounced.current = debouncedQuery
    const next = debouncedQuery || undefined
    if ((search.q ?? '') === (next ?? '')) return
    navigate({
      replace: true,
      search: (prev: UserSearch) => ({ ...prev, q: next, pagina: undefined }),
    })
  }, [debouncedQuery, search.q, navigate])

  return (
    <div>
      <AdminPageHeader
        title="Usuários"
        description="Contas cadastradas e seus indicadores de uso."
      />

      <div className="mb-4">
        <SearchInput value={query} placeholder="Buscar por nome ou e-mail" onChange={setQuery} />
      </div>

      <AdminTable
        columns={[
          { key: 'name', label: 'Usuário' },
          { key: 'lists', label: 'Listas', align: 'right' },
          { key: 'carts', label: 'Carrinhos', align: 'right' },
          { key: 'purchases', label: 'Compras', align: 'right' },
          { key: 'spent', label: 'Total gasto', align: 'right' },
          { key: 'detail', label: '', align: 'right' },
        ]}
        empty={items.length === 0}
      >
        {items.map((user) => (
          <AdminRow key={user.id}>
            <AdminCell>
              <div className="font-semibold">{user.name}</div>
              <div className="text-[11px] text-on-surface-variant">{user.email}</div>
            </AdminCell>
            <AdminCell align="right">{user.listCount}</AdminCell>
            <AdminCell align="right">{user.cartCount}</AdminCell>
            <AdminCell align="right">{user.purchaseCount}</AdminCell>
            <AdminCell align="right">
              <span className="tnum font-semibold">{formatBRL(user.totalSpentCents)}</span>
            </AdminCell>
            <AdminCell align="right">
              <Link
                to="/admin/usuarios/$userId"
                params={{ userId: user.id }}
                className="text-sm font-bold text-primary hover:underline"
              >
                Ver
              </Link>
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPage={(next) =>
          navigate({
            search: (prev: UserSearch) => ({ ...prev, pagina: next === 1 ? undefined : next }),
          })
        }
      />
    </div>
  )
}
