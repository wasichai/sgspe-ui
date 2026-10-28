import { EnlaceConRastro } from '../contexto/Rastro'
import { PaginasDeRiesgos } from './PaginasDeRiesgos'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { CabeceraDeFicha, tituloQueDiceQueEs } from '../componentes/CabeceraDeFicha'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta, Vacio } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { Historia } from '../componentes/Historia'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { ordenEnUrl, PaginacionDelServidor, useParametrosDeLista, VacioDeLista } from '../componentes/Lista'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { SelectorDeVista } from '../componentes/SelectorDeVista'
import { TablaPriorizada, type ColumnaPriorizada, type OrdenDeTabla } from '../componentes/TablaPriorizada'
import { useMigaDelRegistro } from '../componentes/Migas'
import { PanelDeDecision } from '../componentes/PanelDeDecision'
import { PestanasDeFicha } from '../componentes/PestanasDeFicha'
import { useRotuloDeRegistro } from '../componentes/RegistroVinculado'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { rutaDeFicha, rutaParaAbrir } from '../datos/fichas'
import { texto, useConteo, useConteos, usePuedeEditar, useRegistro, useRegistros, useTodos, type Parametros, type Registro } from '../datos/registros'
import { fechaPe, fechaYHoraPe, NS } from '../i18n'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { opcion } from '../datos/opciones'
import { Seccion } from '../componentes/Seccion'

// los incidentes (screens.md §9, ficha de incidente; WF-M): la lista del proyecto, paginada en el servidor (D10 de la revisión de
// UX), con «Registrar incidente» y la ficha con qué pasó,
// la respuesta inmediata y sus consecuencias (cerrar exige las dos: FIELD_REQUIRED, que transition-checks dice antes), lo que generó
// (riesgos con origin_incident, quejas con incident y señales con incident; una queja confidencial que quien mira no lee no aparece)
// y sus evidencias. «Identificar un riesgo desde este incidente» abre el alta del registro de riesgos con el incidente de origen
const POR_PAGINA = 25
const CAMPOS_DEL_ALTA = ['code', 'incident_type', 'occurred_at', 'place', 'description', 'locality', 'community']
const CAMPOS = ['code', 'incident_type', 'occurred_at', 'place', 'description', 'immediate_response', 'consequences', 'locality', 'community']
// la lista con el patrón común de las listas (tercera pasada de UX, 3.8): las vistas por estado con su conteo, la búsqueda y el
// orden en el servidor y en la URL, la tabla priorizada (o tarjetas en el teléfono) y la ficha con «Volver», «Anterior» y
// «Siguiente». un incidente no tiene título: se nombra por su código y lo que pasó, como una QCS
const VISTAS = ['todos', 'abiertos', 'cerrados'] as const
const ESTADOS_DE_VISTA: Record<string, string | undefined> = { abiertos: 'reported,under_review,responding', cerrados: 'closed' }
const CAMPO_DE_ORDEN: Record<string, string> = { incidente: 'code', ocurrio: 'occurred_at' }
const ORDEN_INICIAL: OrdenDeTabla = { columna: 'ocurrio', dir: 'desc' }

export function IncidentesPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { projectId = '' } = useParams()
  const navegar = useNavigate()
  const telefono = useEsTelefono()
  const escribe = useEscribeEnProyecto(projectId)
  const lista = useParametrosDeLista('todos')
  const vista = VISTAS.find((v) => v === lista.vista) ?? 'todos'
  const q = lista.filtro('q').trim()
  const [orden, ordenar] = ordenEnUrl(lista, ORDEN_INICIAL, ['incidente', 'ocurrio'])
  const alcance: Parametros = { project: projectId }
  const conVista = (v: string): Parametros => ({ ...alcance, ...(ESTADOS_DE_VISTA[v] ? { state: ESTADOS_DE_VISTA[v] } : {}), ...(q ? { q } : {}) })
  const incidentes = useRegistros('incident', {
    ...conVista(vista),
    sort: CAMPO_DE_ORDEN[orden.columna],
    dir: orden.dir,
    page: lista.pagina,
    size: POR_PAGINA
  })
  const conteos = useConteos('incident', Object.fromEntries(VISTAS.map((v) => [v, conVista(v)])))
  const total = useConteo('incident', alcance)
  const filas = incidentes.data?.content ?? []
  const conFiltros = vista !== 'todos' || Boolean(q)
  const [registrando, setRegistrando] = useState(false)
  const nombre = (i: Registro) => tituloQueDiceQueEs(texto(i, 'description'), texto(i, 'code'))
  const enlace = (i: Registro) => (
    <EnlaceDeRegistro
      codigo={texto(i, 'code')}
      titulo={nombre(i)}
      ruta={rutaDeFicha('incident', i) ?? rutaParaAbrir('incident', i.id)}
      desde={t('incidentes.titulo')}
      codigoEnElEnlace
    />
  )
  const ocurrio = (i: Registro) => (texto(i, 'occurred_at') ? fechaPe(new Date(texto(i, 'occurred_at'))) : '—')
  const columnas: ColumnaPriorizada[] = [
    { id: 'incidente', encabezado: t('incidentes.columnas.incidente'), prioridad: 'esencial', claseDeCelda: 'min-w-64 text-sm', ordenable: true },
    { id: 'ocurrio', encabezado: t('incidentes.columnas.ocurrio'), prioridad: 'esencial', claseDeCelda: 'text-sm', ordenable: true },
    { id: 'tipo', encabezado: t('incidentes.columnas.tipo'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'lugar', encabezado: t('incidentes.columnas.lugar'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'estado', encabezado: t('incidentes.columnas.estado'), prioridad: 'esencial' }
  ]
  const celda = (i: Registro, columna: string): ReactNode => {
    switch (columna) {
      case 'incidente':
        return enlace(i)
      case 'ocurrio':
        return ocurrio(i)
      case 'tipo':
        return opcion(i, 'incident_type') || '—'
      case 'lugar':
        return texto(i, 'place') || '—'
      default:
        return <EstadoChip objeto="incident" estado={i.state} />
    }
  }
  const valorPlano = (i: Registro, columna: string): string => (columna === 'tipo' ? texto(i, 'incident_type') : columna === 'lugar' ? texto(i, 'place') : i.id)
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        titulo={t('incidentes.titulo')}
        conteo={total != null ? t('incidentes.conteo', { count: total }) : undefined}
        primaria={escribe && can('incident', 'CREATE') ? <Button onClick={() => setRegistrando(true)}>{t('incidentes.registrar')}</Button> : undefined}
        vistas={<PaginasDeRiesgos actual="incidents" />}
      />
      <BarraDeFiltros
        vista={
          <SelectorDeVista
            etiqueta={t('comun.vistas')}
            vistas={VISTAS.map((v) => ({ id: v, etiqueta: t(`incidentes.vistas.${v}`), n: conteos[v] }))}
            actual={vista}
            alElegir={(v) => lista.cambiar({ view: v === 'todos' ? null : v })}
          />
        }
        busqueda={{ etiqueta: t('incidentes.buscar'), valor: lista.filtro('q'), alCambiar: (valor) => lista.cambiar({ q: valor }) }}
        aplicados={q ? [{ clave: 'q', etiqueta: t('comun.contiene', { texto: q }), alQuitar: () => lista.cambiar({ q: null }) }] : []}
        alLimpiar={() => lista.cambiar({ q: null })}
      />
      {incidentes.isPending ? (
        <Cargando />
      ) : incidentes.isError && !incidentes.data ? (
        <FalloDeLectura error={incidentes.error} alReintentar={() => void incidentes.refetch()} />
      ) : filas.length === 0 ? (
        conFiltros ? (
          <VacioDeLista conFiltros alLimpiar={() => lista.cambiar({ view: null, q: null })} sinFiltros={total || undefined} />
        ) : (
          <Vacio titulo={t('incidentes.vacio')}>{t('incidentes.comoEmpezar')}</Vacio>
        )
      ) : telefono ? (
        <ListaEnTarjetas
          etiqueta={t('incidentes.tabla')}
          total={incidentes.data?.totalElements}
          tarjetas={filas.map((i) => ({
            id: i.id,
            titulo: enlace(i),
            estado: <EstadoChip objeto="incident" estado={i.state} />,
            detalle: [ocurrio(i), opcion(i, 'incident_type'), texto(i, 'place')].filter((v) => v && v !== '—').join(' · ')
          }))}
        />
      ) : (
        <TablaPriorizada<Registro>
          etiqueta={t('incidentes.tabla')}
          total={incidentes.data?.totalElements}
          columnas={columnas}
          filas={filas}
          clave={(i) => i.id}
          celda={celda}
          valorPlano={valorPlano}
          ocultarUniformes
          orden={orden}
          alOrdenar={ordenar}
        />
      )}
      <PaginacionDelServidor datos={incidentes.data} alPagina={(p) => lista.cambiar({ page: String(p) })} />
      <Drawer titulo={t('incidentes.registrar')} abierto={registrando} alCerrar={() => setRegistrando(false)}>
        {registrando ? (
          <FormularioDeRegistro
            objeto="incident"
            fijos={{ project: projectId }}
            campos={CAMPOS_DEL_ALTA}
            alGuardar={(i) => navegar(rutaDeFicha('incident', i) ?? rutaParaAbrir('incident', i.id))}
            alCancelar={() => setRegistrando(false)}
          />
        ) : null}
      </Drawer>
    </section>
  )
}

// risks/incidents y risks/incidents/:incidentId no son rutas del diseño (screens.md: los incidentes viven en
// /projects/:projectId/incidents), pero se escriben al lado de risks/warnings o risks/signals: llevan a la ruta canónica en lugar
// de abrir la ficha de un riesgo con el id «incidents», que quedaba vacía (humo F4, D4)
export function IncidentesDesdeRiesgos() {
  const { projectId = '', incidentId } = useParams()
  const base = `/projects/${encodeURIComponent(projectId)}/incidents`
  return <Navigate to={incidentId ? `${base}/${encodeURIComponent(incidentId)}` : base} replace />
}

export function FichaIncidentePage() {
  const { t } = useTranslation(NS)
  const { projectId = '', incidentId = '' } = useParams()
  const incidente = useRegistro('incident', incidentId)
  const volver = `/projects/${encodeURIComponent(projectId)}/incidents`
  const noExiste = (
    <div className="space-y-3">
      <Alert tone="warning">{t('incidentes.ficha.noExiste')}</Alert>
      <Link to={volver} className="text-sm text-sg-primary-text underline">
        {t('incidentes.ficha.volver')}
      </Link>
    </div>
  )
  return (
    <Consulta consulta={incidente} noExiste={noExiste}>
      {(i) => <Ficha key={i.id} incidente={i} volver={volver} />}
    </Consulta>
  )
}

// la anatomía común de una ficha (tercera pasada de UX, 1.5): cabecera con una sola primaria (la siguiente acción, con lo que la
// impide debajo), panel de decisión con el camino de WF-M y pestañas en la URL. el título dice qué pasó; cerrar pide en su diálogo
// la respuesta inmediata y las consecuencias, si faltan
const CAMINO = ['reported', 'under_review', 'responding', 'closed']
const COMPROBAR = ['close']

function Ficha({ incidente, volver }: { incidente: Registro; volver: string }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyecto = texto(incidente, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const edita = usePuedeEditar('incident') && escribe
  const [editando, setEditando] = useState(false)
  const faltaRespuesta = !texto(incidente, 'immediate_response') || !texto(incidente, 'consequences')
  const nuevoRiesgo = `/projects/${encodeURIComponent(proyecto)}/risks/register?nuevo=1&origin_incident=${encodeURIComponent(incidente.id)}`
  const codigo = texto(incidente, 'code')
  useMigaDelRegistro(codigo)
  const siguiente = useSiguienteAccion('incident', incidente, COMPROBAR)
  return (
    <article className="mx-auto max-w-[1440px] space-y-4">
      <Link to={volver} className="text-sm text-sg-primary-text underline">
        {t('incidentes.ficha.volver')}
      </Link>
      <CabeceraDeFicha
        antetitulo={[t('incidentes.ficha.tipo'), codigo, opcion(incidente, 'incident_type')].filter(Boolean).join(' · ')}
        titulo={tituloQueDiceQueEs(texto(incidente, 'description'), codigo)}
        tituloDelDocumento={codigo}
        chips={
          <>
            {texto(incidente, 'occurred_at') ? (
              <span>{t('incidentes.ficha.ocurrio', { fecha: fechaYHoraPe(new Date(texto(incidente, 'occurred_at'))) })}</span>
            ) : null}
            {texto(incidente, 'place') ? <span>{texto(incidente, 'place')}</span> : null}
          </>
        }
        objeto="incident"
        registro={incidente}
        proyecto={proyecto}
        comprobarAntes={COMPROBAR}
        falta={siguiente?.falta}
        faltaCampo={siguiente?.campo}
        secundarias={[
          ...(edita
            ? [
                {
                  clave: 'editar',
                  nodo: (
                    <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                      {t('incidentes.ficha.editar')}
                    </Button>
                  )
                }
              ]
            : []),
          ...(escribe && can('social_risk', 'CREATE')
            ? [
                {
                  clave: 'riesgo',
                  nodo: (
                    <Button asChild size="sm" variant="secondary">
                      <Link to={nuevoRiesgo}>{t('incidentes.ficha.identificarRiesgo')}</Link>
                    </Button>
                  )
                }
              ]
            : [])
        ]}
      />
      <PanelDeDecision
        camino={CAMINO}
        objeto="incident"
        proyecto={proyecto}
        estado={incidente.state}
        desde={texto(incidente, 'state_changed_at') || null}
        por={texto(incidente, 'state_changed_by') || null}
        siguiente={siguiente}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PestanasDeFicha
          etiqueta={codigo}
          pestanas={[
            {
              id: 'resumen',
              etiqueta: t('incidentes.ficha.pestanas.resumen'),
              render: () => <Resumen incidente={incidente} faltaRespuesta={faltaRespuesta} />
            },
            {
              id: 'evidencias',
              etiqueta: t('incidentes.ficha.pestanas.evidencias'),
              render: () => (
                <div className="space-y-2">
                  <p className="pt-3 text-sg-caption text-sg-text-muted">{t('incidentes.ficha.evidenciasAyuda')}</p>
                  <EvidenciasDelRegistro objeto="incident" registro={incidente} escribe={escribe} />
                </div>
              )
            },
            {
              id: 'actividad',
              etiqueta: t('incidentes.ficha.pestanas.actividad'),
              render: () => (
                <div className="pt-3">
                  <Historia objeto="incident" id={incidente.id} vacio={t('incidentes.ficha.sinActividad')} />
                </div>
              )
            }
          ]}
        />
        <QueGenero incidente={incidente} />
      </div>
      <Drawer
        titulo={t('incidentes.ficha.editarTitulo')}
        descripcion={t('incidentes.ficha.cerrarExige')}
        abierto={editando}
        alCerrar={() => setEditando(false)}
      >
        {editando ? (
          <FormularioDeRegistro
            objeto="incident"
            registro={incidente}
            campos={CAMPOS}
            alGuardar={() => setEditando(false)}
            alCancelar={() => setEditando(false)}
          />
        ) : null}
      </Drawer>
    </article>
  )
}

function Resumen({ incidente, faltaRespuesta }: { incidente: Registro; faltaRespuesta: boolean }) {
  const { t } = useTranslation(NS)
  return (
    <div className="space-y-4 pt-3 text-sm">
      <section aria-label={t('incidentes.ficha.quePaso')} className="space-y-1">
        <h2 className="text-sg-h3 font-semibold">{t('incidentes.ficha.quePaso')}</h2>
        <p className="whitespace-pre-line">{texto(incidente, 'description') || '—'}</p>
      </section>
      <section aria-label={t('incidentes.ficha.respuesta')} className="space-y-2">
        <h2 className="text-sg-h3 font-semibold">{t('incidentes.ficha.respuesta')}</h2>
        {faltaRespuesta && incidente.state !== 'closed' ? <Alert tone="notice">{t('incidentes.ficha.cerrarExige')}</Alert> : null}
        <dl className="space-y-2">
          <div>
            <dt className="text-sg-caption text-sg-text-muted">{t('incidentes.ficha.respuestaInmediata')}</dt>
            <dd className="whitespace-pre-line">{texto(incidente, 'immediate_response') || '—'}</dd>
          </div>
          <div>
            <dt className="text-sg-caption text-sg-text-muted">{t('incidentes.ficha.consecuencias')}</dt>
            <dd className="whitespace-pre-line">{texto(incidente, 'consequences') || '—'}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

// lo que el incidente generó, de cada objeto que lo nombra; una lectura que falla lo dice junto a lo que no se pudo leer
function QueGenero({ incidente }: { incidente: Registro }) {
  const { t } = useTranslation(NS)
  const riesgos = useTodos('social_risk', { origin_incident: incidente.id })
  const quejas = useTodos('grievance', { incident: incidente.id })
  const senales = useTodos('early_warning_signal', { incident: incidente.id })
  return (
    <Seccion elemento="aside" etiqueta={t('incidentes.ficha.queGenero')} className="space-y-3 text-sm">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('incidentes.ficha.queGenero')}</h2>
      <Generados titulo={t('incidentes.ficha.riesgos')} objeto="social_risk" consulta={riesgos} />
      <Generados titulo={t('incidentes.ficha.quejas')} objeto="grievance" consulta={quejas} />
      <Generados titulo={t('incidentes.ficha.senales')} objeto="early_warning_signal" consulta={senales} />
    </Seccion>
  )
}

function Generados({ titulo, objeto, consulta }: { titulo: string; objeto: string; consulta: UseQueryResult<Registro[]> }) {
  const { t } = useTranslation(NS)
  const rotulo = useRotuloDeRegistro()
  // una señal no tiene código ni título: se nombra por su fecha y su texto
  const nombre = (r: Registro) =>
    objeto === 'early_warning_signal'
      ? [texto(r, 'received_at') ? fechaPe(new Date(texto(r, 'received_at'))) : '', texto(r, 'description')].filter(Boolean).join(' · ')
      : rotulo(r)
  return (
    <section aria-label={titulo} className="space-y-1">
      <h3 className="font-medium">{titulo}</h3>
      {consulta.isPending ? (
        <Cargando compacto />
      ) : consulta.isError && !consulta.data ? (
        <FalloDeLectura error={consulta.error} alReintentar={() => void consulta.refetch()} />
      ) : consulta.data.length === 0 ? (
        <p className="text-sg-text-muted">{t('incidentes.ficha.nada')}</p>
      ) : (
        <ul>
          {consulta.data.map((r) => (
            <li key={r.id}>
              <EnlaceConRastro to={rutaDeFicha(objeto, r) ?? rutaParaAbrir(objeto, r.id)} className="text-sg-primary-text underline">
                {nombre(r)}
              </EnlaceConRastro>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
