import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PageSizeSelect } from './PageSizeSelect'

afterEach(() => {
  cleanup()
})

describe('PageSizeSelect', () => {
  it('offers 20, 30, 40 and 50 a page, showing the current one', () => {
    render(<PageSizeSelect pageSize={30} onChange={vi.fn()} />)

    const select = screen.getByRole('combobox', { name: 'Per page' })
    expect(select).toHaveProperty('value', '30')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['20', '30', '40', '50'])
  })

  it('reports the new size as a number', () => {
    const onChange = vi.fn()
    render(<PageSizeSelect pageSize={20} onChange={onChange} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Per page' }), { target: { value: '50' } })

    expect(onChange).toHaveBeenCalledWith(50)
  })
})
