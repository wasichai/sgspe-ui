import { EnlaceConRastro } from '../contexto/Rastro'
import { PaginasDeRiesgos } from './PaginasDeRiesgos'
import type { UseQueryResult } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Table, Tabs, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta, Vacio } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { Historia } from '../componentes/Historia'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { PaginacionDelServidor, useParametrosDeLista } from '../componentes/Lista'
import { useRotuloDeRegistro } from '../componentes/RegistroVinculado'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { rutaDeFicha, rutaParaAbrir } from '../datos/fichas'
import { texto, usePuedeEditar, useRegistro, useRegistros, useTodos, type Registro } from '../datos/registros'
import { fechaPe, fechaYHoraPe, NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { opcion } from '../datos/opciones'

// los incidentes (screens.md §9, ficha de incidente; WF-M): la lista del proyecto, paginada en el servidor (D10 de la revisión de
// UX), con «Registrar incidente» y la ficha con qué pasó,
// la respuesta inmediata y sus consecuencias (cerrar exige las dos: FIELD_REQUIRED, que transition-checks dice antes), lo que generó
// (riesgos con origin_incident, quejas con incident y señales con incident; una queja confidencial que quien mira no lee no aparece)
// y sus evidencias. «Identificar un riesgo desde este incidente» abre el alta del registro de riesgos con el incidente de origen
const POR_PAGINA = 25
const CAMPOS_DEL_ALTA = ['code', 'incident_type', 'occurred_at', 'place', 'description', 'locality', 'community']
const CAMPOS = ['code', 'incident_type', 'occurred_at', 'place', 'description', 'immediate_response', 'consequences', 'locality', 'community']

export function IncidentesPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { projectId = '' } = useParams()
  const navegar = useNavigate()
  const escribe = useEscribeEnProyecto(projectId)
  const lista = useParametrosDeLista('todos')
  const incidentes = useRegistros('incident', { project: projectId, sort: 'occurred_at', dir: 'desc', page: lista.pagina, size: POR_PAGINA })
  const filas = incidentes.data?.content ?? []
  const [registrando, setRegistrando] = useState(false)
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{t('incidentes.titulo')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PaginasDeRiesgos actual="incidents" />
          {escribe && can('incident', 'CREATE') ? <Button onClick={() => setRegistrando(true)}>{t('incidentes.registrar')}</Button> : null}
        </div>
      </div>
      {incidentes.isPending ? (
        <Cargando />
      ) : incidentes.isError && !incidentes.data ? (
        <FalloDeLectura error={incidentes.error} alReintentar={() => void incidentes.refetch()} />
      ) : filas.length === 0 ? (
        <Vacio titulo={t('incidentes.vacio')} />
      ) : (
        <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
          <Table aria-label={t('incidentes.tabla')}>
            <thead>
              <tr>
                {(['codigo', 'ocurrio', 'tipo', 'lugar', 'estado'] as const).map((c) => (
                  <Th key={c} scope="col">
                    {t(`incidentes.columnas.${c}`)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((i) => (
                <tr key={i.id}>
                  <Td className="text-sm">
                    <EnlaceConRastro to={rutaDeFicha('incident', i) ?? rutaParaAbrir('incident', i.id)} className="font-sg-mono text-sg-primary-text underline">
                      {texto(i, 'code')}
                    </EnlaceConRastro>
                  </Td>
                  <Td className="text-sm">{texto(i, 'occurred_at') ? fechaPe(new Date(texto(i, 'occurred_at'))) : '—'}</Td>
                  <Td className="text-sm">{opcion(i, 'incident_type') || '—'}</Td>
                  <Td className="text-sm">{texto(i, 'place') || '—'}</Td>
                  <Td>
                    <EstadoChip objeto="incident" estado={i.state} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
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

function Ficha({ incidente, volver }: { incidente: Registro; volver: string }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyecto = texto(incidente, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const edita = usePuedeEditar('incident') && escribe
  const [editando, setEditando] = useState(false)
  const faltaRespuesta = !texto(incidente, 'immediate_response') || !texto(incidente, 'consequences')
  const nuevoRiesgo = `/projects/${encodeURIComponent(proyecto)}/risks/register?nuevo=1&origin_incident=${encodeURIComponent(incidente.id)}`
  return (
    <article className="mx-auto max-w-[1440px] space-y-4">
      <Link to={volver} className="text-sm text-sg-primary-text underline">
        {t('incidentes.ficha.volver')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sg-overline font-semibold uppercase text-sg-text-muted">{opcion(incidente, 'incident_type') || '—'}</p>
          <h1 className="text-sg-h1 font-semibold">{texto(incidente, 'code')}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <EstadoChip objeto="incident" estado={incidente.state} />
            {texto(incidente, 'occurred_at') ? (
              <span>{t('incidentes.ficha.ocurrio', { fecha: fechaYHoraPe(new Date(texto(incidente, 'occurred_at'))) })}</span>
            ) : null}
            {texto(incidente, 'place') ? <span>{texto(incidente, 'place')}</span> : null}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {edita ? (
              <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                {t('incidentes.ficha.editar')}
              </Button>
            ) : null}
            {escribe && can('social_risk', 'CREATE') ? (
              <Link to={nuevoRiesgo} className="text-sm text-sg-primary-text underline">
                {t('incidentes.ficha.identificarRiesgo')}
              </Link>
            ) : null}
          </div>
          <BotonesDeTransicion objeto="incident" registro={incidente} proyecto={proyecto} comprobarAntes={['close']} />
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Tabs
          label={texto(incidente, 'code')}
          tabs={[
            { id: 'resumen', label: t('incidentes.ficha.pestanas.resumen'), render: () => <Resumen incidente={incidente} faltaRespuesta={faltaRespuesta} /> },
            {
              id: 'evidencias',
              label: t('incidentes.ficha.pestanas.evidencias'),
              render: () => (
                <div className="space-y-2">
                  <p className="pt-3 text-sg-caption text-sg-text-muted">{t('incidentes.ficha.evidenciasAyuda')}</p>
                  <EvidenciasDelRegistro objeto="incident" registro={incidente} escribe={escribe} />
                </div>
              )
            },
            {
              id: 'actividad',
              label: t('incidentes.ficha.pestanas.actividad'),
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
    <aside aria-label={t('incidentes.ficha.queGenero')} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('incidentes.ficha.queGenero')}</h2>
      <Generados titulo={t('incidentes.ficha.riesgos')} objeto="social_risk" consulta={riesgos} />
      <Generados titulo={t('incidentes.ficha.quejas')} objeto="grievance" consulta={quejas} />
      <Generados titulo={t('incidentes.ficha.senales')} objeto="early_warning_signal" consulta={senales} />
    </aside>
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
