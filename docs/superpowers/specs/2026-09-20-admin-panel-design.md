# Painel Admin — Design

Data: 2026-09-20
Status: aprovado (design), aguardando plano de implementação

## Objetivo

Criar uma área administrativa com design desktop em `/admin`, protegida por allowlist de
e-mails, onde um administrador gerencia **lojas**, **produtos** e **categorias** (CRUD
completo) e **usuários** (somente leitura).

Hoje o app é mobile-first (`RootLayout` limita a `max-w-lg` e mostra `BottomNav`) e **não
existe nenhum conceito de admin/role**: o Better Auth está configurado apenas com
`emailAndPassword`. Os repositórios de `stores` e `products` só possuem insert/leitura.
Portanto a autorização e o CRUD admin precisam ser construídos do zero.

## Escopo

### Dentro do escopo

- Allowlist de admin via variável de ambiente `ADMIN_EMAILS`.
- Shell desktop próprio em `/admin`, fora do container mobile.
- CRUD completo de **lojas**, **produtos** e **categorias**.
- Leitura de **usuários** (listagem, busca e detalhe com listas/carrinhos/compras).
- Visão geral (dashboard) com métricas e compras recentes.
- Bloqueio de exclusão para registros em uso.
- Testes unitários de service/repositório e da checagem de admin.

### Fora do escopo (YAGNI)

- Papéis/permissões múltiplas, editar/banir/excluir usuários.
- Log de auditoria de ações administrativas.
- Upload de imagem de produto (usa URL).
- Gestão de estoque/quantidade.
- Backoffice de sessões, impersonation.

## Decisões

| Tema                               | Decisão                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| Autorização                        | Allowlist por env `ADMIN_EMAILS` (sem migração de schema, sem plugin) |
| Lojas/Produtos/Categorias          | CRUD completo                                                         |
| Usuários                           | Somente leitura                                                       |
| Layout                             | Shell desktop próprio em `/admin`, full-width, fora do `max-w-lg`     |
| Exclusão de produto/loja/categoria | Bloqueada se houver referências em uso                                |
| IDs                                | Gerados por `slugify(name)` com sufixo em caso de colisão             |
| Imagem de produto                  | URL (campo `image_url` existente)                                     |

## Arquitetura

Segue o padrão em camadas já existente:
`rota / componente → createServerFn → requireAdmin → service → repository → SQLite`.

### 1. Autorização — `src/server/auth/admin.ts` (novo)

- `adminEmails(): string[]` — lê `process.env.ADMIN_EMAILS`, separa por vírgula, faz
  `trim` e `toLowerCase`. Lista ausente/vazia ⇒ **ninguém é admin** (fail closed).
- `isAdminEmail(email?: string | null): boolean`.
- `getAdminSession(): Promise<{ user: AuthUser; isAdmin: boolean }>` — usa
  `getCurrentUser()` para o `beforeLoad` da rota.
- `requireAdmin(): Promise<AuthContext>` — chama `requireSession()` e valida
  `isAdminEmail(user.email)`; se falhar, lança `Error('FORBIDDEN_ADMIN')`.

Sem alteração de schema. A autorização é decidida apenas pelo e-mail da sessão.

### 2. Rotas — `src/routes/`

- `admin.tsx` — layout de `/admin`. `beforeLoad`: chama `getAdminSession()`; se não
  houver usuário, `redirect('/login')`; se não for admin, `redirect('/')`. Renderiza
  `<AdminShell><Outlet/></AdminShell>`.
- `admin.index.tsx` — Visão geral (`/admin`).
- `admin.lojas.tsx` — `/admin/lojas`.
- `admin.produtos.tsx` — `/admin/produtos`.
- `admin.categorias.tsx` — `/admin/categorias`.
- `admin.usuarios.tsx` — `/admin/usuarios`.
- `admin.usuarios.$userId.tsx` — `/admin/usuarios/$userId`, detalhe do usuário em rota
  dedicada (página, não modal), dado o volume de dados.

Ajustes em `src/routes/__root.tsx`:

- No `beforeLoad` do root, pular o redirect de onboarding quando
  `location.pathname.startsWith('/admin')` (admin não passa por `/bem-vindo`), mantendo a
  exigência de autenticação.
- Em `RootLayout`, se o path começar com `/admin`, renderizar `<Outlet/>` **sem** o
  container `mx-auto max-w-lg` e **sem** `BottomNav`; caso contrário, manter o shell mobile.

Ajuste em `src/components/BottomNav.tsx`: adicionar `/admin` a `HIDDEN_PREFIXES`.

### 3. Server functions — `src/server/functions/admin.ts` (novo)

Todas usam `requireAdmin()`. Validadores são callbacks simples (sem Zod), seguindo o
padrão do projeto.

- **Overview:** `fetchAdminOverview()` → contagens (usuários, lojas, produtos, categorias,
  compras), GMV (`sum(total_cents)`), compras recentes (limite de 8).
- **Lojas:** `listAdminStores()`, `createStore({ name, city })`,
  `updateStore({ id, name, city })`, `deleteStore({ id })`.
- **Produtos:** `listAdminProducts({ search?, categoryId?, page?, pageSize? })`,
  `createProduct({ barcode?, name, brand?, categoryId, unit, priceCents, imageUrl?, aisle? })`,
  `updateProduct({ id, ... })`, `deleteProduct({ id })`.
- **Categorias:** `listAdminCategories()`, `createCategory({ name, icon, color })`,
  `updateCategory({ id, name, icon, color })`, `deleteCategory({ id })`.
- **Usuários (leitura):** `listAdminUsers({ search?, page?, pageSize? })`,
  `getAdminUser({ userId })`.

### 4. Service — `src/server/services/admin-service.ts` (novo)

Responsável por validação e regras de negócio. Recebe `repo` (e helpers) e retorna dados
de domínio; sem I/O direto.

- `slugify(name)` — minúsculas, remove acentos, troca não-alfanuméricos por `-`, colapsa e
  apara `-`. Gera `id` único via verificação de existência + sufixo (`-2`, `-3`, ...).
- **Lojas:** nome obrigatório; `city` opcional. Exclusão bloqueada se existir em `carts`
  ou `purchases`.
- **Produtos:** nome obrigatório; `categoryId` deve existir; `priceCents` inteiro ≥ 0;
  `unit ∈ {un, kg, L}`; `barcode` opcional — quando presente, normaliza/valida EAN-13 via
  `src/domain/barcode.ts` e garante unicidade. Exclusão bloqueada se referenciado em
  `cart_items`, `list_items`, `purchase_items` ou `price_history`.
- **Categorias:** nome obrigatório; `icon` (Material Symbol, default `category`), `color ∈
{primary, secondary, tertiary, outline}`. Exclusão bloqueada se houver produtos com
  `category_id` igual.
- Erros retornados como mensagens amigáveis em pt-BR (ex.: `Não é possível excluir: 3
produtos usam esta categoria.`), no mesmo espírito de `friendlyError` do `AuthForm`.

### 5. Repositórios — `src/server/db/repositories.ts`

Adicionar métodos que faltam (mantendo o estilo de prepared statements):

- `categories`: `insert` (separado de `upsert`), `update`, `remove`, `countReferences(id)`
  (conta produtos e itens de lista que referenciam a categoria, cobrindo ambas as FKs).
- `stores`: `update`, `remove`, `countUsage(id)` (carts + purchases).
- `products`: `update`, `remove`, `countUsage(id)`, `adminList({ search, categoryId, limit,
offset })`, `adminCount({ search, categoryId })`.
- `users` (novo namespace, lê a tabela `user` do Better Auth): `list({ search, limit,
offset })`, `count({ search })`, `get(id)`, `stats(id)` (nº de listas, carrinhos,
  compras, total gasto).
- `purchases`: `adminListRecent(limit)`, `adminSumTotal()`.

Notas de modelagem de dados:

- `products.barcode` é `UNIQUE`; SQLite permite múltiplos `NULL`, então barcode vazio é
  gravado como `NULL`.
- `products.category_id` referencia `categories`; `carts.store_id` e `purchases.store_id`
  referenciam `stores`; tabelas de itens guardam `product_id` sem FK declarada — a checagem
  de uso é feita por `SELECT COUNT`.

### 6. UI desktop — `src/components/admin/` (novo)

- `AdminShell.tsx` — sidebar fixa (~240px) com logo, navegação (Visão geral, Lojas,
  Produtos, Categorias, Usuários), bloco de usuário com e-mail e "Sair"
  (`authClient.signOut()` → navega para `/login`), e link "Voltar ao app" (`/`). Topbar com
  título da página e ações. Conteúdo em `max-w-7xl`. Reaproveita tokens existentes
  (`bg-surface*`, `text-on-surface*`, `primary`, `outline`) e `Icon`.
- Primitivas novas:
  - `AdminTable` — header, linhas, coluna de ações, estado vazio e de carregamento.
  - `AdminModal` — dialog desktop (overlay + card centralizado) para formulários de
    criar/editar; fecha com Esc/backdrop.
  - `ConfirmDialog` — confirmação de exclusão, exibindo a mensagem de bloqueio quando
    aplicável.
  - `AdminField` / inputs de texto, select, número (preço em BRL), URL.
  - `StatCard`, `SearchInput`, `Pagination`.
  - Reutiliza `EmptyState` e `Icon` de `src/components/`.
- Comportamento: mutações chamam o server fn e depois `router.invalidate()`, como nas
  rotas atuais.
- Busca/filtro/paginação passam por `validateSearch` na rota (search params), mantendo
  estado na URL.
- Mobile: desktop-first; em telas pequenas a sidebar vira uma faixa superior rolável e as
  tabelas ganham scroll horizontal, sem esforço de UX mobile dedicada.

### 7. Documentação e ambiente

- `.env.example`: adicionar `ADMIN_EMAILS=demo@carrinhosmart.dev` com comentário
  explicando que é CSV de e-mails e que ausência desabilita o painel.
- `README.md`: seção curta "Painel admin" (como habilitar, rota `/admin`, o que gerencia).
- Rodar `npm run generate-routes` para regenerar `src/routeTree.gen.ts`.

## Contratos de dados (tipos retornados)

- `AdminOverview`: `{ counts: { users, stores, products, categories, purchases }, gmvCents,
recentPurchases: Array<{ id, storeName, totalCents, itemCount, purchasedAt,
userId, userName }> }`.
- `AdminStore`: `{ id, name, city, createdAt, usageCount }`.
- `AdminProduct`: `{ id, barcode, name, brand, categoryId, categoryName, unit, priceCents,
imageUrl, aisle, usageCount }`.
- `AdminCategory`: `{ id, name, icon, color, productCount, referenceCount }`.
- `AdminUserSummary`: `{ id, name, email, createdAt, listCount, cartCount, purchaseCount,
totalSpentCents }`.
- `AdminUserDetail`: `{ ...summary, lists: [...], carts: [...], purchases: [...] }`.

## Fluxos principais

1. **Acesso:** usuário autentica com e-mail presente em `ADMIN_EMAILS` → acessa `/admin`.
   E-mail fora da allowlist → `redirect('/')`. Não autenticado → `redirect('/login')`.
2. **Criar produto:** abre modal → preenche nome, categoria, preço, unidade, barcode/URL
   opcionais → salva → fecha modal, tabela atualiza (`router.invalidate`).
3. **Excluir produto em uso:** clica excluir → `ConfirmDialog` → server retorna erro
   amigável → dialog exibe o motivo e não exclui.
4. **Editar categoria:** abre modal com valores atuais → altera nome/ícone/cor → salva.
5. **Consultar usuário:** lista com busca → abre detalhe → vê listas, carrinhos e compras.

## Tratamento de erros

- Não-admin: `FORBIDDEN_ADMIN` no server fn e `redirect` no `beforeLoad`.
- Validação: mensagens específicas por campo (nome obrigatório, preço inválido, EAN
  inválido/duplicado, categoria inexistente).
- Exclusão bloqueada: mensagem com a contagem de referências.
- Falha de rede: mensagem genérica, sem quebrar a tela.

## Testes

- `src/server/auth/admin.test.ts`: `adminEmails`/`isAdminEmail` (CSV, trims, case, vazio ⇒
  false).
- `src/server/services/admin-service.test.ts` (in-memory `createDatabase(':memory:')` +
  `createRepository`):
  - CRUD de lojas/produtos/categorias.
  - Geração de slug e unicidade.
  - Guards de exclusão (loja/produto/categoria em uso) retornando erro.
  - Validações (nome, preço, unidade, categoria, EAN duplicado).
- Testes de repositório para as novas consultas admin.
- Sem testes de componente (segue convenção atual).

## Riscos e mitigações

- **Vazamento de dados entre usuários:** admin lê dados de todos. Mitigação: `requireAdmin`
  em toda função admin; nenhuma função admin é exposta sem checagem.
- **`ADMIN_EMAILS` mal configurado:** fail closed (lista vazia ⇒ sem admin).
- **Route tree desatualizada:** sempre rodar `npm run generate-routes`; o `vite dev`
  regenera automaticamente.
- **Escopo de exclusão:** bloqueio conservador evita órfãos no histórico.
