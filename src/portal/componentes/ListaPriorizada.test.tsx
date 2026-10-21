import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { montar } from '../../test/montar'
import { ListaPriorizada, type EntradaPriorizada } from './ListaPriorizada'
import { Seccion } from './Seccion'

// hallazgo U-05 (DD-13): un grupo de avisos muestra solo lo más urgente, con su motivo, y «Ver los N» hacia la lista filtrada;
// nunca un muro de títulos subrayados
const entradas = (n: number): EntradaPriorizada[] =>
  Array.from({ length: n }, (_, i) => ({
    clave: `c${i}`,
    titulo: `Compromiso ${i + 1}`,
    a: `/commitments/c${i}`,
    motivo: `Vencido hace ${i + 1} días`,
    tono: i === 0 ? 'peligro' : i === 1 ? 'aviso' : 'neutro'
  }))

const grupo = () => screen.getByRole('region', { name: /Compromisos vencidos/ })

describe('ListaPriorizada', () => {
  it('CA-1.7.1: con 16 entradas y el límite 3 dibuja tres y «Ver los 16» hacia la lista filtrada', () => {
    montar(<ListaPriorizada titulo="Compromisos vencidos" total={16} entradas={entradas(16)} limite={3} verTodos={{ a: '/commitments?view=vencidos' }} />)
    const lista = within(grupo()).getByRole('list')
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3)
    expect(
      within(lista)
        .getAllByRole('link')
        .map((a) => a.textContent)
    ).toEqual(['Compromiso 1', 'Compromiso 2', 'Compromiso 3'])
    expect(within(grupo()).getByRole('link', { name: 'Ver los 16' })).toHaveAttribute('href', '/commitments?view=vencidos')
    // el conteo del grupo se ve junto a su título
    expect(within(grupo()).getByRole('heading', { name: /Compromisos vencidos/ })).toHaveTextContent('16')
  })

  it('el límite es 3 por defecto y el enlace puede llevar el texto de quien llama', () => {
    montar(<ListaPriorizada titulo="Compromisos vencidos" total={8} entradas={entradas(8)} verTodos={{ etiqueta: 'Ir a la lista', a: '/commitments' }} />)
    expect(within(grupo()).getAllByRole('listitem')).toHaveLength(3)
    expect(within(grupo()).getByRole('link', { name: 'Ir a la lista' })).toHaveAttribute('href', '/commitments')
  })

  // sin una lista a la que ir, lo que no se dibuja se despliega en el lugar: ninguna entrada queda sin forma de verse
  it('sin más de lo dibujado no ofrece «Ver los N»; sin destino despliega el resto en el lugar', async () => {
    const { unmount } = montar(<ListaPriorizada titulo="Compromisos vencidos" total={2} entradas={entradas(2)} verTodos={{ a: '/commitments' }} />)
    expect(within(grupo()).queryByRole('link', { name: /Ver/ })).not.toBeInTheDocument()
    unmount()
    montar(<ListaPriorizada titulo="Compromisos vencidos" total={5} entradas={entradas(5)} />)
    expect(within(grupo()).queryByRole('link', { name: /Ver/ })).not.toBeInTheDocument()
    const mostrar = within(grupo()).getByRole('button', { name: 'Mostrar 2 más' })
    expect(mostrar).toHaveAttribute('aria-expanded', 'false')
    expect(within(grupo()).getAllByRole('listitem')).toHaveLength(3)
    await userEvent.click(mostrar)
    expect(within(grupo()).getAllByRole('listitem')).toHaveLength(5)
    await userEvent.click(within(grupo()).getByRole('button', { name: 'Mostrar menos' }))
    expect(within(grupo()).getAllByRole('listitem')).toHaveLength(3)
  })

  it('CA-1.7.2: los títulos no van subrayados y cada entrada dice su motivo como texto, además del borde de su tono', () => {
    montar(<ListaPriorizada titulo="Compromisos vencidos" total={3} entradas={entradas(3)} />)
    const items = within(grupo()).getAllByRole('listitem')
    for (const [i, item] of items.entries()) {
      const enlace = within(item).getByRole('link')
      expect(enlace).not.toHaveClass('underline')
      expect(enlace).toHaveClass('no-underline')
      expect(within(item).getByText(`Vencido hace ${i + 1} días`)).toBeInTheDocument()
    }
    expect(items[0]).toHaveClass('border-l-2', 'border-sg-danger')
    expect(items[1]).toHaveClass('border-l-2', 'border-sg-warning')
    expect(items[2]).toHaveClass('border-l-2', 'border-sg-border')
  })

  it('dice cuándo, si quien llama lo da', () => {
    montar(
      <ListaPriorizada
        titulo="Compromisos vencidos"
        total={1}
        entradas={[{ clave: 'c1', titulo: 'Reservorio', a: '/c1', motivo: 'Vencido', cuando: '3 oct. 2026', tono: 'peligro' }]}
      />
    )
    expect(within(grupo()).getByText('3 oct. 2026')).toBeInTheDocument()
  })

  it('con total nulo (QCS confidenciales ocultas) no dibuja ningún número y el enlace no cuenta', () => {
    montar(
      <ListaPriorizada
        titulo="Compromisos vencidos"
        total={null}
        entradas={entradas(4).map((e) => ({ ...e, titulo: 'Queja', motivo: 'Vencida' }))}
        verTodos={{ a: '/attention?view=vencidas' }}
      />
    )
    expect(grupo().textContent).not.toMatch(/\d/)
    expect(within(grupo()).getByRole('link', { name: 'Ver todos' })).toHaveAttribute('href', '/attention?view=vencidas')
  })

  it('sin entradas dice su vacío; sin vacío no se dibuja', () => {
    const { unmount } = montar(<ListaPriorizada titulo="Compromisos vencidos" total={0} entradas={[]} vacio="Nada vencido" />)
    expect(within(grupo()).getByText('Nada vencido')).toBeInTheDocument()
    unmount()
    montar(<ListaPriorizada titulo="Compromisos vencidos" total={0} entradas={[]} />)
    expect(screen.queryByRole('region', { name: /Compromisos vencidos/ })).not.toBeInTheDocument()
  })

  it('dentro de otra Seccion el grupo es un h3 sin borde', () => {
    montar(
      <Seccion titulo="Atención requerida">
        <ListaPriorizada titulo="Compromisos vencidos" total={1} entradas={entradas(1)} />
      </Seccion>
    )
    const encabezado = within(grupo()).getByRole('heading', { name: /Compromisos vencidos/ })
    expect(encabezado.tagName).toBe('H3')
    expect(grupo()).not.toHaveClass('border')
  })

  it('en inglés', () => {
    localStorage.setItem('sgspe.lang', 'en')
    montar(<ListaPriorizada titulo="Overdue commitments" total={16} entradas={entradas(16)} verTodos={{ a: '/commitments' }} />)
    localStorage.removeItem('sgspe.lang')
    expect(screen.getByRole('link', { name: 'Show all 16' })).toBeInTheDocument()
  })
})
