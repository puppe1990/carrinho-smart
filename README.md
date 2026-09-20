# CarrinhoSmart 🛒

Aplicativo mobile-first de **carrinho inteligente e controle de orçamento** para supermercado. Você bipa os produtos, acompanha o gasto em tempo real contra uma meta, gerencia a lista de compras e fecha a compra com um recibo e resumo por categoria.

Construído com **TanStack Start + SQLite**, seguindo **TDD** (Vitest) e com dados de demonstração gerados por **faker**.

> Baseado nos mockups do projeto Stitch _Smart Cart Retail & Budgeting_ (`DESIGN.md`), com o design system traduzido para tokens do Tailwind v4.

---

## 📱 Telas

| Rota                  | Tela                     | Descrição                                                                                                                                             |
| --------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                   | **Carrinho + Orçamento** | Monitor de gasto em tempo real, meta ajustável, gauge, busca, filtros por categoria, stepper de quantidade, economia e dock "Ir ao caixa".            |
| `/scanner`            | **Scanner de produtos**  | Viewfinder simulado, leitura por código de barras (EAN), preço na etiqueta, quantidade, toggle de promoção e impacto no orçamento antes de adicionar. |
| `/lista`              | **Lista de compras**     | Progresso (anel + barra), itens pendentes vs. já no carrinho, adição rápida e "bipar" item da lista direto para o carrinho.                           |
| `/historico`          | **Histórico**            | Visão mensal (gasto, meta, economia, frequência), navegação por mês, busca e filtros por mercado.                                                     |
| `/resumo`             | **Resumo do mês**        | Totais do mês, performance vs. meta, distribuição de gastos por categoria e compras do período.                                                       |
| `/compra/$purchaseId` | **Recibo**               | Resumo da compra finalizada: total pago, economia, distribuição por categoria e recibo item a item.                                                   |

---

## 🧱 Stack

- **[TanStack Start](https://tanstack.com/start)** (React 19, roteamento por arquivos, **server functions**)
- **SQLite** via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) (sem ORM)
- **Tailwind CSS v4** (tokens do design system em `@theme`)
- **Vitest** para testes
- **[faker](https://fakerjs.dev/)** para seed determinístico
- **Nitro** como servidor de produção

---

## 🚀 Começando

Requisitos: **Node.js >= 22** e npm.

```bash
npm install
npm run seed     # popula o SQLite com dados de demonstração (faker, seed 42)
npm run dev      # http://localhost:3000
```

O banco é criado automaticamente em `data/carrinhosmart.db`. Se estiver vazio, a aplicação roda o seed na primeira requisição — então `npm run seed` é opcional para começar.

### Scripts

| Script                    | Descrição                                          |
| ------------------------- | -------------------------------------------------- |
| `npm run dev`             | Servidor de desenvolvimento (Vite, porta 3000).    |
| `npm run build`           | Build de produção (Nitro, saída em `.output`).     |
| `npm run preview`         | Pré-visualiza o build de produção.                 |
| `npm test`                | Roda toda a suíte de testes (Vitest).              |
| `npm run test:watch`      | Testes em modo watch.                              |
| `npm run typecheck`       | Checagem de tipos (`tsc --noEmit`).                |
| `npm run lint`            | ESLint (flat config) com zero warnings permitidos. |
| `npm run lint:fix`        | ESLint aplicando correções automáticas.            |
| `npm run format`          | Formata o projeto com Prettier.                    |
| `npm run format:check`    | Verifica a formatação sem alterar arquivos.        |
| `npm run seed`            | (Re)popula o banco com faker.                      |
| `npm run db:reset`        | Apaga o banco e roda o seed novamente.             |
| `npm run generate-routes` | Regenera o `routeTree.gen.ts`.                     |

---

## 🏗️ Arquitetura

O código é organizado em camadas, cada uma com sua própria suíte de testes:

```
src/
├── domain/                 # Regras de negócio puras (sem I/O, sem React, sem SQL)
│   ├── money.ts            # Formatação/parsing BRL, quantidades (un/kg/L)
│   ├── budget.ts           # Status da meta, níveis (safe/warning/over), gauge segmentado
│   ├── cart.ts             # Totais, subtotais, economia, quantidade, itens extras
│   ├── shopping-list.ts    # Progresso da lista, agrupamento, quick add
│   ├── analytics.ts        # Distribuição por categoria, visão mensal, tendência de preço
│   └── types.ts            # Tipos compartilhados
│
├── server/
│   ├── db/
│   │   ├── schema.ts       # DDL + migrate()
│   │   ├── client.ts       # Conexão (factory + singleton)
│   │   ├── repositories.ts # Acesso a dados (products, carts, lists, purchases, price_history)
│   │   ├── seed.ts         # Geração de dados com faker (determinístico)
│   │   └── runtime.ts      # Repositório singleton + auto-seed
│   ├── services/           # Orquestração testável sobre os repositórios
│   │   ├── cart-service.ts
│   │   ├── scanner-service.ts
│   │   ├── list-service.ts
│   │   └── history-service.ts
│   └── functions/          # Server functions consumidas pelas rotas
│
├── components/             # UI reutilizável (nav, gauge, anel de progresso, sheet...)
└── routes/                 # Telas (file-based routing do TanStack Router)
```

**Fluxo de dados:** `route loader → server function → service → repository → SQLite`. Mutações chamam a server function e depois `router.invalidate()` para recarregar o loader.

---

## ✅ TDD

O desenvolvimento seguiu o ciclo **red → green → refactor**, escrevendo os testes antes da implementação em cada camada.

- **82 testes** em **8 arquivos**, rodando com `npm test`.
- Domínio: funções puras cobrindo dinheiro, orçamento, carrinho, lista e analytics.
- Persistência: repositórios testados com **SQLite em memória** (`:memory:`), incluindo checkout transacional e histórico de preços.
- Seed: garante determinismo por seed, idempotência e reset limpo.
- Serviços: fluxos completos (overview do carrinho, leitura por código de barras, bipar item da lista, agregações mensais e recibo).

```bash
npm test        # 82 passing
npm run typecheck
npm run build
```

---

## 🔍 Qualidade, CI e pre-commit

- **ESLint** (flat config) com `typescript-eslint`, `react-hooks` e `react-refresh` — `npm run lint` roda com `--max-warnings 0`.
- **Prettier** como fonte de verdade da formatação — `npm run format:check` valida no CI.
- **Husky + lint-staged**: a cada commit o hook `.husky/pre-commit` roda:
  1. `lint-staged` → `eslint --fix` + `prettier --write` nos arquivos alterados;
  2. `npm test` → a suíte completa de testes.

Instale os hooks automaticamente com `npm install` (o script `prepare` executa `husky`).

- **GitHub Actions** (`.github/workflows/ci.yml`): em cada push/PR para `main` roda, no Node 22:
  `format:check` → `lint` → `typecheck` → `test` → `build`.

---

## 🗄️ Modelo de dados

| Tabela                          | Papel                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `categories`                    | Categorias (mercearia, laticínios, hortifrúti, limpeza, higiene, padaria).                   |
| `stores`                        | Mercados disponíveis para troca de loja.                                                     |
| `products`                      | Catálogo com `barcode` (EAN), unidade, preço de referência, corredor.                        |
| `shopping_lists` / `list_items` | Lista ativa, itens pendentes e escaneados (com preço esperado vs. bipado).                   |
| `carts` / `cart_items`          | Carrinho ativo por loja, linhas com preço, quantidade, promoção e vínculo com item da lista. |
| `purchases` / `purchase_items`  | Compras finalizadas (histórico, resumo e recibo).                                            |
| `price_history`                 | Preços registrados por produto/loja para sugerir preço e calcular tendência.                 |

Os valores monetários são armazenados **em centavos (inteiros)** para evitar erros de ponto flutuante.

---

## 🎨 Design system

Os tokens do `DESIGN.md` (cores, tipografia Plus Jakarta Sans, raios, elevação) foram portados para o `@theme` do Tailwind v4 em `src/styles.css`, reproduzindo a estética _Modern Tactile Minimalism_ dos mockups — gauge segmentado, chips, steppers táteis, bottom navigation com FAB central e safe areas.

---

## 🧪 Dados de demonstração

O seed (`src/server/db/seed.ts`) cria 6 categorias, 4 mercados, ~29 produtos, uma lista ativa com itens pendentes/escaneados, um carrinho em uso e histórico de compras em vários meses. É **determinístico**: `SEED=42 npm run seed`.

```bash
SEED=7 npm run seed
```

---

## 📄 Licença

MIT.
