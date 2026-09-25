// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MissingProductActions, RegisterMissingProductForm } from './RegisterMissingProduct'

afterEach(() => cleanup())

const CATEGORIES = [
  { id: 'mercearia', name: 'Mercearia' },
  { id: 'laticinios', name: 'Laticínios' },
]

describe('MissingProductActions', () => {
  it('mostra só a correção do código quando o usuário não é admin', () => {
    render(
      <MissingProductActions
        message="Nenhum produto cadastrado para o código 7891000000014."
        isAdmin={false}
        onCorrectCode={() => {}}
        onRegister={() => {}}
      />,
    )

    expect(screen.getByText(/Nenhum produto cadastrado/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Corrigir código' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cadastrar produto' })).toBeNull()
  })

  it('oferece cadastrar o produto quando o usuário é admin', () => {
    const onRegister = vi.fn()
    render(
      <MissingProductActions
        message="Nenhum produto cadastrado para o código 7891000000014."
        isAdmin
        onCorrectCode={() => {}}
        onRegister={onRegister}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar produto' }))
    expect(onRegister).toHaveBeenCalledTimes(1)
  })
})

describe('RegisterMissingProductForm', () => {
  it('envia o cadastro com o código lido, nome, categoria e preço', () => {
    const onSubmit = vi.fn()
    render(
      <RegisterMissingProductForm
        barcode="7891000000014"
        categories={CATEGORIES}
        initialPrice="12.90"
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Leite Integral' } })
    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Itambé' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'laticinios' } })
    fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'L' } })
    fireEvent.change(screen.getByLabelText('Corredor'), { target: { value: '3' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Cadastrar produto ausente' }))

    expect(onSubmit).toHaveBeenCalledWith({
      barcode: '7891000000014',
      name: 'Leite Integral',
      brand: 'Itambé',
      categoryId: 'laticinios',
      unit: 'L',
      priceCents: 1290,
      aisle: '3',
    })
  })

  it('permite corrigir o código lido antes de cadastrar', () => {
    const onSubmit = vi.fn()
    render(
      <RegisterMissingProductForm
        barcode="7890000000009"
        categories={CATEGORIES}
        initialPrice="8.50"
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText('Código de barras'), {
      target: { value: '9990000000012' },
    })
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Leite Teste' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Cadastrar produto ausente' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ barcode: '9990000000012', name: 'Leite Teste' }),
    )
  })

  it('explica EAN-13 inválido antes de enviar o cadastro', () => {
    const onSubmit = vi.fn()
    render(
      <RegisterMissingProductForm
        barcode="7890000000009"
        categories={CATEGORIES}
        initialPrice="8.50"
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Leite Teste' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Cadastrar produto ausente' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        'Código de barras EAN-13 inválido. Confira os dígitos ou corrija o código lido.',
      ),
    ).toBeTruthy()
  })

  it('não envia sem nome e explica o que falta', () => {
    const onSubmit = vi.fn()
    render(
      <RegisterMissingProductForm
        barcode="7891000000014"
        categories={CATEGORIES}
        initialPrice="5.00"
        onSubmit={onSubmit}
      />,
    )

    fireEvent.submit(screen.getByRole('form', { name: 'Cadastrar produto ausente' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Informe o nome do produto para cadastrá-lo.')).toBeTruthy()
  })

  it('bloqueia o cadastro quando não há categoria no catálogo', () => {
    const onSubmit = vi.fn()
    render(
      <RegisterMissingProductForm
        barcode="7891000000014"
        categories={[]}
        initialPrice="5.00"
        onSubmit={onSubmit}
      />,
    )

    expect(
      screen.getByText('Cadastre uma categoria no painel admin antes de adicionar este produto.'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cadastrar produto' })).toHaveProperty(
      'disabled',
      true,
    )
  })
})
