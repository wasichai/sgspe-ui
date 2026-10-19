import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockFetch, type FetchMock } from '@wasichai/testing'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UseQueryResult } from '@tanstack/react-query'
import { montar, pagina, registro, workflow } from '../../test/montar'
import { ErrorDeSgspe } from '../datos/http'
import type { Pagina } from '../datos/registros'
import { Campo, SelectNativo } from './Campo'
import { FiltroDeLista } from './FiltroDeLista'
import { EstadoChip } from './EstadoChip'
import { Cargando, Consulta, ErrorDeCarga, esIlegible, ExplicacionDeColumna, NoDisponible, NoEsDeSusProyectos, Restringido, ThConExplicacion } from './Estados'
import { KpiCard } from './KpiCard'
import { TablaDeRegistros } from './Lista'
import { NombreDelGrupo } from './NombreDeActor'
import { Pasos } from './Pasos'

let fetch: FetchMock | null = null
beforeEach(() => localStorage.clear())
afterEach(() => {
  fetch?.restore()
  fetch = null
})

describe('EstadoChip', () => {
  it('muestra la etiqueta del workflow con el tono y el ícono del estado (design-system.md §4.1)', async () => {
    fetch = mockFetch([
      {
        path: '/objects/project/workflow',
        body: workflow('project', [
          ['draft', 'Borrador'],
          ['in_review', 'En revisión']
        ])
      }
    ])
    montar(<EstadoChip objeto="project" estado="in_review" />)
    const chip = await screen.findByText('En revisión')
    expect(chip).toHaveAttribute('data-estado', 'in_review')
    expect(chip.className).toContain('bg-sg-info-soft')
    expect(chip.querySelector('svg')).not.toBeNull()
  })

  it('sin workflow legible, muestra el nombre técnico', async () => {
    fetch = mockFetch([])
    montar(<EstadoChip objeto="engagement" estado="held" />)
    expect(await screen.findByText('held')).toBeInTheDocument()
  })
})

describe('estados comunes', () => {
  it('un error de carga dice qué falló, el código de correlación y permite reintentar', async () => {
    const reintentar = vi.fn()
    montar(<ErrorDeCarga error={new ErrorDeSgspe(412, 'x', [], 'corr-77')} alReintentar={reintentar} />)
    expect(await screen.findByText(/Otra persona cambió este registro/)).toBeInTheDocument()
    expect(screen.getByText('Código para soporte: corr-77')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reintentar).toHaveBeenCalledOnce()
  })

  it('un 409 muestra el detail del dominio, no el código', async () => {
    montar(<ErrorDeCarga error={new ErrorDeSgspe(409, 'El grupo de interés está retirado', [], null)} />)
    expect(await screen.findByText('El grupo de interés está retirado')).toBeInTheDocument()
    expect(screen.queryByText(/409/)).not.toBeInTheDocument()
  })

  // ruling P15: errors[0].message de una guarda es un código; la interfaz dice su texto y cada 403 dice qué falta
  it.each([
    ['NOT_ASSIGNED', 'No tiene una asignación vigente a este proyecto: pídala a la administración del proyecto.'],
    ['NOT_OWN_RECORD', 'Solo quien registró este dato puede cambiarlo: su cuenta no edita registros de otras personas.'],
    ['ACTION_REQUIRED', 'Su cuenta no tiene la acción que este paso exige (aprobar, verificar, emitir un documento o descargar lo restringido).'],
    [
      'SEGREGATION_OF_DUTIES',
      'Por segregación de funciones, quien registró un compromiso, un aporte o un programa no lo aprueba, y el responsable de un compromiso no lo verifica.'
    ],
    ['PERSON_REQUIRED', 'Esta decisión la toma una persona, no una cuenta de servicio.'],
    ['PROJECT_MISMATCH', 'El registro elegido es de otro proyecto: un registro solo se vincula con lo de su proyecto.'],
    ['EVIDENCE_FILE_IN_USE', 'Ese archivo ya es de otra evidencia: elíjalo de nuevo para subirlo otra vez, o reemplace esa evidencia con una versión nueva.'],
    ['GENERATOR_KEY_PLATFORM_ONLY', 'La clave de origen de una tarea la escribe solo el sistema: no se cambia.'],
    ['PLATFORM_ONLY', 'Este dato lo escribe solo el sistema: recargue para ver su valor vigente y vuelva a guardar.'],
    ['ROLE_REQUIRED', 'Su rol no puede dar este paso del flujo.'],
    ['FIELD_NOT_WRITABLE', 'Este paso escribe un dato que su rol no puede escribir.'],
    ['OBJECT_NOT_READABLE', 'Su rol no puede leer datos que esta regla necesita revisar.'],
    ['COMMAND_ONLY', 'Este paso se hace desde su propia pantalla, no como una transición.']
  ])('un 403 %s dice su texto, no el código ni el texto genérico', async (codigo, texto) => {
    montar(<ErrorDeCarga error={new ErrorDeSgspe(403, 'Prohibido', [{ field: 'record', message: codigo }], null)} />)
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText(codigo)).not.toBeInTheDocument()
    expect(screen.queryByText(/Su cuenta no tiene permiso para esta acción/)).not.toBeInTheDocument()
  })

  // plan 4.2a: el mismo código dice otra cosa según el campo. COMMAND_ONLY sobre un vínculo que solo escriben la reclasificación y
  // la aceptación no es una transición; OBJECT_NOT_READABLE sobre una QCS es una que la cuenta no lee (puede ser confidencial)
  it.each([
    [
      'COMMAND_ONLY',
      'reclassified_from_inquiry',
      'El vínculo con la QCS reclasificada o con el compromiso o el aporte creado lo escriben solo la reclasificación y la aceptación: recargue y vuelva a guardar sin cambiarlo.'
    ],
    [
      'COMMAND_ONLY',
      'created_commitment',
      'El vínculo con la QCS reclasificada o con el compromiso o el aporte creado lo escriben solo la reclasificación y la aceptación: recargue y vuelva a guardar sin cambiarlo.'
    ],
    ['OBJECT_NOT_READABLE', 'grievance', 'Su cuenta no puede leer esa queja, consulta o solicitud (puede ser confidencial): no se le vincula nada.'],
    ['OBJECT_NOT_READABLE', 'stakeholder_request', 'Su cuenta no puede leer esa queja, consulta o solicitud (puede ser confidencial): no se le vincula nada.']
  ])('un 403 %s sobre %s dice el texto de ese campo', async (codigo, campo, texto) => {
    montar(<ErrorDeCarga error={new ErrorDeSgspe(403, 'Prohibido', [{ field: campo, message: codigo }], null)} />)
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText(codigo)).not.toBeInTheDocument()
  })

  // DELIVERY_FROZEN sobre el aporte (una entrega, una evidencia o un comprobante de un aporte entregado o anulado) habla del aporte;
  // sobre un compromiso, de sus entregas
  it.each([
    ['social_contribution', 'El aporte ya se entregó o se anuló: su entrega, sus evidencias y sus comprobantes no cambian.'],
    ['attributes.social_contribution', 'El aporte ya se entregó o se anuló: su entrega, sus evidencias y sus comprobantes no cambian.'],
    [
      'commitment',
      'El compromiso ya está cumplido o cancelado: sus entregas no cambian. Si está cumplido (no verificado ni cerrado), devuélvalo a ejecución para corregirlas.'
    ]
  ])('un 409 DELIVERY_FROZEN sobre %s dice el texto de su objeto', async (campo, texto) => {
    montar(<ErrorDeCarga error={new ErrorDeSgspe(409, 'Congelado', [{ field: campo, message: 'DELIVERY_FROZEN' }], null)} />)
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText('DELIVERY_FROZEN')).not.toBeInTheDocument()
  })

  it('HAS_DEPENDENTS no nombra el campo de la API; un código que el portal no conoce muestra el detail si no delata un código', async () => {
    montar(
      <>
        <ErrorDeCarga error={new ErrorDeSgspe(409, 'x', [{ field: 'engagement.project', message: 'HAS_DEPENDENTS' }], null)} />
        <ErrorDeCarga error={new ErrorDeSgspe(409, 'La regla nueva del servidor', [{ field: 'record', message: 'SOME_NEW_RULE' }], null)} />
        <ErrorDeCarga error={new ErrorDeSgspe(400, 'La transición decline exige response', [{ field: 'response', message: 'OTHER_NEW_RULE' }], null)} />
        <ErrorDeCarga error={new ErrorDeSgspe(400, 'Días entre revisiones (400 OUT_OF_RANGE)', [], null)} />
      </>
    )
    expect(await screen.findByText('No se puede borrar: otros registros dependen de este. Bórrelos o cámbielos primero.')).toBeInTheDocument()
    expect(screen.queryByText(/engagement\.project/)).not.toBeInTheDocument()
    expect(screen.getByText('La regla nueva del servidor')).toBeInTheDocument()
    expect(screen.queryByText('SOME_NEW_RULE')).not.toBeInTheDocument()
    // el detail que delata una transición, un campo o un código dice el texto fijo de su estado (humo F4, D3)
    expect(screen.getAllByText('Revise los datos marcados.')).toHaveLength(2)
    expect(screen.queryByText(/decline|response|OUT_OF_RANGE/)).not.toBeInTheDocument()
  })

  it('un campo restringido y una cifra no disponible lo dicen con candado, nunca vacío', async () => {
    montar(
      <>
        <Restringido />
        <NoDisponible />
      </>
    )
    expect(await screen.findByText('Restringido')).toHaveAttribute('title', 'Su rol no puede leer este dato')
    expect(screen.getByText('No disponible')).toBeInTheDocument()
  })

  it('el motivo no depende del title: va enlazado con aria-describedby y un botón de ayuda lo despliega a teclado y táctil', async () => {
    montar(
      <>
        <Restringido />
        <NoDisponible motivo="OBJECT_NOT_READABLE" />
      </>
    )
    const [restringido, noDisponible] = [await screen.findByText('Restringido'), screen.getByText('No disponible')]
    for (const [etiqueta, motivo] of [
      [restringido, 'Su rol no puede leer este dato'],
      [noDisponible, 'Su rol no puede leer los registros de esta cifra']
    ] as const) {
      const id = etiqueta.getAttribute('aria-describedby')!
      expect(document.getElementById(id)).toHaveTextContent(motivo)
      expect(document.getElementById(id)).toHaveClass('sr-only')
    }
    const [ayudaDeRestringido, ayudaDeNoDisponible] = screen.getAllByRole('button', { name: 'Por qué no se muestra' })
    expect(ayudaDeRestringido).toHaveAttribute('aria-expanded', 'false')
    expect(ayudaDeRestringido).toHaveAccessibleDescription('Su rol no puede leer este dato')
    await userEvent.click(ayudaDeRestringido)
    expect(ayudaDeRestringido).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(restringido.getAttribute('aria-describedby')!)).not.toHaveClass('sr-only')
    expect(document.getElementById(noDisponible.getAttribute('aria-describedby')!)).toHaveClass('sr-only')
    expect(ayudaDeNoDisponible).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Campo (revisión final, M11)', () => {
  it('el error aparece en una región que se anuncia, ya presente antes del error, y queda enlazado al control', async () => {
    function ConError() {
      const [error, setError] = useState<string>()
      return (
        <>
          <Campo etiqueta="Nombre" error={error}>
            {(p) => <input {...p} />}
          </Campo>
          <button onClick={() => setError('Obligatorio')}>Validar</button>
        </>
      )
    }
    montar(<ConError />)
    const region = (await screen.findByLabelText('Nombre')).parentElement!.querySelector('[aria-live="polite"]')
    expect(region).not.toBeNull()
    expect(region).toBeEmptyDOMElement()
    await userEvent.click(screen.getByRole('button', { name: 'Validar' }))
    expect(region).toHaveTextContent('Obligatorio')
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Obligatorio')
  })
})

describe('SelectNativo', () => {
  it('muestra una opción del modelo con su rótulo y conserva el valor crudo', async () => {
    montar(<SelectNativo aria-label="Postura" opciones={['EN CONTRA PERO ABIERTO A ESCUCHAR', 'DEMO-T1']} />)
    const opcion = await screen.findByRole('option', { name: 'En contra pero abierto a escuchar' })
    expect(opcion).toHaveValue('EN CONTRA PERO ABIERTO A ESCUCHAR')
    expect(screen.getByRole('option', { name: 'DEMO-T1' })).toHaveValue('DEMO-T1')
  })
})

describe('FiltroDeLista', () => {
  it('tiene su rótulo a la vista y la opción vacía dice «Todos», no «Seleccionar…»', async () => {
    montar(<FiltroDeLista etiqueta="Prioridad" opciones={['MUY ALTA', 'ALTA']} value="" onChange={() => undefined} />)
    const filtro = await screen.findByLabelText('Prioridad')
    expect(screen.getByText('Prioridad').tagName).toBe('SPAN')
    expect(filtro).toHaveDisplayValue('Todos')
    expect(screen.getByRole('option', { name: 'Muy alta' })).toHaveValue('MUY ALTA')
    expect(screen.queryByRole('option', { name: 'Seleccionar…' })).not.toBeInTheDocument()
  })
})

describe('Consulta (revisión final, I1)', () => {
  // lo que importa de una consulta de TanStack Query para Consulta: sus datos, su error y su refetch
  const consulta = (data: string | undefined, error: unknown) =>
    ({ isPending: false, isError: true, data, error, refetch: vi.fn() }) as unknown as UseQueryResult<string>

  it('una relectura fallida con datos no desmonta el contenido: lo escrito debajo se conserva', async () => {
    montar(<Consulta consulta={consulta('acta', new ErrorDeSgspe(500, 'x', [], null))}>{(d) => <p>contenido {d}</p>}</Consulta>)
    expect(await screen.findByText('contenido acta')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
  })

  it('sin datos, un 403 es «No disponible» con su motivo y otro error, la alerta con reintento', async () => {
    montar(
      <>
        <Consulta consulta={consulta(undefined, new ErrorDeSgspe(403, 'x', [{ field: 'record', message: 'NOT_ASSIGNED' }], null))}>{() => null}</Consulta>
        <Consulta consulta={consulta(undefined, new ErrorDeSgspe(500, 'x', [], null))}>{() => null}</Consulta>
      </>
    )
    const noDisponible = await screen.findByText('No disponible')
    expect(document.getElementById(noDisponible.getAttribute('aria-describedby')!)).toHaveTextContent(/No tiene una asignación vigente/)
    expect(screen.getAllByRole('button', { name: 'Reintentar' })).toHaveLength(1)
  })

  it('con noExiste={<NoEsDeSusProyectos />}, un 404 dice que no existe o no es de sus proyectos, sin reintento ni el detalle', async () => {
    montar(
      <Consulta consulta={consulta(undefined, new ErrorDeSgspe(404, 'Record r9 does not exist', [], null))} noExiste={<NoEsDeSusProyectos />}>
        {() => null}
      </Consulta>
    )
    expect(await screen.findByText('El registro no existe o no es de sus proyectos.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.queryByText(/does not exist/)).not.toBeInTheDocument()
  })

  it('esIlegible es un 404 de la API y nada más', () => {
    expect(esIlegible(new ErrorDeSgspe(404, 'x', [], null))).toBe(true)
    expect(esIlegible(new ErrorDeSgspe(403, 'x', [], null))).toBe(false)
    expect(esIlegible(new Error('sin red'))).toBe(false)
    expect(esIlegible(null)).toBe(false)
  })
})

describe('celdas de tabla restringidas', () => {
  it('con describedPor no hay botón por celda: el motivo es el de la explicación única de la columna', async () => {
    montar(
      <table>
        <thead>
          <tr>
            <th>
              Columna <ExplicacionDeColumna id="explica" tipo="noDisponible" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <Restringido describedPor="explica" />
            </td>
            <td>
              <NoDisponible describedPor="explica" />
            </td>
          </tr>
        </tbody>
      </table>
    )
    expect(await screen.findAllByRole('button', { name: 'Por qué no se muestra' })).toHaveLength(1)
    for (const celda of [screen.getByText('Restringido'), screen.getByText('No disponible')]) {
      expect(celda).toHaveAttribute('aria-describedby', 'explica')
      expect(celda).toHaveAccessibleDescription('Su cuenta no puede leer estos datos')
    }
    expect(document.getElementById('explica')).toHaveClass('sr-only')
  })

  it('el encabezado con explicación se llama solo por el nombre de la columna y las celdas leen el motivo', async () => {
    montar(
      <table>
        <thead>
          <tr>
            <ThConExplicacion explicacion="explica" tipo="restringido">
              Postura
            </ThConExplicacion>
            <ThConExplicacion explicacion="solo" tipo="noDisponible" soloLectores>
              Lugar
            </ThConExplicacion>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <Restringido describedPor="explica" />
            </td>
            <td>
              <NoDisponible describedPor="solo" />
            </td>
          </tr>
        </tbody>
      </table>
    )
    // ni el botón «Por qué no se muestra» ni el texto del motivo entran en el nombre del encabezado
    expect(await screen.findByRole('columnheader', { name: 'Postura' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Lugar' })).toBeInTheDocument()
    expect(screen.getByText('Restringido')).toHaveAccessibleDescription('Su rol no puede leer este dato')
    expect(screen.getByText('No disponible')).toHaveAccessibleDescription('Su cuenta no puede leer estos datos')
  })

  it('el botón de ayuda aislado mide al menos 24 px y tiene su foco visible', async () => {
    montar(<Restringido />)
    const boton = await screen.findByRole('button', { name: 'Por qué no se muestra' })
    expect(boton).toHaveClass('size-6')
    expect(boton.className).toMatch(/focus-visible:outline-/)
  })

  it('un motivo que es el código de una guarda se dice con el texto de los códigos, sin duplicarlo', async () => {
    montar(
      <>
        <NoDisponible motivo="NOT_ASSIGNED" />
        <NoDisponible motivo="ROLE_REQUIRED" />
        <NoDisponible motivo="CODIGO_SIN_TEXTO" />
      </>
    )
    const [asignacion, rol, sinTexto] = await screen.findAllByText('No disponible')
    expect(asignacion).toHaveAttribute('title', 'No tiene una asignación vigente a este proyecto: pídala a la administración del proyecto.')
    expect(rol).toHaveAttribute('title', 'Su rol no puede dar este paso del flujo.')
    expect(sinTexto).toHaveAttribute('title', 'Su cuenta no puede leer estos datos')
  })

  it('sin motivo, la ayuda de No disponible no habla de cifras: sirve para una lista', async () => {
    montar(<NoDisponible />)
    expect(await screen.findByText('No disponible')).toHaveAttribute('title', 'Su cuenta no puede leer estos datos')
  })
})

describe('KpiCard', () => {
  it.each([
    [{ code: 'KPI-STK-05', label: 'x', available: true, value: 40, numerator: 4, denominator: 10, unit: '%' }, ['40', '4 / 10 · %']],
    [{ code: 'KPI-STK-02', label: 'x', available: false, unavailableReason: 'FIELD_NOT_READABLE', missingFields: ['stakeholder.stance'] }, ['No disponible']]
  ])('%j se lee como %j', async (indicador, textos) => {
    montar(<KpiCard titulo="Cifra" indicador={indicador} />)
    for (const texto of textos) expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('una cifra sin valor en el periodo lo dice, sin «—» ni la unidad suelta', async () => {
    montar(<KpiCard titulo="Absueltas" indicador={{ code: 'KPI-GRV-03', label: 'x', available: true, value: null, numerator: 0, denominator: 0, unit: '%' }} />)
    expect(await screen.findByText('Sin datos en el periodo')).toBeInTheDocument()
    expect(screen.queryByText('%')).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('una cifra no disponible dice por qué: sin permiso, candado; un solo proyecto, que lo elija', async () => {
    montar(
      <>
        <KpiCard titulo="Uno" indicador={{ code: 'KPI-ENG-01', label: 'x', available: false, unavailableReason: 'OBJECT_NOT_READABLE' }} />
        <KpiCard titulo="Dos" indicador={{ code: 'KPI-STK-03', label: 'x', available: false, unavailableReason: 'SINGLE_PROJECT_REQUIRED' }} />
      </>
    )
    expect(await screen.findByText('No disponible')).toHaveAttribute('title', 'Su rol no puede leer los registros de esta cifra')
    expect(screen.getByText('Elija un proyecto')).toHaveAttribute('title', 'Esta cifra se calcula para un solo proyecto: elija uno en el selector')
  })

  it('si la consulta del indicador falló, dice el error en lugar de "Cargando…" para siempre', async () => {
    montar(<KpiCard titulo="Cifra" cargando={false} error={new ErrorDeSgspe(500, 'Falló', [], 'corr-9')} />)
    expect(await screen.findByText(/corr-9/)).toBeInTheDocument()
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
  })

  it('un 403 del indicador dice "No disponible", no un error rojo; otro error sí es un error', async () => {
    montar(<KpiCard titulo="Cifra" cargando={false} error={new ErrorDeSgspe(403, 'Prohibido', [], 'corr-403')} />)
    expect(await screen.findByText('No disponible')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/corr-403/)).not.toBeInTheDocument()
  })

  it('mientras carga usa el "Cargando…" compacto: el mismo texto accesible, sin el relleno vertical de la página', async () => {
    montar(
      <>
        <KpiCard titulo="Cifra" cargando />
        <Cargando />
      </>
    )
    const [enTarjeta, enPagina] = await screen.findAllByRole('status')
    expect(enTarjeta).toHaveTextContent('Cargando…')
    expect(enTarjeta).toHaveAttribute('aria-busy', 'true')
    expect(enTarjeta).not.toHaveClass('py-6')
    expect(enPagina).toHaveClass('py-6')
  })

  it('un módulo que no llegó dice en qué fase llega', async () => {
    montar(<KpiCard titulo="Compromisos vencidos" llegaEn="F3" />)
    expect(await screen.findByText('Llega en F3')).toBeInTheDocument()
  })
})

describe('Pasos', () => {
  it('marca el paso actual y solo deja volver a los visitados', async () => {
    const ir = vi.fn()
    montar(<Pasos pasos={['Uno', 'Dos', 'Tres']} actual={1} visitados={1} alIr={ir} />)
    expect(await screen.findByRole('button', { name: /Dos/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /Tres/ })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /Uno/ }))
    await waitFor(() => expect(ir).toHaveBeenCalledWith(0))
  })
})

describe('errores con varias violaciones', () => {
  it('dice todas las violaciones con código, no solo la primera, y una repetida una vez', async () => {
    montar(
      <ErrorDeCarga
        error={
          new ErrorDeSgspe(
            400,
            'x',
            [
              { field: 'registered_members_count', message: 'DERIVED_FIELD' },
              { field: 'calculated_area_ha', message: 'DERIVED_FIELD' },
              { field: 'record', message: 'EXACTLY_ONE' }
            ],
            null
          )
        }
      />
    )
    const derivado = 'Ese dato lo calcula el sistema: no se escribe a mano.'
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain(derivado)
    expect(alerta.textContent?.split(derivado)).toHaveLength(2)
    expect(alerta.textContent).toContain('Indique exactamente uno')
    expect(screen.queryByText(/EXACTLY_ONE|DERIVED_FIELD/)).not.toBeInTheDocument()
  })

  it('HAS_DEPENDENTS sin campo no deja paréntesis vacíos', async () => {
    montar(<ErrorDeCarga error={new ErrorDeSgspe(409, 'x', [{ field: '', message: 'HAS_DEPENDENTS' }], null)} />)
    expect(await screen.findByText('No se puede borrar: otros registros dependen de este. Bórrelos o cámbielos primero.')).toBeInTheDocument()
    expect(screen.queryByText(/\(\)/)).not.toBeInTheDocument()
  })

  // wasichai 0.6.0 (RelationTargets) responde así una RELATION a un registro que la cuenta no lee: con el alcance por proyecto,
  // también uno de otro proyecto (spec 4.4 §3.6). el texto en inglés y el detail nunca llegan a la pantalla
  it('el 400 de una relación a un registro que no se lee dice su texto, no el inglés de wasichai', async () => {
    montar(<ErrorDeCarga error={new ErrorDeSgspe(400, "Invalid value for 'project'", [{ field: 'project', message: 'no record with this id' }], null)} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('El registro elegido no existe o es de otro proyecto.')
    expect(screen.queryByText(/no record with this id|Invalid value/)).not.toBeInTheDocument()
  })
})

describe('TablaDeRegistros', () => {
  const consulta = {
    isPending: false,
    isError: false,
    data: pagina([registro('r1', { name: 'Uno' }), registro('r2', { name: 'Dos' })])
  } as unknown as UseQueryResult<Pagina>
  const columnas = [{ id: 'nombre', encabezado: 'Nombre', celda: (r: { attributes: Record<string, unknown> }) => String(r.attributes.name) }]

  it('una fila clicable se abre con el teclado: Enter y Espacio', async () => {
    const abrir = vi.fn()
    montar(<TablaDeRegistros consulta={consulta} columnas={columnas} etiqueta="Registros" vacio={null} alPagina={vi.fn()} alAbrir={abrir} />)
    const fila = (await screen.findByText('Uno')).closest('tr')!
    expect(fila).toHaveAttribute('tabindex', '0')
    fila.focus()
    await userEvent.keyboard('{Enter}')
    expect(abrir).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'r1' }))
    await userEvent.keyboard(' ')
    expect(abrir).toHaveBeenCalledTimes(2)
  })

  it('sin alAbrir las filas no entran en el orden del teclado, y la casilla no abre la fila', async () => {
    const abrir = vi.fn()
    const { unmount } = montar(<TablaDeRegistros consulta={consulta} columnas={columnas} etiqueta="Registros" vacio={null} alPagina={vi.fn()} />)
    expect((await screen.findByText('Uno')).closest('tr')).not.toHaveAttribute('tabindex')
    unmount()
    montar(
      <TablaDeRegistros consulta={consulta} columnas={columnas} etiqueta="Registros" vacio={null} alPagina={vi.fn()} alAbrir={abrir} alSeleccionar={vi.fn()} />
    )
    const casilla = (await screen.findAllByRole('checkbox'))[0]
    casilla.focus()
    await userEvent.keyboard(' ')
    expect(abrir).not.toHaveBeenCalled()
  })
})

describe('NombreDelGrupo', () => {
  it('si la lectura del actor falla, dice «Persona registrada», no un nombre vacío', async () => {
    fetch = mockFetch([{ path: '/objects/person/records/p1', status: 500, body: { title: 'Error', status: 500, detail: 'x', errors: [] } }])
    montar(<NombreDelGrupo grupo={registro('g1', { person: 'p1' })} />)
    expect(await screen.findByText('Persona registrada')).toBeInTheDocument()
  })

  it('un grupo sin actor no queda en «…» para siempre', async () => {
    montar(<NombreDelGrupo grupo={registro('g1', {})} />)
    expect(await screen.findByText('Persona registrada')).toBeInTheDocument()
    expect(screen.queryByText('…')).not.toBeInTheDocument()
  })
})
