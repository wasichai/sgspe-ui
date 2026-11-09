import { screen } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { montar, workflow } from '../../test/montar'
import { CLASE_DE_ZONA, ordinalDeNivel } from '../riesgos/niveles'
import { NivelDeRiesgo } from '../riesgos/NivelDeRiesgo'
import { EstadoChip } from './EstadoChip'
import { Nivel, Postura } from './Nivel'
import { SituacionDePlazo } from './SituacionDePlazo'

let fetch: FetchMock | null = null
afterEach(() => {
  fetch?.restore()
  fetch = null
})

// las barras llenas de una insignia de nivel
const llenas = (insignia: HTMLElement) => insignia.querySelectorAll('[data-barra="llena"]').length

describe('Nivel (design-system.md §4.3 y §5.3)', () => {
  it('el ordinal de riesgo, severidad y prioridad va de 1 a 4; otro valor no tiene nivel', () => {
    expect(['BAJO', 'MEDIO', 'ALTO', 'CRITICO'].map(ordinalDeNivel)).toEqual([1, 2, 3, 4])
    expect(['BAJA', 'MEDIA', 'ALTA', 'CRITICA'].map(ordinalDeNivel)).toEqual([1, 2, 3, 4])
    expect(ordinalDeNivel('MUY ALTA')).toBe(4)
    expect(ordinalDeNivel('OTRO')).toBeUndefined()
    expect(ordinalDeNivel(null)).toBeUndefined()
  })

  it('dibuja cuatro barras con las del nivel llenas, el rótulo y su nombre accesible', () => {
    montar(<Nivel valor="ALTO" nombre="Severidad" />)
    const insignia = screen.getByLabelText('Severidad: Alto')
    expect(insignia).toHaveTextContent('Alto')
    expect(insignia).toHaveAttribute('data-nivel', 'ALTO')
    expect(insignia.querySelectorAll('[data-barra]')).toHaveLength(4)
    expect(llenas(insignia)).toBe(3)
  })

  it('MEDIO es ámbar (risk-medium con su tinta y su borde), CRITICO sólido; la prioridad va en primario sin color de riesgo', () => {
    montar(
      <>
        <Nivel valor="MEDIO" nombre="Nivel" />
        <Nivel valor="CRITICA" nombre="Severidad" />
        <Nivel valor="MUY ALTA" escala="prioridad" nombre="Prioridad" />
      </>
    )
    const medio = screen.getByLabelText('Nivel: Medio')
    expect(medio).toHaveClass('bg-sg-risk-medium', 'text-sg-level-medium-ink', 'border-sg-level-medium-border')
    expect(medio.className).not.toMatch(/info/)
    expect(medio).toHaveClass('h-6', 'text-sg-caption', 'font-extrabold', 'uppercase')
    expect(screen.getByLabelText('Severidad: Crítica')).toHaveClass('bg-sg-risk-critical', 'text-sg-on-critical')
    const prioridad = screen.getByLabelText('Prioridad: Muy alta')
    expect(prioridad.className).not.toMatch(/risk/)
    expect(llenas(prioridad)).toBe(4)
    expect(prioridad.querySelector('[data-barra="llena"]')).toHaveClass('bg-sg-primary')
  })

  it('sin un nivel conocido, el texto tal cual o «—»', () => {
    montar(
      <>
        <Nivel valor="OTRO" nombre="Severidad" />
        <Nivel valor={null} nombre="Severidad" />
      </>
    )
    expect(screen.getByText('Otro')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-barra]')).toHaveLength(0)
  })

  it('NivelDeRiesgo es la misma insignia con el rótulo del tablero de riesgos', () => {
    montar(<NivelDeRiesgo valor="CRITICO" />)
    const insignia = screen.getByLabelText('Nivel de riesgo: Crítico')
    expect(llenas(insignia)).toBe(4)
  })

  it('la celda del mapa de calor usa la zona del nivel, no un tono de estado', () => {
    expect(CLASE_DE_ZONA).toEqual({ BAJO: 'bg-sg-zone-1', MEDIO: 'bg-sg-zone-2', ALTO: 'bg-sg-zone-3', CRITICO: 'bg-sg-zone-4' })
  })

  it('la postura es un círculo de su color y el rótulo', () => {
    montar(<Postura valor="EN CONTRA PERO ABIERTO A ESCUCHAR" />)
    const postura = screen.getByText('En contra pero abierto a escuchar').closest('[data-postura]')!
    expect(postura.querySelector('[aria-hidden]')).toHaveClass('bg-sg-stance-open', 'rounded-full')
  })
})

describe('familias de estado (design-system.md §4)', () => {
  it('el chip de estado tiene 26 px, borde de 1 px de su tinta, 13,5/600 e ícono de 14 px', async () => {
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: workflow('commitment', [['in_progress', 'En ejecución']]) }])
    montar(<EstadoChip objeto="commitment" estado="in_progress" />)
    const chip = await screen.findByText('En ejecución')
    expect(chip).toHaveClass('h-6.5', 'border', 'border-current', 'rounded-sg-md', 'text-sg-body-sm', 'font-semibold', 'bg-sg-progress-soft')
    expect(chip.querySelector('svg')).toHaveClass('size-3.5')
  })

  it('la situación va sin caja: reloj, mayúsculas en 800 y subrayado punteado de su color', () => {
    montar(
      <>
        <SituacionDePlazo valor="VENCIDO" detalle="54 días" />
        <SituacionDePlazo valor="POR VENCER" />
        <SituacionDePlazo valor="AL DIA" />
      </>
    )
    const vencido = screen.getByLabelText('Situación de plazo: Vencido · 54 días')
    expect(vencido).toHaveTextContent('Vencido · 54 días')
    expect(vencido).toHaveClass('text-sg-caption', 'uppercase', 'font-extrabold', 'border-b-2', 'border-dotted', 'text-sg-danger')
    expect(vencido.className).not.toMatch(/bg-/)
    expect(screen.getByLabelText('Situación de plazo: Por vencer')).toHaveClass('text-sg-warning')
    expect(screen.getByLabelText('Situación de plazo: Al día')).toHaveClass('text-sg-success')
  })
})
