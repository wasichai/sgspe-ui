import { EnlaceConRastro } from '../contexto/Rastro'
import { rutaEnElMapa, VerEnElMapa } from '../componentes/VerEnElMapa'
import { useRutaDeVistaPrevia } from '../componentes/VistaPrevia'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { useMigaDelRegistro } from '../componentes/Migas'
import { CabeceraDeFicha } from '../componentes/CabeceraDeFicha'
import { CamposPlegables, type CampoDeFicha } from '../componentes/CamposPlegables'
import { Seccion } from '../componentes/Seccion'
import { PanelDeDecision } from '../componentes/PanelDeDecision'
import { PanelDeTrazabilidad } from '../componentes/PanelDeTrazabilidad'
import { PestanasDeFicha } from '../componentes/PestanasDeFicha'
import { rutaDeFicha } from '../datos/fichas'
import { useEvidenciasDe, useNombreDeEvidencia } from '../documentos/api'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { Campo, SelectNativo } from '../componentes/Campo'
import { CampoFecha } from '../componentes/CampoFecha'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { Historia } from '../componentes/Historia'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { NombreDelGrupo } from '../componentes/NombreDeActor'
import { RegistrosSimples } from '../componentes/RegistrosSimples'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyecto } from '../contexto/proyectos'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { hoyEnLima } from '../datos/fechas'
import { atributo, texto, usePuedeEditar, useRegistro, useRelacionados, useTodos, type Registro } from '../datos/registros'
import { diaPe, NS } from '../i18n'
import { useRevisarRiesgo } from './comandos'
import { Impactos } from './ImpactosPage'
import { NivelDeRiesgo } from './NivelDeRiesgo'
import { nivelDePuntaje, umbralesDe } from './niveles'
import { opcion, rotuloDeOpcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'
import { Persona } from '../componentes/Persona'
import { CampoDeMotivo, useMotivo } from '../componentes/Motivo'
import { EditarSeccion } from '../componentes/EditarSeccion'

// S40 · ficha de riesgo (screens.md §9, flujos 14 y 15): el nivel vigente, cómo llegó ahí y qué se hace para bajarlo. «Nueva
// revisión» es el endpoint de revisiones (api.md §4.7): las revisiones son inmutables y una se corrige con otra; la primera aplica
// assess (transición de comando, sin botón). las demás transiciones de WF-F van con su motivo (social_risk es requiresReason) y se
// comprueban antes (MEASURE_OWNER_REQUIRED, RESIDUAL_ASSESSMENT_REQUIRED, la decisión de tratamiento y el motivo de cierre). las
// medidas de mitigación, los impactos potenciales y las evidencias viven en la ficha; a la derecha, lo que alimenta al riesgo (QCS y
// alertas: una QCS confidencial que la cuenta no lee simplemente no llega, security.md §9.6) y su contexto
// el camino de WF-F sin sus cierres anticipados; un estado fuera de él se agrega
const CAMINO = ['identified', 'assessed', 'mitigating', 'monitoring', 'closed']
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
  const motivo = useMotivo()
  const [hecha, setHecha] = useState<string | null>(null)
  const revisiones = useTodos('risk_assessment', { social_risk: riesgo.id, sort: 'assessment_date', dir: 'desc' })
  const cerrar = () => {
    setEditando(false)
    motivo.limpiar()
  }
  const cadencia = texto(riesgo, 'review_every_days')
  // la anatomía de design-system.md §6.1 (revisión de UX, etapa 4): migas con el código, encabezado, camino del flujo, panel de
  // decisión (con la próxima revisión como vencimiento), pestañas con conteo y trazabilidad en tres grupos
  useMigaDelRegistro(texto(riesgo, 'code') || texto(riesgo, 'title'))
  const siguiente = useSiguienteAccion('social_risk', riesgo, COMPROBAR)
  const medidas = useTodos('mitigation_measure', { social_risk: riesgo.id })
  const evidencias = useEvidenciasDe('social_risk', riesgo.id)
  return (
    <article className="space-y-4">
      <CabeceraDeFicha
        antetitulo={[t('fichaRiesgo.tipo'), texto(riesgo, 'code'), opcion(riesgo, 'category')].filter(Boolean).join(' · ')}
        titulo={texto(riesgo, 'title')}
        tituloDelDocumento={[texto(riesgo, 'code'), texto(riesgo, 'title')].filter(Boolean).join(' ')}
        chips={
          <>
            {/* los niveles con su rótulo y el puntaje que dice qué multiplica (U-28 del rediseño de UX) */}
            <span className="inline-flex items-center gap-1">
              <span className="text-sg-text-secondary">{t('fichaRiesgo.inherente')}</span>
              <NivelDeRiesgo valor={atributo(riesgo, 'risk_level')} />
            </span>
            {texto(riesgo, 'score') ? (
              <span className="tabular-nums">
                {t('fichaRiesgo.puntajeExplicado', { p: texto(riesgo, 'probability'), i: texto(riesgo, 'impact'), s: texto(riesgo, 'score') })}
              </span>
            ) : null}
            {atributo(riesgo, 'residual_level') ? (
              <span className="inline-flex items-center gap-1">
                <span className="text-sg-text-secondary">{t('fichaRiesgo.residual')}</span>
                <NivelDeRiesgo valor={atributo(riesgo, 'residual_level')} residual />
              </span>
            ) : null}
            <span className="text-sg-text-secondary">
              {cadencia ? t('fichaRiesgo.cadencia', { n: cadencia, count: Number(cadencia) }) : t('fichaRiesgo.cadenciaDelProyecto')}
            </span>
          </>
        }
        objeto="social_risk"
        registro={riesgo}
        proyecto={proyecto}
        comprobarAntes={COMPROBAR}
        falta={siguiente?.falta}
        faltaCampo={siguiente?.campo}
        // la siguiente acción del flujo es la primaria (DD-02 del rediseño de UX); sin una del camino, la nueva revisión
        primariaPropia={
          revisa ? (
            <Button
              size="sm"
              onClick={() => {
                setHecha(null)
                setRevisando(true)
              }}
            >
              {t('fichaRiesgo.revision.nueva')}
            </Button>
          ) : undefined
        }
        secundarias={[
          ...(edita
            ? [
                {
                  clave: 'editar',
                  nodo: (
                    <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                      {t('fichaRiesgo.editar')}
                    </Button>
                  )
                }
              ]
            : []),
          // el compromiso que atiende el riesgo (revisión de UX, etapa 5); la medida se crea en su pestaña
          ...(escribe && can('commitment', 'CREATE')
            ? [
                {
                  clave: 'compromiso',
                  nodo: (
                    <Button asChild size="sm" variant="secondary">
                      <Link to={`/projects/${encodeURIComponent(proyecto)}/commitments/new?social_risk=${encodeURIComponent(riesgo.id)}`}>
                        {t('paginas.relacionados.compromiso')}
                      </Link>
                    </Button>
                  )
                }
              ]
            : []),
          ...(rutaEnElMapa('social_risk', riesgo) ? [{ clave: 'mapa', nodo: <VerEnElMapa objeto="social_risk" registro={riesgo} /> }] : [])
        ]}
      />
      {hecha ? (
        <p role="status" className="text-sm text-sg-success">
          {hecha}
        </p>
      ) : null}
      <PanelDeDecision
        camino={CAMINO}
        objeto="social_risk"
        proyecto={proyecto}
        estado={riesgo.state}
        desde={texto(riesgo, 'state_changed_at') || null}
        por={texto(riesgo, 'state_changed_by') || null}
        siguiente={siguiente}
        responsable={texto(riesgo, 'owner_user_email')}
        vencimiento={texto(riesgo, 'next_review_date')}
        situacion={atributo(riesgo, 'review_status')}
        tipoDeSituacion="revision"
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <PestanasDeFicha
          etiqueta={texto(riesgo, 'title')}
          pestanas={[
            { id: 'resumen', etiqueta: t('fichaRiesgo.pestanas.resumen'), render: () => <Resumen riesgo={riesgo} /> },
            {
              id: 'revisiones',
              etiqueta: t('fichaRiesgo.pestanas.revisiones'),
              conteo: revisiones.data?.length ?? null,
              render: () => (
                <div className="pt-3">
                  <Revisiones consulta={revisiones} />
                </div>
              )
            },
            {
              id: 'medidas',
              etiqueta: t('fichaRiesgo.pestanas.medidas'),
              conteo: medidas.data?.length ?? null,
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
              etiqueta: t('fichaRiesgo.pestanas.impactos'),
              render: () => (
                <div className="pt-3">
                  <Impactos proyecto={proyecto} riesgo={riesgo.id} />
                </div>
              )
            },
            {
              id: 'evidencias',
              etiqueta: t('fichaRiesgo.pestanas.evidencias'),
              conteo: evidencias.data?.totalElements ?? null,
              render: () => <EvidenciasDelRegistro objeto="social_risk" registro={riesgo} escribe={escribe} />
            },
            {
              id: 'actividad',
              etiqueta: t('fichaRiesgo.pestanas.actividad'),
              render: () => (
                <div className="pt-3">
                  <Historia objeto="social_risk" id={riesgo.id} vacio={t('fichaRiesgo.sinActividad')} />
                </div>
              )
            }
          ]}
        />
        <Trazabilidad riesgo={riesgo} medidas={medidas.data} evidencias={evidencias.data?.content ?? []} />
      </div>
      {revisando ? (
        <NuevaRevision
          riesgo={riesgo}
          primera={revisiones.isSuccess && revisiones.data.length === 0}
          alCerrar={() => setRevisando(false)}
          alRegistrar={(nivel) => {
            setRevisando(false)
            setHecha(
              nivel
                ? t('fichaRiesgo.revision.hecha', { nivel: t(`tableroRiesgos.niveles.${nivel}`, { defaultValue: rotuloDeOpcion(nivel) }) })
                : t('fichaRiesgo.revision.hechaSinNivel')
            )
          }}
        />
      ) : null}
      <Drawer titulo={t('fichaRiesgo.editar')} abierto={editando} alCerrar={cerrar}>
        <CampoDeMotivo motivo={motivo} etiqueta={t('comun.motivoObligatorio')} ayuda={t('fichaRiesgo.motivoAyuda')} />
        <p className="text-sg-caption text-sg-text-muted">{t('fichaRiesgo.cadenciaAyuda')}</p>
        {editando ? (
          <FormularioDeRegistro
            objeto="social_risk"
            registro={riesgo}
            campos={EDITABLES}
            motivo={motivo.recortado}
            antesDeEnviar={motivo.exigir}
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
    { id: 'responsable', encabezado: t('fichaRiesgo.medidas.columnas.responsable'), celda: (m: Registro) => <Persona correo={texto(m, 'owner_user_email')} /> },
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

// el resumen por tema (DD-06 y U-26 del rediseño de UX): de dónde nace y qué afecta, cómo se trata y lo que queda tras las
// medidas; cada sección pliega sus campos sin dato
function Resumen({ riesgo }: { riesgo: Registro }) {
  const { t } = useTranslation(NS)
  const adecuados = atributo(riesgo, 'controls_adequate')
  const campo = (clave: string, valor: ReactNode, ancho = false): CampoDeFicha => ({ clave, termino: t(`fichaRiesgo.campos.${clave}`), valor, ancho })
  // cada sección con su «Editar», con los campos que muestra (tercera pasada de UX, 2.10)
  const editar = (seccion: string, campos: readonly string[]) => (
    <EditarSeccion
      objeto="social_risk"
      registro={riesgo}
      proyecto={texto(riesgo, 'project') || undefined}
      seccion={t(`fichaRiesgo.secciones.${seccion}`)}
      campos={campos}
      permitidos={EDITABLES}
    />
  )
  return (
    <div className="space-y-4 pt-3">
      <Seccion titulo={t('fichaRiesgo.secciones.origen')} acciones={editar('origen', ['risk_source', 'impact_type', 'impact_nature'])}>
        <CamposPlegables
          campos={[
            campo('fuente', texto(riesgo, 'risk_source'), true),
            campo('tipoDeImpacto', opcion(riesgo, 'impact_type')),
            campo('naturaleza', opcion(riesgo, 'impact_nature'))
          ]}
        />
      </Seccion>
      <Seccion
        titulo={t('fichaRiesgo.secciones.tratamiento')}
        acciones={editar('tratamiento', ['treatment_decision', 'treatment_rationale', 'current_controls', 'controls_adequate', 'monitoring_sources'])}
      >
        <CamposPlegables
          campos={[
            campo('tratamiento', opcion(riesgo, 'treatment_decision')),
            campo('razon', texto(riesgo, 'treatment_rationale'), true),
            campo('controles', texto(riesgo, 'current_controls'), true),
            campo('adecuados', adecuados === true ? t('comun.si') : adecuados === false ? t('comun.no') : null),
            campo('monitoreo', texto(riesgo, 'monitoring_sources'), true)
          ]}
        />
      </Seccion>
      <Seccion titulo={t('fichaRiesgo.secciones.residual')}>
        <CamposPlegables
          campos={[
            campo(
              'residual',
              texto(riesgo, 'residual_score')
                ? t('fichaRiesgo.puntajeExplicado', {
                    p: texto(riesgo, 'residual_probability'),
                    i: texto(riesgo, 'residual_impact'),
                    s: texto(riesgo, 'residual_score')
                  })
                : t('fichaRiesgo.sinResidual')
            ),
            ...(riesgo.state === 'closed' ? [campo('cierre', opcion(riesgo, 'close_reason'), true)] : [])
          ]}
        />
      </Seccion>
    </div>
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
                <Td className="text-sm">
                  <Dia valor={texto(r, 'assessment_date')} />
                </Td>
                <Td className="text-sm tabular-nums">
                  {t('fichaRiesgo.puntaje', { p: texto(r, 'probability'), i: texto(r, 'impact'), s: texto(r, 'score') })}
                </Td>
                <Td>
                  <NivelDeRiesgo valor={atributo(r, 'risk_level')} residual={atributo(r, 'residual') === true} />
                </Td>
                <Td className="text-sm">{opcion(r, 'trend') || '—'}</Td>
                <Td className="text-sm">{atributo(r, 'residual') === true ? t('fichaRiesgo.revisiones.residual') : t('fichaRiesgo.revisiones.vigente')}</Td>
                <Td className="whitespace-pre-line text-sm">{texto(r, 'notes') || '—'}</Td>
                <Td className="text-sm">
                  <Persona correo={texto(r, 'assessor_user_email')} />
                </Td>
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
      // el nivel que se anuncia es el de lo que se mandó (!primera && residual), no el de la casilla
      { onSuccess: ({ risk }, enviada) => alRegistrar(texto(risk, enviada.residual ? 'residual_level' : 'risk_level') || null) }
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
          <CampoFecha
            etiqueta={t('fichaRiesgo.revision.fecha')}
            requerido
            max={hoy}
            valor={fecha || null}
            alCambiar={(v) => setFecha(v ?? '')}
            error={intentado && faltaFecha ? t('fichaRiesgo.revision.fechaFutura') : undefined}
          />
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
              {t('fichaRiesgo.revision.anticipo', { s: puntaje, nivel: t(`tableroRiesgos.niveles.${nivelDePuntaje(puntaje, umbralesDe(proyecto.data))}`) })}
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
// la trazabilidad con los grupos fijos (revisión de UX, etapa 4): «Lo alimentan» pasa a «De dónde viene» (las quejas, las alertas,
// el incidente de origen y su contexto: lugar, conflicto, tema y grupos), «Qué generó» suma sus medidas de mitigación (cuántas
// y cuántas atrasadas) y los compromisos que lo atienden, y «Lo sustenta», sus evidencias
function Trazabilidad({ riesgo, medidas, evidencias }: { riesgo: Registro; medidas: Registro[] | undefined; evidencias: Registro[] }) {
  // una evidencia que lo sustenta se abre en la vista previa, sobre la ficha (revisión de UX, etapa 6)
  const previa = useRutaDeVistaPrevia()
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyecto = texto(riesgo, 'project')
  const quejas = useTodos('grievance', { social_risk: riesgo.id }, can('grievance', 'READ'))
  const alertas = useTodos('early_warning', { social_risk: riesgo.id }, can('early_warning', 'READ'))
  const compromisos = useTodos('commitment', { social_risk: riesgo.id }, can('commitment', 'READ'))
  const grupos = useRelacionados('social_risk', riesgo.id, 'social_risk_stakeholder')
  const nombreDeEvidencia = useNombreDeEvidencia()
  const lista = (objeto: string, consulta: ReturnType<typeof useTodos>) =>
    !can(objeto, 'READ') ? null : consulta.isPending ? (
      <Cargando compacto />
    ) : consulta.isError && !consulta.data ? (
      <FalloDeLectura error={consulta.error} alReintentar={() => void consulta.refetch()} />
    ) : (consulta.data ?? []).length === 0 ? null : (
      <ul>
        {(consulta.data ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2">
            <EnlaceDeRegistro
              codigo={texto(r, 'code')}
              titulo={texto(r, 'title') || opcion(r, 'category')}
              ruta={rutaDeFicha(objeto, r)}
              codigoEnElEnlace={!texto(r, 'title')}
            />
            <EstadoChip objeto={objeto} estado={r.state} />
          </li>
        ))}
      </ul>
    )
  const atrasadas = (medidas ?? []).filter((m) => estaAtrasada(m)).length
  return (
    <PanelDeTrazabilidad
      deDondeViene={[
        { clave: 'quejas', titulo: t('fichaRiesgo.alimentan.quejas'), contenido: lista('grievance', quejas) },
        { clave: 'alertas', titulo: t('fichaRiesgo.alimentan.alertas'), contenido: lista('early_warning', alertas) },
        {
          clave: 'incidente',
          titulo: t('fichaRiesgo.alimentan.incidente'),
          contenido: atributo(riesgo, 'origin_incident') ? <RegistroVinculado objeto="incident" id={atributo<string>(riesgo, 'origin_incident')} /> : null
        },
        ...['locality', 'community', 'local_conflict', 'key_theme'].map((campo) => ({
          clave: campo,
          titulo: t(`fichaRiesgo.contexto.${campo}`),
          contenido: atributo(riesgo, campo) ? <RegistroVinculado objeto={campo} id={atributo<string>(riesgo, campo)} /> : null
        })),
        {
          clave: 'grupos',
          titulo: t('fichaRiesgo.contexto.grupos'),
          contenido: grupos.data?.content.length ? (
            <ul>
              {grupos.data.content.map((g) => (
                <li key={g.id}>
                  <EnlaceConRastro
                    to={`/projects/${encodeURIComponent(proyecto)}/stakeholders/${encodeURIComponent(g.id)}`}
                    className="text-sg-primary-text underline"
                  >
                    <NombreDelGrupo grupo={g} />
                  </EnlaceConRastro>
                </li>
              ))}
            </ul>
          ) : grupos.isError && !grupos.data ? (
            <FalloDeLectura error={grupos.error} alReintentar={() => void grupos.refetch()} />
          ) : null
        }
      ]}
      queGenero={[
        {
          clave: 'medidas',
          titulo: t('fichaRiesgo.medidas.titulo'),
          contenido: medidas?.length ? (
            <p>
              {t('fichaRiesgo.trazabilidad.medidas', { count: medidas.length })}
              {atrasadas ? <span className="font-medium text-sg-danger"> · {t('fichaRiesgo.trazabilidad.atrasadas', { count: atrasadas })}</span> : null}
            </p>
          ) : null
        },
        { clave: 'compromisos', titulo: t('fichaRiesgo.trazabilidad.compromisos'), contenido: lista('commitment', compromisos) }
      ]}
      loSustenta={[
        {
          clave: 'evidencias',
          titulo: t('fichaRiesgo.pestanas.evidencias'),
          contenido: evidencias.length ? (
            <ul>
              {evidencias.map((e) => (
                <li key={e.id}>
                  <EnlaceDeRegistro titulo={nombreDeEvidencia(e)} ruta={previa('evidence', e.id)} />
                </li>
              ))}
            </ul>
          ) : null
        }
      ]}
    />
  )
}
