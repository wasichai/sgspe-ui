import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { QUEJA, WF_QUEJA } from '../../test/atencion'
import { P1 } from '../../test/compromisos'
import { definicion, montar, pagina, registro } from '../../test/montar'
import { espiarRed, problema, type Red } from '../../test/red'
import { DEF_REGLA, EQUIPO_DE_RIESGOS, GESTOR_DE_RIESGOS, REGLA, RELACIONES_EN_RIESGOS, WF_ALERTA } from '../../test/riesgos'
import { RELACIONISTA } from '../../test/portal'
import { aparienciaDe } from './apariencias'
import { EstadoChip } from './EstadoChip'
import { NotaDeConfidenciales } from './NotaDeConfidenciales'
import { RegistrosSimples } from './RegistrosSimples'
import { RegistroVinculado } from './RegistroVinculado'
import { SituacionDePlazo } from './SituacionDePlazo'

// las piezas comunes de F4: la situación de revisión de un riesgo (review_status, RN-WFL-001), los estados de WF-E1 a WF-E3, WF-F,
// WF-J y WF-M con tono e ícono, nunca solo color (design-system.md §4.1), el vínculo a un registro con «Registro reservado» para
// una QCS confidencial (ASM-095), la nota de confidenciales excluidas y los registros simples de riesgos y alertas
let fetch: FetchMock | null = null
let red: Red | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  red?.restaurar()
  fetch?.restore()
  red = fetch = null
})

describe('piezas comunes de F4', () => {
  it('la situación de revisión de un riesgo se dice con su nombre accesible y su tono', async () => {
    montar(
      <>
        <SituacionDePlazo valor="REVISION VENCIDA" revision />
        <SituacionDePlazo valor="POR REVISAR" revision />
      </>
    )
    expect(await screen.findByLabelText('Situación de revisión: REVISION VENCIDA')).toHaveClass('text-sg-danger')
    expect(screen.getByLabelText('Situación de revisión: POR REVISAR')).toHaveClass('text-sg-warning')
  })

  it('los estados de una queja y de una alerta llevan la etiqueta de su workflow', async () => {
    fetch = mockFetch([
      { path: '/objects/grievance/workflow', body: WF_QUEJA },
      { path: '/objects/early_warning/workflow', body: WF_ALERTA }
    ])
    montar(
      <>
        <EstadoChip objeto="grievance" estado="in_action" />
        <EstadoChip objeto="early_warning" estado="in_triage" />
      </>
    )
    expect(await screen.findByText('En atención')).toBeInTheDocument()
    expect(await screen.findByText('En triaje')).toBeInTheDocument()
  })

  it.each([
    ['grievance', 'rejected', 'final'],
    ['grievance', 'in_action', 'progress'],
    ['inquiry', 'referred', 'info'],
    ['stakeholder_request', 'declined', 'warning'],
    ['social_risk', 'mitigating', 'progress'],
    ['early_warning', 'detected', 'warning'],
    ['early_warning', 'dismissed', 'final'],
    ['incident', 'closed', 'final']
  ])('%s en %s tiene el tono %s', (objeto, estado, tono) => {
    expect(aparienciaDe(objeto, estado).tono).toBe(tono)
  })
})

const noEncontrado = { status: 404, body: { title: 'Not Found', status: 404 } }

describe('vínculo a otro registro', () => {
  it('enlaza la ficha del registro con su código y su título', async () => {
    fetch = mockFetch([{ path: '/objects/grievance/records/g1', body: QUEJA }])
    montar(<RegistroVinculado objeto="grievance" id="g1" />)
    expect(await screen.findByRole('link', { name: /^Q-001/ })).toHaveAttribute('href', '/projects/p1/grievances/g1')
  })

  it('una QCS que la cuenta no lee (404) es «Registro reservado», sin enlace ni datos', async () => {
    fetch = mockFetch([{ path: '/objects/inquiry/records/i1', ...noEncontrado }])
    montar(<RegistroVinculado objeto="inquiry" id="i1" />)
    expect(await screen.findByText('Registro reservado')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Registro reservado')).toHaveAccessibleDescription(/Es una QCS confidencial/)
  })

  it('otro objeto que ya no existe lo dice; uno que la cuenta no lee es «No disponible»; sin id no dibuja nada', async () => {
    fetch = mockFetch([
      { path: '/objects/incident/records/n1', ...noEncontrado },
      { path: '/objects/social_risk/records/k1', status: 403, body: { title: 'Forbidden', status: 403 } }
    ])
    montar(
      <>
        <RegistroVinculado objeto="incident" id="n1" />
        <RegistroVinculado objeto="social_risk" id="k1" />
        <RegistroVinculado objeto="grievance" id={null} />
      </>
    )
    expect(await screen.findByText('El registro vinculado ya no existe.')).toBeInTheDocument()
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByText('Registro reservado')).not.toBeInTheDocument()
  })
})

describe('nota de confidenciales excluidas', () => {
  it('con confidentialHidden dice que la cifra no las incluye, sin cuántas; sin la marca no dibuja nada', () => {
    montar(
      <>
        <NotaDeConfidenciales oculta />
        <NotaDeConfidenciales oculta={false} />
      </>
    )
    expect(screen.getAllByRole('note')).toHaveLength(1)
    expect(screen.getByRole('note')).toHaveTextContent('no incluye las QCS confidenciales que su cuenta no puede leer')
  })
})

describe('registros simples', () => {
  const columnas = [
    { id: 'nombre', encabezado: 'Nombre', celda: (r: { attributes: Record<string, unknown> }) => String(r.attributes.name) },
    { id: 'tipo', encabezado: 'Tipo', celda: (r: { attributes: Record<string, unknown> }) => String(r.attributes.rule_kind) }
  ]
  const lista = (registros = [REGLA]) => ({ path: '/objects/early_warning_rule/records', body: pagina(registros) })
  const asignacion = (usuario: string) => ({
    path: /^\/objects\/project_assignment\/records\?.*member_user_id/,
    body: pagina([registro('as', { project: 'p1', member_user_id: usuario, active: true })])
  })
  const abrir = (usuario = GESTOR_DE_RIESGOS, permisos = EQUIPO_DE_RIESGOS) =>
    montar(
      <RegistrosSimples
        objeto="early_warning_rule"
        titulo="Reglas"
        filtros={{ project: 'p1' }}
        fijos={{ project: 'p1' }}
        columnas={columnas}
        campos={['name', 'rule_kind', 'threshold', 'window_days', 'enabled']}
        proyecto="p1"
        textoNuevo="Nueva regla"
        textoVacio="Sin reglas"
        mensajesAlBorrar={{ HAS_DEPENDENTS: 'Tiene alertas: desactívela.' }}
      />,
      { usuario, permisos }
    )

  it('lista el alcance, crea con lo fijo sin mostrarlo y abre cada registro en su formulario', async () => {
    fetch = mockFetch([
      lista(),
      asignacion('u-srm'),
      { path: '/objects/project/records/p1', body: P1 },
      // solo el nombre es obligatorio: la prueba es de la lista y del alta, no de los controles de wasichai
      { path: '/metadata/objects/early_warning_rule', body: definicion('early_warning_rule', [['name', { required: true }], 'description', 'project']) },
      { method: 'POST', path: '/objects/early_warning_rule/records', status: 201, body: registro('rg2', { project: 'p1', name: 'Incidentes' }) }
    ])
    red = espiarRed()
    abrir()
    expect(await screen.findByRole('button', { name: 'Señales de conflicto' })).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva regla' }))
    const drawer = await screen.findByRole('dialog', { name: 'Nueva regla' })
    expect(within(drawer).queryByLabelText('project')).not.toBeInTheDocument()
    await userEvent.type(await within(drawer).findByLabelText(/^name/), 'Incidentes')
    await userEvent.click(within(drawer).getByRole('button', { name: /guardar|save/i }))
    await waitFor(() => expect(red!.a('POST', '/objects/early_warning_rule/records')).toHaveLength(1))
    expect(red.a('POST', '/objects/early_warning_rule/records')[0].cuerpo).toMatchObject({ attributes: { name: 'Incidentes', project: 'p1' } })
  })

  it('borrar pide confirmación, manda If-Match y dice el texto propio de un HAS_DEPENDENTS', async () => {
    fetch = mockFetch([lista(), asignacion('u-srm'), { path: '/metadata/objects/early_warning_rule', body: DEF_REGLA }])
    red = espiarRed([
      {
        method: 'DELETE',
        path: '/objects/early_warning_rule/records/rg1',
        responder: () => problema(409, 'tiene alertas', [{ field: 'early_warning.early_warning_rule', message: 'HAS_DEPENDENTS' }])
      }
    ])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Señales de conflicto' }))
    const drawer = await screen.findByRole('dialog', { name: 'Reglas' })
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Borrar' }))
    expect(within(drawer).getByText('¿Borrar este registro? No se puede deshacer.')).toBeInTheDocument()
    await userEvent.click(within(drawer).getByRole('button', { name: 'Borrar' }))
    expect(await within(drawer).findByText('Tiene alertas: desactívela.')).toBeInTheDocument()
    expect(red.a('DELETE', '/objects/early_warning_rule/records/rg1')[0].cabeceras.get('If-Match')).toBe(`"${REGLA.updatedAt}"`)
  })

  it('quien solo lee ve los datos sin formulario, sin «Nueva regla» ni «Borrar»', async () => {
    fetch = mockFetch([lista(), asignacion('u-relacionista'), { path: '/metadata/objects/early_warning_rule', body: DEF_REGLA }])
    abrir(RELACIONISTA, RELACIONES_EN_RIESGOS)
    await userEvent.click(await screen.findByRole('button', { name: 'Señales de conflicto' }))
    const drawer = await screen.findByRole('dialog', { name: 'Reglas' })
    expect(await within(drawer).findByText('CONTEO DE SEÑALES')).toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument()
    expect(within(drawer).queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva regla' })).not.toBeInTheDocument()
  })

  it('mientras la lista carga no dice que está vacía; vacía lo dice', async () => {
    fetch = mockFetch([lista([]), asignacion('u-srm'), { path: '/metadata/objects/early_warning_rule', body: DEF_REGLA }])
    abrir()
    expect(screen.queryByText('Sin reglas')).not.toBeInTheDocument()
    expect(await screen.findByText('Sin reglas')).toBeInTheDocument()
  })
})
