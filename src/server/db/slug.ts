/** Gera um slug estável a partir de um texto livre. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 48)
    .replace(/^-+|-+$/g, '')
}

/** Gera um slug único consultando `exists` e adicionando sufixo numérico se preciso. */
export function uniqueSlug(base: string, exists: (candidate: string) => boolean): string {
  const root = slugify(base) || 'item'
  if (!exists(root)) return root
  let suffix = 2
  while (exists(`${root}-${suffix}`)) suffix += 1
  return `${root}-${suffix}`
}
