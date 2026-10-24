import { screen } from '@testing-library/react'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { montar, workflow } from '../../test/montar'
import { EstadoChip } from '../componentes/EstadoChip'
import { enIdioma, useAvailableTransitions } from './flujos'

// B-01 (U-42, wasichai 1.4.0): los estados y las transiciones traen su etiqueta por idioma en `labels`; el portal muestra la
// del idioma activo y, si no la hay, el `label` en español de siempre
let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

const conEtiquetas = () => {
  const wf = workflow('commitment', [['blocked', 'Bloqueado']])
  return { ...wf, definition: { ...wf.definition, states: wf.definition.states.map((s) => ({ ...s, labels: { es: 'Bloqueado', en: 'Blocked' } })) } }
}

function Transiciones() {
  const transiciones = useAvailableTransitions('commitment', 'c1')
  return (
    <ul>
      {(transiciones.data ?? []).map((t) => (
        <li key={t.name}>{`${t.label} → ${t.toLabel}`}</li>
      ))}
    </ul>
  )
}
const TRANSICIONES = [
  {
    name: 'unblock',
    label: 'Desbloquear',
    toLabel: 'En ejecución',
    to: 'in_execution',
    allowed: true,
    reason: null,
    labels: { es: 'Desbloquear', en: 'Unblock' },
    toLabels: { es: 'En ejecución', en: 'In execution' }
  },
  { name: 'cancel', label: 'Cancelar', toLabel: 'Cancelado', to: 'cancelled', allowed: true, reason: null }
]

describe('etiquetas de workflow por idioma', () => {
  it.each([
    ['en', 'Blocked'],
    ['es', 'Bloqueado']
  ])('en %s, el estado se dice «%s»', async (idioma, texto) => {
    localStorage.setItem('sgspe.lang', idioma)
    fetch = mockFetch([{ path: '/objects/commitment/workflow', body: conEtiquetas() }])
    montar(<EstadoChip objeto="commitment" estado="blocked" />)
    expect(await screen.findByText(texto)).toBeInTheDocument()
  })

  it('las transiciones y su destino salen en el idioma activo; sin labels, en español', async () => {
    localStorage.setItem('sgspe.lang', 'en')
    fetch = mockFetch([{ path: '/objects/commitment/records/c1/transitions', body: TRANSICIONES }])
    montar(<Transiciones />)
    expect(await screen.findByText('Unblock → In execution')).toBeInTheDocument()
    expect(screen.getByText('Cancelar → Cancelado')).toBeInTheDocument()
  })

  it('una variante regional usa la etiqueta de su idioma base', () => {
    expect(enIdioma('Bloqueado', { es: 'Bloqueado', en: 'Blocked' }, 'en-US')).toBe('Blocked')
    expect(enIdioma('Bloqueado', { es: 'Bloqueado' }, 'qu')).toBe('Bloqueado')
    expect(enIdioma('Bloqueado', undefined, 'en')).toBe('Bloqueado')
  })

  // los hooks de @wasichai/workflow entregan `label` en español: el portal los lee solo por datos/flujos
  it('ninguna fuente del portal usa useWorkflow ni useAvailableTransitions de @wasichai/workflow', () => {
    const portal = join(import.meta.dirname, '..')
    const fuentes = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? fuentes(join(dir, f)) : /\.tsx?$/.test(f) ? [join(dir, f)] : []))
    const directos = fuentes(portal)
      .filter((f) => !f.endsWith('datos/flujos.ts'))
      .filter((f) => /import\s*\{[^}]*\b(useWorkflow|useAvailableTransitions)\b[^}]*\}\s*from\s*'@wasichai\/workflow'/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(portal, f))
    expect(directos).toEqual([])
  })
})
