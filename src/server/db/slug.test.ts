import { describe, expect, it } from 'vitest'
import { slugify, uniqueSlug } from './slug'

describe('slugify', () => {
  it('remove acentos e aplica minúsculas', () => {
    expect(slugify('Pão de Açúcar')).toBe('pao-de-acucar')
  })

  it('troca símbolos por hífen e colapsa separadores', () => {
    expect(slugify('Café  Torrado -- 500g!')).toBe('cafe-torrado-500g')
  })

  it('apara hífens nas pontas', () => {
    expect(slugify('  --Leite--  ')).toBe('leite')
  })
})

describe('uniqueSlug', () => {
  it('retorna a base quando livre', () => {
    expect(uniqueSlug('Leite', () => false)).toBe('leite')
  })

  it('adiciona sufixo incremental em caso de colisão', () => {
    const taken = new Set(['leite', 'leite-2'])
    expect(uniqueSlug('Leite', (candidate) => taken.has(candidate))).toBe('leite-3')
  })

  it('usa "item" quando o nome não gera slug', () => {
    expect(uniqueSlug('!!!', () => false)).toBe('item')
  })
})
