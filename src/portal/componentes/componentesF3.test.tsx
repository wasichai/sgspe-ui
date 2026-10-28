import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, workflow } from '../../test/montar'
import { permisosConCapacidades } from '../../test/portal'
import { espiarRed, type Red } from '../../test/red'
import { EstadoChip } from './EstadoChip'
import { esMontoValido, Monto, montoPe, normalizarMonto } from './Monto'
import { SelectorDeUsuario, type Usuaria } from './SelectorDeUsuario'
import { SituacionDePlazo } from './SituacionDePlazo'

// las piezas comunes de F3: situación de plazo y de vigencia (RN-WFL-001), montos es-PE (RNF-I18N-002), los estados de WF-D,
// WF-I, WF-K y WF-N con tono e ícono, y la elección de una persona usuaria con o sin el directorio (UPS-06)
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

function Elegir({ inicial = null }: { inicial?: Usuaria | null }) {
  const [valor, setValor] = useState<Usuaria | null>(inicial)
  return (
    <>
      <SelectorDeUsuario etiqueta="Responsable" valor={valor} alCambiar={setValor} />
      <p>elegida: {valor ? `${valor.id}|${valor.email}` : 'nadie'}</p>
    </>
  )
}

describe('piezas comunes de F3', () => {
  it('la situación de plazo dice el valor con su ícono y su nombre accesible; vacía no dibuja nada', async () => {
    montar(
      <>
        <SituacionDePlazo valor="VENCIDO" />
        <SituacionDePlazo valor="VIGENTE" vigencia />
        <SituacionDePlazo valor={null} />
      </>
    )
    expect(await screen.findByLabelText('Situación de plazo: Vencido')).toHaveTextContent('Vencido')
    expect(screen.getByLabelText('Situación de vigencia: Vigente')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-situacion]')).toHaveLength(2)
  })

  it('un monto se dice con su moneda en es-PE y sin valor es una raya, nunca un cero', () => {
    expect(montoPe('1250.5', 'PEN')).toBe('S/ 1,250.50')
    expect(montoPe(300, 'USD')).toBe('USD 300.00')
    expect(montoPe(12, 'XYZ1')).toBe('XYZ1 12.00')
    expect(montoPe(null, 'PEN')).toBe('—')
    expect(montoPe('', 'PEN')).toBe('—')
    // sin pasar por Number: la precisión pasados 2^53 se conserva y lo que no es decimal plano no es un monto
    expect(montoPe('9007199254740993.10', 'PEN')).toBe('S/ 9,007,199,254,740,993.10')
    for (const invalido of ['0x10', '1e3', 'Infinity', 'NaN', '1,5', '--1']) expect(montoPe(invalido, 'PEN')).toBe('—')
    expect(montoPe(Number.NaN, 'PEN')).toBe('—')
    // cuatro decimales no se redondean a dos, con o sin moneda conocida
    expect(montoPe('1.2345', 'PEN')).toBe('S/ 1.2345')
    expect(montoPe('1.2345', 'XYZ1')).toBe('XYZ1 1.2345')
    // lo tecleado: separadores de miles fuera, dentro de las cotas del servidor (15 enteros, 4 decimales, no negativo)
    expect(normalizarMonto(' 1,250.50 ')).toBe('1250.50')
    expect(esMontoValido('1,250.50')).toBe(true)
    expect(esMontoValido('-1')).toBe(false)
    expect(esMontoValido('1e999999')).toBe(false)
    expect(esMontoValido('1.12345')).toBe(false)
    expect(esMontoValido('1234567890123456')).toBe(false)
    montar(<Monto valor="10" moneda="PEN" />)
    expect(screen.getByText('S/ 10.00')).toBeInTheDocument()
  })

  it('el estado de un compromiso usa la etiqueta del workflow y su tono', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: workflow('commitment', [['blocked', 'Bloqueado']]) }])
    montar(<EstadoChip objeto="commitment" estado="blocked" />)
    expect(await screen.findByText('Bloqueado')).toHaveClass('bg-sg-warning-soft')
  })

  it('con el directorio legible se elige de la lista de personas habilitadas', async () => {
    fetch = mockFetch([
      {
        path: '/users',
        body: [
          { id: 'u-1', email: 'ana@sgspe.test', displayName: 'Ana de prueba', enabled: true },
          { id: 'u-2', email: 'baja@sgspe.test', displayName: 'Baja de prueba', enabled: false }
        ]
      }
    ])
    montar(<Elegir />, { permisos: permisosConCapacidades({}, ['MANAGE_ORGANIZATION']) })
    const lista = await screen.findByRole('combobox', { name: 'Responsable' })
    expect(screen.queryByRole('option', { name: /Baja de prueba/ })).not.toBeInTheDocument()
    await userEvent.selectOptions(lista, 'u-1')
    expect(screen.getByText('elegida: u-1|ana@sgspe.test')).toBeInTheDocument()
  })

  // tercera pasada de UX (2.6): quien registra suele ser el responsable: «Asignarme» lo propone, y se puede cambiar
  it('«Asignarme» elige a quien mira; ya elegida, no se ofrece', async () => {
    fetch = mockFetch([])
    montar(<Elegir />, { permisos: permisosConCapacidades({}, []) })
    await userEvent.click(await screen.findByRole('button', { name: 'Asignarme como Responsable' }))
    expect(screen.getByText('elegida: u-relacionista|relacionista@sgspe.test')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignarme como Responsable' })).not.toBeInTheDocument()
  })

  it('sin MANAGE_ORGANIZATION no pide el directorio y se escribe el correo y el identificador', async () => {
    fetch = mockFetch([])
    red = espiarRed()
    montar(<Elegir />, { permisos: permisosConCapacidades({}, []) })
    await userEvent.type(await screen.findByLabelText('Responsable · correo'), 'ana@sgspe.test')
    await userEvent.type(screen.getByLabelText('Responsable · identificador de usuario'), 'u-1')
    expect(screen.getByText('elegida: u-1|ana@sgspe.test')).toBeInTheDocument()
    expect(red.a('GET', '/users')).toHaveLength(0)
  })
})
