import { CaminoDelFlujo } from '../componentes/CaminoDelFlujo'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { useMigaDelRegistro } from '../componentes/Migas'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { PanelDeDecision } from '../componentes/PanelDeDecision'
import { PanelDeTrazabilidad } from '../componentes/PanelDeTrazabilidad'
import { RegistroVinculado, useRotuloDeRegistro } from '../componentes/RegistroVinculado'
import { rutaDeFicha } from '../datos/fichas'
import { useEvidenciasDe, useNombreDeEvidencia } from '../documentos/api'
import { useSiguienteAccion } from '../fichas/useSiguienteAccion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Table, Td, Textarea, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { useMensajeDeError } from '../componentes/errores'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta, Vacio, NoEsDeSusProyectos } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { Historia } from '../componentes/Historia'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { montoPe } from '../componentes/Monto'
import { nombreDe } from '../componentes/NombreDeActor'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { EvidenciasDelRegistro } from '../documentos/EvidenciasDelRegistro'
import { usePedir } from '../datos/http'
import { atributo, texto, useRegistro, useRelacionados, useTodos, usePuedeEditar, type Registro } from '../datos/registros'
import { diaPe, NS } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { CAMPOS_DEL_ACUERDO } from './AcuerdosPage'
import { opcion, rotuloDeOpcion } from '../datos/opciones'

// S33 · acuerdo o convenio (screens.md §7, WF-I): tipo, estado y vigencia (validity_status como insignia derivada; vencer no
// concluye el acuerdo), sus cláusulas con los compromisos que originan, las partes con su firma, la comunidad titular, la
// asamblea que autoriza, los predios y las evidencias. registrar la vigencia exige predios y titular en permisos de uso y
// servidumbres, y la asamblea en las autorizaciones (AgreementWriteGuard): el portal lo avisa antes y transition-checks lo
// comprueba en el diálogo. toda escritura sobre el acuerdo lleva motivo (requiresReason)
// los valores del enum agreement_type de model.json que AgreementWriteGuard revisa: si cambian allí, cambian aquí (el aviso
// previo dejaría de salir, pero transition-checks seguiría bloqueando)
const CON_PREDIOS = ['PERMISO DE USO DE TERRENO', 'SERVIDUMBRE']
const AUTORIZACION_DE_ASAMBLEA = 'AUTORIZACION DE ASAMBLEA'

export function FichaAcuerdoPage() {
  const { agreementId = '' } = useParams()
  const acuerdo = useRegistro('agreement', agreementId)
  // la clave es el acuerdo: al pasar a otro ya leído, nada de lo escrito en este (motivo, predio elegido, paneles) lo sigue
  // un 404 es un registro que no existe o que no es de sus proyectos (alcance por proyecto, spec 4.4 §3.6): no se distingue
  return (
    <Consulta consulta={acuerdo} noExiste={<NoEsDeSusProyectos />}>
      {(a) => <Ficha key={a.id} acuerdo={a} />}
    </Consulta>
  )
}

// el camino de WF-I sin sus excepciones (suspender, terminar, cancelar); un estado fuera de él se agrega
const CAMINO = ['draft', 'in_negotiation', 'active', 'concluded']

// la trazabilidad con los grupos fijos (revisión de UX, etapa 4): de dónde viene (la asamblea que lo autoriza y la comunidad),
// qué generó (los compromisos que lo implementan) y lo que lo sustenta (sus evidencias)
function Trazabilidad({ acuerdo }: { acuerdo: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const compromisos = useTodos('commitment', { agreement: acuerdo.id }, can('commitment', 'READ'))
  const evidencias = useEvidenciasDe('agreement', acuerdo.id)
  const nombreDeEvidencia = useNombreDeEvidencia()
  const rotulo = useRotuloDeRegistro()
  return (
    <PanelDeTrazabilidad
      deDondeViene={[
        {
          clave: 'asamblea',
          titulo: t('acuerdos.ficha.asamblea'),
          contenido: texto(acuerdo, 'assembly_engagement') ? <RegistroVinculado objeto="engagement" id={texto(acuerdo, 'assembly_engagement')} /> : null
        },
        {
          clave: 'comunidad',
          titulo: t('acuerdos.ficha.comunidad'),
          contenido: texto(acuerdo, 'community') ? <RegistroVinculado objeto="community" id={texto(acuerdo, 'community')} /> : null
        }
      ]}
      queGenero={[
        {
          clave: 'compromisos',
          titulo: t('acuerdos.ficha.compromisos'),
          contenido: compromisos.data?.length ? (
            <ul>
              {compromisos.data.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <EnlaceDeRegistro titulo={rotulo(c)} ruta={rutaDeFicha('commitment', c)} />
                  <EstadoChip objeto="commitment" estado={c.state} />
                </li>
              ))}
            </ul>
          ) : null
        }
      ]}
      loSustenta={[
        {
          clave: 'evidencias',
          titulo: t('acuerdos.ficha.evidencias'),
          contenido: evidencias.data?.content.length ? (
            <ul>
              {evidencias.data.content.map((e) => (
                <li key={e.id}>
                  <EnlaceDeRegistro titulo={nombreDeEvidencia(e)} ruta={rutaDeFicha('evidence', e)} />
                </li>
              ))}
            </ul>
          ) : null
        }
      ]}
    />
  )
}

function Ficha({ acuerdo }: { acuerdo: Registro }) {
  const { t } = useTranslation(NS)
  const proyecto = texto(acuerdo, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const edita = usePuedeEditar('agreement') && escribe
  const [editando, setEditando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const tipo = texto(acuerdo, 'agreement_type')
  // la anatomía de design-system.md §6.1 (revisión de UX, etapa 4): migas con el código, encabezado, camino del flujo, panel de
  // decisión con el vencimiento y la vigencia, y trazabilidad en tres grupos; las cláusulas, las partes y los predios siguen
  useMigaDelRegistro(texto(acuerdo, 'code') || texto(acuerdo, 'title'))
  const siguiente = useSiguienteAccion('agreement', acuerdo, ['activate', 'activate_from_draft', 'resume'])
  return (
    <article className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        antetitulo={[t('acuerdos.ficha.tipo'), texto(acuerdo, 'code'), rotuloDeOpcion(tipo)].filter(Boolean).join(' · ')}
        titulo={texto(acuerdo, 'title')}
        chips={
          <>
            <EstadoChip objeto="agreement" estado={acuerdo.state} />
            <SituacionDePlazo valor={atributo(acuerdo, 'validity_status')} vigencia />
          </>
        }
        primaria={
          <BotonesDeTransicion objeto="agreement" registro={acuerdo} proyecto={proyecto} comprobarAntes={['activate', 'activate_from_draft', 'resume']} />
        }
        secundarias={
          edita ? (
            <Button variant="secondary" size="sm" onClick={() => setEditando(true)}>
              {t('acuerdos.ficha.editar')}
            </Button>
          ) : undefined
        }
      />
      <CaminoDelFlujo objeto="agreement" estado={acuerdo.state} camino={CAMINO} />
      <PanelDeDecision
        objeto="agreement"
        estado={acuerdo.state}
        desde={texto(acuerdo, 'state_changed_at') || null}
        por={texto(acuerdo, 'state_changed_by') || null}
        siguiente={siguiente}
        responsable={texto(acuerdo, 'owner_user_email') || null}
        vencimiento={texto(acuerdo, 'expiry_date') || null}
        situacion={atributo(acuerdo, 'validity_status')}
        tipoDeSituacion="vigencia"
      />
      <section aria-label={t('acuerdos.ficha.vigencia')} className="flex flex-wrap gap-4 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
        <span>
          {t('acuerdos.ficha.firmado')}: {texto(acuerdo, 'signed_date') ? diaPe(texto(acuerdo, 'signed_date')) : t('acuerdos.ficha.sinFecha')}
        </span>
        <span>
          {t('acuerdos.ficha.desde')}: {texto(acuerdo, 'effective_date') ? diaPe(texto(acuerdo, 'effective_date')) : t('acuerdos.ficha.sinFecha')}
        </span>
        <span>
          {t('acuerdos.ficha.hasta')}: {texto(acuerdo, 'expiry_date') ? diaPe(texto(acuerdo, 'expiry_date')) : t('acuerdos.ficha.sinFecha')}
        </span>
        <span className="text-sg-text-muted">{t('acuerdos.ficha.vencerNoConcluye')}</span>
      </section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section aria-label={t('acuerdos.ficha.resumen')} className="space-y-1 text-sm">
            <h2 className="text-sg-h3 font-semibold">{t('acuerdos.ficha.resumen')}</h2>
            <p className="whitespace-pre-line">{texto(acuerdo, 'summary') || '—'}</p>
            <p>
              {t('acuerdos.ficha.monto')}: {montoPe(atributo(acuerdo, 'amount'), atributo(acuerdo, 'currency'))}
            </p>
          </section>
          <Clausulas acuerdo={acuerdo} escribe={escribe} />
          <EvidenciasDelRegistro objeto="agreement" registro={acuerdo} escribe={escribe} />
          <section aria-label={t('acuerdos.ficha.actividad')} className="space-y-2">
            <h2 className="text-sg-h3 font-semibold">{t('acuerdos.ficha.actividad')}</h2>
            <Historia objeto="agreement" id={acuerdo.id} vacio={t('acuerdos.ficha.sinActividad')} />
          </section>
        </div>
        <aside className="space-y-4">
          <Trazabilidad acuerdo={acuerdo} />
          <Partes acuerdo={acuerdo} escribe={escribe} />
          <Titulares acuerdo={acuerdo} />
          <Predios acuerdo={acuerdo} escribe={escribe} conPredios={CON_PREDIOS.includes(tipo)} />
        </aside>
      </div>
      <Drawer titulo={t('acuerdos.ficha.editarTitulo')} abierto={editando} alCerrar={() => setEditando(false)}>
        <Campo etiqueta={t('acuerdos.motivo')} ayuda={t('acuerdos.motivoAyuda')}>
          {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
        </Campo>
        <FormularioDeRegistro
          objeto="agreement"
          registro={acuerdo}
          campos={CAMPOS_DEL_ACUERDO}
          motivo={motivo.trim() || undefined}
          alGuardar={() => {
            setEditando(false)
            setMotivo('')
          }}
          alCancelar={() => setEditando(false)}
        />
      </Drawer>
    </article>
  )
}

function Clausulas({ acuerdo, escribe }: { acuerdo: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const clausulas = useTodos('agreement_clause', { agreement: acuerdo.id, sort: 'clause_number', dir: 'asc' })
  const compromisos = useTodos('commitment', { agreement: acuerdo.id })
  const [nueva, setNueva] = useState(false)
  const proyecto = texto(acuerdo, 'project')
  return (
    <section aria-label={t('acuerdos.ficha.clausulas')} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sg-h3 font-semibold">{t('acuerdos.ficha.clausulas')}</h2>
        {escribe && can('agreement_clause', 'CREATE') ? (
          <Button size="sm" onClick={() => setNueva(true)}>
            {t('acuerdos.ficha.nuevaClausula')}
          </Button>
        ) : null}
      </div>
      {clausulas.isPending || compromisos.isPending ? (
        <Cargando compacto />
      ) : clausulas.isError && !clausulas.data ? (
        <FalloDeLectura error={clausulas.error} alReintentar={() => void clausulas.refetch()} />
      ) : compromisos.isError && !compromisos.data ? (
        <FalloDeLectura error={compromisos.error} alReintentar={() => void compromisos.refetch()} />
      ) : clausulas.data.length === 0 ? (
        <Vacio titulo={t('acuerdos.ficha.sinClausulas')} />
      ) : (
        <Table aria-label={t('acuerdos.ficha.clausulas')}>
          <thead>
            <tr>
              {(['numero', 'texto', 'origina', 'compromisos'] as const).map((c) => (
                <Th key={c} scope="col">
                  {t(`acuerdos.ficha.columnasClausulas.${c}`)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clausulas.data.map((c) => {
              const deLaClausula = compromisos.data.filter((x) => atributo(x, 'agreement_clause') === c.id)
              const origina = atributo(c, 'creates_commitment') === true
              return (
                <tr key={c.id}>
                  <Td className="text-sm">{texto(c, 'clause_number')}</Td>
                  <Td className="whitespace-pre-line text-sm">{texto(c, 'clause_text')}</Td>
                  <Td className="text-sm">{origina ? t('comun.si') : t('comun.no')}</Td>
                  <Td className="text-sm">
                    {deLaClausula.length > 0 ? (
                      <ul>
                        {deLaClausula.map((x) => (
                          <li key={x.id}>
                            <Link
                              to={`/projects/${encodeURIComponent(proyecto)}/commitments/${encodeURIComponent(x.id)}`}
                              className="text-sg-primary-text underline"
                            >
                              {texto(x, 'code')} · {texto(x, 'title')}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : origina ? (
                      <span className="space-x-2">
                        <span className="text-sg-warning">{t('acuerdos.ficha.sinCompromiso')}</span>
                        {escribe && can('commitment', 'CREATE') ? (
                          <Link to={`/projects/${encodeURIComponent(proyecto)}/commitments/new`} className="text-sg-primary-text underline">
                            {t('acuerdos.ficha.registrarCompromiso')}
                          </Link>
                        ) : null}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
      <Drawer titulo={t('acuerdos.ficha.nuevaClausulaTitulo')} abierto={nueva} alCerrar={() => setNueva(false)}>
        <FormularioDeRegistro
          objeto="agreement_clause"
          fijos={{ agreement: acuerdo.id }}
          campos={['clause_number', 'clause_text', 'creates_commitment']}
          alGuardar={() => setNueva(false)}
          alCancelar={() => setNueva(false)}
        />
      </Drawer>
    </section>
  )
}

function Partes({ acuerdo, escribe }: { acuerdo: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const partes = useTodos('agreement_party', { agreement: acuerdo.id })
  const [nueva, setNueva] = useState(false)
  return (
    <section aria-label={t('acuerdos.ficha.partes')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t('acuerdos.ficha.partes')}</h2>
        {escribe && can('agreement_party', 'CREATE') ? (
          <Button size="sm" variant="secondary" onClick={() => setNueva(true)}>
            {t('acuerdos.ficha.nuevaParte')}
          </Button>
        ) : null}
      </div>
      {partes.isPending ? (
        <Cargando compacto />
      ) : partes.isError && !partes.data ? (
        <FalloDeLectura error={partes.error} alReintentar={() => void partes.refetch()} />
      ) : partes.data.length === 0 ? (
        <p className="text-sg-text-muted">{t('acuerdos.ficha.sinPartes')}</p>
      ) : (
        <ul className="space-y-1">
          {partes.data.map((p) => (
            <Parte key={p.id} parte={p} />
          ))}
        </ul>
      )}
      <Drawer titulo={t('acuerdos.ficha.nuevaParteTitulo')} abierto={nueva} alCerrar={() => setNueva(false)}>
        <FormularioDeRegistro
          objeto="agreement_party"
          fijos={{ agreement: acuerdo.id }}
          campos={['organization', 'person', 'signatory_role', 'signed']}
          alGuardar={() => setNueva(false)}
          alCancelar={() => setNueva(false)}
        />
      </Drawer>
    </section>
  )
}

// una parte: la organización por su nombre o la persona por el suyo, si quien mira lo lee («Persona registrada» si no)
function Parte({ parte }: { parte: Registro }) {
  const { t } = useTranslation(NS)
  const objeto = atributo<string>(parte, 'person') ? 'person' : 'organization'
  const actor = useRegistro(objeto, atributo<string>(parte, objeto))
  const nombre = actor.isPending ? '…' : nombreDe(actor.data, objeto, t('comun.personaRegistrada')) || t('comun.personaRegistrada')
  return (
    <li>
      {nombre}
      {texto(parte, 'signatory_role') ? ` · ${texto(parte, 'signatory_role')}` : ''} ·{' '}
      {atributo(parte, 'signed') === true ? t('acuerdos.ficha.firmo') : t('acuerdos.ficha.noFirmo')}
    </li>
  )
}

function Titulares({ acuerdo }: { acuerdo: Registro }) {
  const { t } = useTranslation(NS)
  const proyecto = texto(acuerdo, 'project')
  const comunidad = useRegistro('community', atributo<string>(acuerdo, 'community'))
  const asamblea = useRegistro('engagement', atributo<string>(acuerdo, 'assembly_engagement'))
  const autorizacion = texto(acuerdo, 'agreement_type') === AUTORIZACION_DE_ASAMBLEA
  return (
    <section className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
      <h2 className="font-semibold">{t('acuerdos.ficha.comunidad')}</h2>
      {comunidad.data ? (
        <Link
          to={`/territory/communities/${encodeURIComponent(comunidad.data.id)}?project=${encodeURIComponent(proyecto)}`}
          className="text-sg-primary-text underline"
        >
          {texto(comunidad.data, 'name')}
        </Link>
      ) : atributo(acuerdo, 'community') ? (
        comunidad.isError ? (
          <FalloDeLectura error={comunidad.error} alReintentar={() => void comunidad.refetch()} />
        ) : (
          <Cargando compacto />
        )
      ) : (
        <p className="text-sg-text-muted">{t('acuerdos.ficha.sinComunidad')}</p>
      )}
      <h2 className="font-semibold">{t('acuerdos.ficha.asamblea')}</h2>
      {asamblea.data ? (
        <Link to={`/projects/${encodeURIComponent(proyecto)}/engagements/${encodeURIComponent(asamblea.data.id)}`} className="text-sg-primary-text underline">
          {texto(asamblea.data, 'title')} · {opcion(asamblea.data, 'engagement_type')}
        </Link>
      ) : atributo(acuerdo, 'assembly_engagement') ? (
        asamblea.isError ? (
          <FalloDeLectura error={asamblea.error} alReintentar={() => void asamblea.refetch()} />
        ) : (
          <Cargando compacto />
        )
      ) : (
        <p className="text-sg-text-muted">{t('acuerdos.ficha.sinAsamblea')}</p>
      )}
      {autorizacion && !atributo(acuerdo, 'assembly_engagement') ? <Alert tone="warning">{t('acuerdos.ficha.asambleaRequerida')}</Alert> : null}
    </section>
  )
}

function Predios({ acuerdo, escribe, conPredios }: { acuerdo: Registro; escribe: boolean; conPredios: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const pedir = usePedir()
  const cliente = useQueryClient()
  const mensaje = useMensajeDeError()
  const predios = useRelacionados('agreement', acuerdo.id, 'agreement_land_parcel')
  const [elegido, setElegido] = useState<Registro | null>(null)
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  // el vínculo escribe en el acuerdo (requiresReason): lleva motivo, como cualquier escritura sobre él (WAS-ADR-0041)
  const vincular = useMutation({
    mutationFn: ({ predio, motivo: razon }: { predio: string; motivo: string }) =>
      pedir(`/objects/agreement/records/${acuerdo.id}/related/agreement_land_parcel`, { json: { otherId: predio }, motivo: razon }),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: ['related', 'agreement', acuerdo.id] })
  })
  const confirmar = () => {
    setIntentado(true)
    if (!elegido || !motivo.trim()) return
    vincular.mutate(
      { predio: elegido.id, motivo: motivo.trim() },
      {
        onSuccess: () => {
          setElegido(null)
          setMotivo('')
          setIntentado(false)
        }
      }
    )
  }
  const lista = predios.data?.content ?? []
  // un predio sin código se nombra con un texto neutro, nunca con su identificador
  const rotulo = (p: Registro) => texto(p, 'code') || t('acuerdos.ficha.predioSinCodigo')
  return (
    <section aria-label={t('acuerdos.ficha.predios')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
      <h2 className="font-semibold">{t('acuerdos.ficha.predios')}</h2>
      {predios.isPending ? (
        <Cargando compacto />
      ) : predios.isError && !predios.data ? (
        <FalloDeLectura error={predios.error} alReintentar={() => void predios.refetch()} />
      ) : lista.length === 0 ? (
        <p className="text-sg-text-muted">{t('acuerdos.ficha.sinPredios')}</p>
      ) : (
        <ul>
          {lista.map((p) => (
            <li key={p.id}>{rotulo(p)}</li>
          ))}
        </ul>
      )}
      {conPredios && predios.isSuccess && lista.length === 0 ? <Alert tone="warning">{t('acuerdos.ficha.prediosRequeridos')}</Alert> : null}
      {escribe && can('agreement', 'UPDATE') && can('land_parcel', 'READ') ? (
        <details>
          <summary className="cursor-pointer text-sg-primary-text">{t('acuerdos.ficha.vincularPredio')}</summary>
          <div className="mt-2 space-y-2">
            {elegido ? (
              <p>
                {rotulo(elegido)}{' '}
                <button type="button" className="text-sg-caption text-sg-primary-text underline" onClick={() => setElegido(null)}>
                  {t('comun.quitar')}
                </button>
              </p>
            ) : (
              <BuscadorDeRegistro
                objeto="land_parcel"
                etiqueta={t('acuerdos.ficha.buscarPredio')}
                rotulo={rotulo}
                alElegir={(r) => {
                  // el aviso del vínculo anterior no se queda junto al predio nuevo
                  vincular.reset()
                  setElegido(r)
                }}
              />
            )}
            <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && !motivo.trim() ? t('comun.motivoFalta') : undefined}>
              {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
            </Campo>
            {vincular.isError ? <Alert tone="danger">{mensaje(vincular.error)}</Alert> : null}
            {vincular.isSuccess ? (
              <p role="status" className="text-sg-success">
                {t('acuerdos.ficha.vinculado')}
              </p>
            ) : null}
            <Button size="sm" onClick={confirmar} disabled={!elegido || vincular.isPending} aria-busy={vincular.isPending}>
              {t('acuerdos.ficha.vincular')}
            </Button>
          </div>
        </details>
      ) : null}
    </section>
  )
}
