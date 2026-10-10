import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Table, Tabs, Td, Textarea, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo, SelectNativo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { Historia } from '../componentes/Historia'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { NombreDelGrupo } from '../componentes/NombreDeActor'
import { RegistrosSimples } from '../componentes/RegistrosSimples'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyecto } from '../contexto/proyectos'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { hoyEnLima } from '../datos/fechas'
import { rutaDeFicha } from '../datos/fichas'
import { atributo, texto, usePuedeEditar, useRegistro, useRelacionados, useTodos, type Registro } from '../datos/registros'
import { diaPe, NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { useRevisarRiesgo } from './comandos'
import { Impactos } from './ImpactosPage'
import { NivelDeRiesgo } from './NivelDeRiesgo'
import { nivelDePuntaje, umbralesDe } from './niveles'

// S40 · ficha de riesgo (screens.md §9, flujos 14 y 15): el nivel vigente, cómo llegó ahí y qué se hace para bajarlo. «Nueva
// revisión» es el endpoint de revisiones (api.md §4.7): las revisiones son inmutables y una se corrige con otra; la primera aplica
// assess (transición de comando, sin botón). las demás transiciones de WF-F van con su motivo (social_risk es requiresReason) y se
// comprueban antes (MEASURE_OWNER_REQUIRED, RESIDUAL_ASSESSMENT_REQUIRED, la decisión de tratamiento y el motivo de cierre). las
// medidas de mitigación, los impactos potenciales y las evidencias viven en la ficha; a la derecha, lo que alimenta al riesgo (QCS y
// alertas: una QCS confidencial que la cuenta no lee simplemente no llega, security.md §9.6) y su contexto
const COMPROBAR = [
  'decide_mitigation',
  'decide_monitoring',
  'start_monitoring',
  'resume_mitigation',
  'close_identified',
  'close_assessed',
  'close_mitigating',
  'close_monitoring'
]
const EDITABLES = [
  'title',
  'risk_source',
  'category',
  'impact_type',
  'impact_nature',
  'treatment_decision',
  'treatment_rationale',
  'current_controls',
  'controls_adequate',
  'monitoring_sources',
  'review_every_days',
  'owner_user_id',
  'owner_user_email',
  'close_reason',
  'locality',
  'community',
  'key_theme',
  'local_conflict',
  'area_of_influence'
]
const CAMPOS_DE_MEDIDA = ['description', 'owner_user_id', 'owner_user_email', 'planned_date', 'completed', 'completed_date']
const ESCALA = ['1', '2', '3', '4', '5']

export function FichaRiesgoPage() {
  const { t } = useTranslation(NS)
  const { projectId = '', riskId = '' } = useParams()
  const riesgo = useRegistro('social_risk', riskId)
  const noExiste = (
    <div className="space-y-3">
      <Alert tone="warning">{t('fichaRiesgo.noExiste')}</Alert>
      <Link to={`/projects/${encodeURIComponent(projectId)}/risks/register`} className="text-sm text-sg-primary-text underline">
        {t('fichaRiesgo.volver')}
      </Link>
    </div>
  )
  // la ficha se monta de nuevo por riesgo: pasar a otro no arrastra el diálogo, el drawer ni lo escrito
  return (
    <Consulta consulta={riesgo} noExiste={noExiste}>
      {(r) => <Ficha key={r.id} riesgo={r} />}
    </Consulta>
  )
}

function Ficha({ riesgo }: { riesgo: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyecto = texto(riesgo, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const edita = usePuedeEditar('social_risk') && escribe
  const revisa = escribe && can('risk_assessment', 'CREATE') && can('social_risk', 'UPDATE') && riesgo.state !== 'closed'
  const [editando, setEditando] = useState(false)
  const [revisando, setRevisando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [hecha, setHecha] = useState<string | null>(null)
  const revisiones = useTodos('risk_assessment', { social_risk: riesgo.id, sort: 'assessment_date', dir: 'desc' })
  const cerrar = () => {
    setEditando(false)
    setMotivo('')
  }
  const cadencia = texto(riesgo, 'review_every_days')
  return (
    <article className="space-y-4">
      <Link to={`/projects/${encodeURIComponent(proyecto)}/risks/register`} className="text-sm text-sg-primary-text underline">
        {t('fichaRiesgo.volver')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sg-overline font-semibold uppercase text-sg-text-muted">
            {texto(riesgo, 'code')} · {texto(riesgo, 'category') || '—'}
          </p>
          <h1 className="text-sg-h1 font-semibold">{texto(riesgo, 'title')}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <EstadoChip objeto="social_risk" estado={riesgo.state} />
            <NivelDeRiesgo valor={atributo(riesgo, 'risk_level')} />
            {texto(riesgo, 'score') ? (
              <span className="tabular-nums">
                {t('fichaRiesgo.puntaje', { p: texto(riesgo, 'probability'), i: texto(riesgo, 'impact'), s: texto(riesgo, 'score') })}
              </span>
            ) : null}
            {atributo(riesgo, 'residual_level') ? <NivelDeRiesgo valor={atributo(riesgo, 'residual_level')} residual /> : null}
            <SituacionDePlazo valor={atributo(riesgo, 'review_status')} revision />
            {texto(riesgo, 'next_review_date') ? <span>{t('fichaRiesgo.proxima', { fecha: diaPe(texto(riesgo, 'next_review_date')) })}</span> : null}
          </div>
          <p className="text-sm text-sg-text-secondary">
            {t('fichaRiesgo.responsable')}: {texto(riesgo, 'owner_user_email') || t('fichaRiesgo.sinResponsable')} ·{' '}
            {cadencia ? t('fichaRiesgo.cadencia', { n: cadencia }) : t('fichaRiesgo.cadenciaDelProyecto')}
          </p>
          {hecha ? (
            <p role="status" className="text-sm text-sg-success">
              {hecha}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {revisa ? (
              <Button
                size="sm"
                onClick={() => {
                  setHecha(null)
                  setRevisando(true)
                }}
              >
                {t('fichaRiesgo.revision.nueva')}
              </Button>
            ) : null}
            {edita ? (
              <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                {t('fichaRiesgo.editar')}
              </Button>
            ) : null}
          </div>
          <BotonesDeTransicion objeto="social_risk" registro={riesgo} proyecto={proyecto} comprobarAntes={COMPROBAR} />
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Tabs
          label={texto(riesgo, 'title')}
          tabs={[
            { id: 'resumen', label: t('fichaRiesgo.pestanas.resumen'), render: () => <Resumen riesgo={riesgo} /> },
            {
              id: 'revisiones',
              label: t('fichaRiesgo.pestanas.revisiones'),
              render: () => (
                <div className="pt-3">
                  <Revisiones consulta={revisiones} />
                </div>
              )
            },
            {
              id: 'medidas',
              label: t('fichaRiesgo.pestanas.medidas'),
              render: () => (
                <div className="space-y-2 pt-3">
                  <p className="text-sg-caption text-sg-text-muted">{t('fichaRiesgo.medidas.ayuda')}</p>
                  <RegistrosSimples
                    objeto="mitigation_measure"
                    titulo={t('fichaRiesgo.medidas.titulo')}
                    filtros={{ social_risk: riesgo.id }}
                    fijos={{ social_risk: riesgo.id }}
                    columnas={columnasDeMedidas(t)}
                    campos={CAMPOS_DE_MEDIDA}
                    proyecto={proyecto}
                    textoNuevo={t('fichaRiesgo.medidas.nueva')}
                    textoVacio={t('fichaRiesgo.medidas.vacio')}
                  />
                </div>
              )
            },
            {
              id: 'impactos',
              label: t('fichaRiesgo.pestanas.impactos'),
              render: () => (
                <div className="pt-3">
                  <Impactos proyecto={proyecto} riesgo={riesgo.id} />
                </div>
              )
            },
            {
              id: 'evidencias',
              label: t('fichaRiesgo.pestanas.evidencias'),
              render: () => <EvidenciasDelRegistro objeto="social_risk" registro={riesgo} escribe={escribe} />
            },
            {
              id: 'actividad',
              label: t('fichaRiesgo.pestanas.actividad'),
              render: () => (
                <div className="pt-3">
                  <Historia objeto="social_risk" id={riesgo.id} vacio={t('fichaRiesgo.sinActividad')} />
                </div>
              )
            }
          ]}
        />
        <LoAlimentan riesgo={riesgo} />
      </div>
      {revisando ? (
        <NuevaRevision
          riesgo={riesgo}
          primera={revisiones.isSuccess && revisiones.data.length === 0}
          alCerrar={() => setRevisando(false)}
          alRegistrar={(nivel) => {
            setRevisando(false)
            setHecha(nivel ? t('fichaRiesgo.revision.hecha', { nivel }) : t('fichaRiesgo.revision.hechaSinNivel'))
          }}
        />
      ) : null}
      <Drawer titulo={t('fichaRiesgo.editar')} abierto={editando} alCerrar={cerrar}>
        <Campo etiqueta={t('comun.motivoObligatorio')} ayuda={t('fichaRiesgo.motivoAyuda')}>
          {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
        </Campo>
        <p className="text-sg-caption text-sg-text-muted">{t('fichaRiesgo.cadenciaAyuda')}</p>
        {editando ? (
          <FormularioDeRegistro
            objeto="social_risk"
            registro={riesgo}
            campos={EDITABLES}
            motivo={motivo.trim() || undefined}
            alGuardar={cerrar}
            alCancelar={cerrar}
          />
        ) : null}
      </Drawer>
    </article>
  )
}

// una medida atrasada: con fecha prevista pasada (en Lima) y sin completar
export const estaAtrasada = (medida: Registro, hoy: string = hoyEnLima()): boolean =>
  atributo(medida, 'completed') !== true && typeof atributo(medida, 'planned_date') === 'string' && texto(medida, 'planned_date') < hoy

function columnasDeMedidas(t: (clave: string) => string) {
  return [
    { id: 'medida', encabezado: t('fichaRiesgo.medidas.columnas.medida'), celda: (m: Registro) => texto(m, 'description') },
    { id: 'responsable', encabezado: t('fichaRiesgo.medidas.columnas.responsable'), celda: (m: Registro) => texto(m, 'owner_user_email') || '—' },
    {
      id: 'prevista',
      encabezado: t('fichaRiesgo.medidas.columnas.prevista'),
      celda: (m: Registro) => (texto(m, 'planned_date') ? diaPe(texto(m, 'planned_date')) : '—')
    },
    {
      id: 'avance',
      encabezado: t('fichaRiesgo.medidas.columnas.avance'),
      celda: (m: Registro) =>
        atributo(m, 'completed') === true ? (
          t('fichaRiesgo.medidas.completada')
        ) : estaAtrasada(m) ? (
          <span className="font-medium text-sg-danger">{t('fichaRiesgo.medidas.atrasada')}</span>
        ) : (
          t('fichaRiesgo.medidas.pendiente')
        )
    }
  ]
}

function Dato({ termino, children }: { termino: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sg-caption text-sg-text-muted">{termino}</dt>
      <dd className="whitespace-pre-line">{children}</dd>
    </div>
  )
}

function Resumen({ riesgo }: { riesgo: Registro }) {
  const { t } = useTranslation(NS)
  const valor = (campo: string) => texto(riesgo, campo) || '—'
  const adecuados = atributo(riesgo, 'controls_adequate')
  return (
    <dl className="grid gap-3 pt-3 text-sm sm:grid-cols-2">
      <Dato termino={t('fichaRiesgo.campos.fuente')}>{valor('risk_source')}</Dato>
      <Dato termino={t('fichaRiesgo.campos.impacto')}>
        {valor('impact_type')} · {valor('impact_nature')}
      </Dato>
      <Dato termino={t('fichaRiesgo.campos.tratamiento')}>{valor('treatment_decision')}</Dato>
      <Dato termino={t('fichaRiesgo.campos.razon')}>{valor('treatment_rationale')}</Dato>
      <Dato termino={t('fichaRiesgo.campos.controles')}>{valor('current_controls')}</Dato>
      <Dato termino={t('fichaRiesgo.campos.adecuados')}>{adecuados === true ? t('comun.si') : adecuados === false ? t('comun.no') : '—'}</Dato>
      <Dato termino={t('fichaRiesgo.campos.monitoreo')}>{valor('monitoring_sources')}</Dato>
      <Dato termino={t('fichaRiesgo.campos.residual')}>
        {texto(riesgo, 'residual_score')
          ? t('fichaRiesgo.puntaje', { p: texto(riesgo, 'residual_probability'), i: texto(riesgo, 'residual_impact'), s: texto(riesgo, 'residual_score') })
          : t('fichaRiesgo.sinResidual')}
      </Dato>
      {riesgo.state === 'closed' ? <Dato termino={t('fichaRiesgo.campos.cierre')}>{valor('close_reason')}</Dato> : null}
    </dl>
  )
}

// las revisiones, inmutables (risk_assessment es appendOnly y apiOnly): una se corrige con otra, así que no hay editar
function Revisiones({ consulta }: { consulta: ReturnType<typeof useTodos> }) {
  const { t } = useTranslation(NS)
  if (consulta.isPending) return <Cargando compacto />
  if (consulta.isError && !consulta.data) return <FalloDeLectura error={consulta.error} alReintentar={() => void consulta.refetch()} />
  const filas = consulta.data ?? []
  if (filas.length === 0) return <p className="text-sm text-sg-text-muted">{t('fichaRiesgo.revisiones.vacio')}</p>
  return (
    <div className="space-y-2">
      <p className="text-sg-caption text-sg-text-muted">{t('fichaRiesgo.revisiones.inmutables')}</p>
      <div className="overflow-x-auto">
        <Table aria-label={t('fichaRiesgo.pestanas.revisiones')}>
          <thead>
            <tr>
              {(['fecha', 'pi', 'nivel', 'tendencia', 'tipo', 'notas', 'quien'] as const).map((c) => (
                <Th key={c} scope="col">
                  {t(`fichaRiesgo.revisiones.columnas.${c}`)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => (
              <tr key={r.id}>
                <Td className="text-sm">{texto(r, 'assessment_date') ? diaPe(texto(r, 'assessment_date')) : '—'}</Td>
                <Td className="text-sm tabular-nums">
                  {t('fichaRiesgo.puntaje', { p: texto(r, 'probability'), i: texto(r, 'impact'), s: texto(r, 'score') })}
                </Td>
                <Td>
                  <NivelDeRiesgo valor={atributo(r, 'risk_level')} residual={atributo(r, 'residual') === true} />
                </Td>
                <Td className="text-sm">{texto(r, 'trend') || '—'}</Td>
                <Td className="text-sm">{atributo(r, 'residual') === true ? t('fichaRiesgo.revisiones.residual') : t('fichaRiesgo.revisiones.vigente')}</Td>
                <Td className="whitespace-pre-line text-sm">{texto(r, 'notes') || '—'}</Td>
                <Td className="text-sm">{texto(r, 'assessor_user_email') || '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  )
}

// el diálogo de «Nueva revisión»: la fecha (hoy en Lima por defecto, nunca futura), probabilidad e impacto de 1 a 5, si es residual
// (no en la primera) y el motivo. anticipa el puntaje y el nivel con los umbrales del proyecto; el servidor los confirma. un
// reintento tras un corte repite la Idempotency-Key: no deja dos revisiones
function NuevaRevision({
  riesgo,
  primera,
  alCerrar,
  alRegistrar
}: {
  riesgo: Registro
  primera: boolean
  alCerrar: () => void
  alRegistrar: (nivel: string | null) => void
}) {
  const { t } = useTranslation(NS)
  const releer = useReleer()
  const revisar = useRevisarRiesgo()
  const proyecto = useProyecto(texto(riesgo, 'project'))
  const hoy = hoyEnLima()
  const [fecha, setFecha] = useState(hoy)
  const [probabilidad, setProbabilidad] = useState(texto(riesgo, 'probability'))
  const [impacto, setImpacto] = useState(texto(riesgo, 'impact'))
  const [residual, setResidual] = useState(false)
  const [notas, setNotas] = useState('')
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const faltaMotivo = motivo.trim() === ''
  const faltaFecha = !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoy
  const completos = ESCALA.includes(probabilidad) && ESCALA.includes(impacto)
  const puntaje = completos ? Number(probabilidad) * Number(impacto) : null
  // la primera revisión sin responsable: 400 FIELD_REQUIRED sobre owner_user_id; se dice qué hacer
  const sinResponsable = revisar.error instanceof ApiError && revisar.error.violations.some((v) => v.field === 'owner_user_id')
  const confirmar = () => {
    setIntentado(true)
    if (faltaMotivo || faltaFecha || !completos) return
    revisar.mutate(
      { riesgo, fecha, probabilidad: Number(probabilidad), impacto: Number(impacto), residual: !primera && residual, notas, motivo: motivo.trim() },
      { onSuccess: ({ risk }) => alRegistrar(texto(risk, residual ? 'residual_level' : 'risk_level') || null) }
    )
  }
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-sg-h3 font-semibold">{t('fichaRiesgo.revision.nueva')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">
          {primera ? t('fichaRiesgo.revision.primera') : t('fichaRiesgo.revision.descripcion')}
        </DialogDescription>
        <div className="mt-4 space-y-3">
          <Campo etiqueta={t('fichaRiesgo.revision.fecha')} error={intentado && faltaFecha ? t('fichaRiesgo.revision.fechaFutura') : undefined}>
            {(p) => <Input {...p} type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />}
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta={t('fichaRiesgo.revision.probabilidad')}
              error={intentado && !ESCALA.includes(probabilidad) ? t('fichaRiesgo.revision.escala') : undefined}
            >
              {(p) => <SelectNativo {...p} value={probabilidad} onChange={(e) => setProbabilidad(e.target.value)} opciones={ESCALA} />}
            </Campo>
            <Campo etiqueta={t('fichaRiesgo.revision.impacto')} error={intentado && !ESCALA.includes(impacto) ? t('fichaRiesgo.revision.escala') : undefined}>
              {(p) => <SelectNativo {...p} value={impacto} onChange={(e) => setImpacto(e.target.value)} opciones={ESCALA} />}
            </Campo>
          </div>
          {puntaje !== null ? (
            <p role="status" className="text-sm">
              {t('fichaRiesgo.revision.anticipo', { s: puntaje, nivel: nivelDePuntaje(puntaje, umbralesDe(proyecto.data)) })}
            </p>
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" disabled={primera} checked={!primera && residual} onChange={(e) => setResidual(e.target.checked)} />
            <span>
              {t('fichaRiesgo.revision.residual')}
              <span className="block text-sg-caption text-sg-text-muted">
                {primera ? t('fichaRiesgo.revision.residualPrimera') : t('fichaRiesgo.revision.residualAyuda')}
              </span>
            </span>
          </label>
          <Campo etiqueta={t('fichaRiesgo.revision.notas')}>
            {(p) => <Textarea {...p} value={notas} maxLength={4000} onChange={(e) => setNotas(e.target.value)} />}
          </Campo>
          <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && faltaMotivo ? t('comun.motivoFalta') : undefined}>
            {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          {revisar.isError ? (
            <AvisoDeConflicto
              error={revisar.error}
              texto={sinResponsable ? t('fichaRiesgo.revision.sinResponsable') : undefined}
              releer={() => releer(['record', 'social_risk', riesgo.id])}
              alRecargar={() => revisar.reset()}
            />
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={confirmar} disabled={revisar.isPending} aria-busy={revisar.isPending}>
            {revisar.isPending ? t('fichaRiesgo.revision.registrando') : t('fichaRiesgo.revision.registrar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// lo que alimenta al riesgo y su contexto: las QCS y las alertas vinculadas (cada lectura con su propio estado: una que no se
// puede leer dice «No disponible», nunca una lista vacía), el incidente de origen y los grupos de interés
function LoAlimentan({ riesgo }: { riesgo: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyecto = texto(riesgo, 'project')
  const quejas = useTodos('grievance', { social_risk: riesgo.id }, can('grievance', 'READ'))
  const alertas = useTodos('early_warning', { social_risk: riesgo.id }, can('early_warning', 'READ'))
  const grupos = useRelacionados('social_risk', riesgo.id, 'social_risk_stakeholder')
  const lista = (objeto: string, consulta: ReturnType<typeof useTodos>, titulo: string) =>
    can(objeto, 'READ') ? (
      <div>
        <h3 className="font-medium">{titulo}</h3>
        {consulta.isPending ? (
          <Cargando compacto />
        ) : consulta.isError && !consulta.data ? (
          <FalloDeLectura error={consulta.error} alReintentar={() => void consulta.refetch()} />
        ) : (consulta.data ?? []).length === 0 ? (
          <p className="text-sg-text-muted">{t('fichaRiesgo.alimentan.ninguno')}</p>
        ) : (
          <ul>
            {(consulta.data ?? []).map((r) => (
              <li key={r.id}>
                <Link to={rutaDeFicha(objeto, r) ?? '#'} className="text-sg-primary-text underline">
                  {[texto(r, 'code'), texto(r, 'title') || texto(r, 'category')].filter(Boolean).join(' · ')}
                </Link>{' '}
                <EstadoChip objeto={objeto} estado={r.state} />
              </li>
            ))}
          </ul>
        )}
      </div>
    ) : null
  return (
    <aside aria-label={t('fichaRiesgo.alimentan.titulo')} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('fichaRiesgo.alimentan.titulo')}</h2>
      {lista('grievance', quejas, t('fichaRiesgo.alimentan.quejas'))}
      {lista('early_warning', alertas, t('fichaRiesgo.alimentan.alertas'))}
      {atributo(riesgo, 'origin_incident') ? (
        <p>
          {t('fichaRiesgo.alimentan.incidente')}: <RegistroVinculado objeto="incident" id={atributo<string>(riesgo, 'origin_incident')} />
        </p>
      ) : null}
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('fichaRiesgo.contexto.titulo')}</h2>
      {['locality', 'community', 'local_conflict', 'key_theme'].map((campo) =>
        atributo(riesgo, campo) ? (
          <p key={campo}>
            {t(`fichaRiesgo.contexto.${campo}`)}: <RegistroVinculado objeto={campo} id={atributo<string>(riesgo, campo)} />
          </p>
        ) : null
      )}
      <div>
        <h3 className="font-medium">{t('fichaRiesgo.contexto.grupos')}</h3>
        {grupos.isPending ? <Cargando compacto /> : null}
        {grupos.isError && !grupos.data ? <FalloDeLectura error={grupos.error} alReintentar={() => void grupos.refetch()} /> : null}
        {grupos.data ? (
          grupos.data.content.length === 0 ? (
            <p className="text-sg-text-muted">{t('fichaRiesgo.alimentan.ninguno')}</p>
          ) : (
            <ul>
              {grupos.data.content.map((g) => (
                <li key={g.id}>
                  <Link to={`/projects/${encodeURIComponent(proyecto)}/stakeholders/${encodeURIComponent(g.id)}`} className="text-sg-primary-text underline">
                    <NombreDelGrupo grupo={g} />
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </aside>
  )
}
