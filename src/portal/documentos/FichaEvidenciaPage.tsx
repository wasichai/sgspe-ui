import { useMigaDelRegistro } from '../componentes/Migas'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { ApiError, useAuth } from '@wasichai/core'
import { Alert, Button, Input, Textarea } from '@wasichai/ui'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { z } from 'zod'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, SelectNativo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { useErroresDeCampo, useMensajeDeError } from '../componentes/errores'
import { Cargando, Consulta, Restringido, NoEsDeSusProyectos } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { descriptorDe, tamanoPe } from '../datos/archivos'
import { useComando } from '../datos/comandos'
import { rutaDeFicha, rutaParaAbrir } from '../datos/fichas'
import { usePedir } from '../datos/http'
import { atributo, campoDe, consulta, texto, useDefinicion, useRegistro, useRegistros, type Pagina, type Registro } from '../datos/registros'
import { diaPe, fechaYHoraPe, NS } from '../i18n'
import { AccionesDeIa, casosDeEvidencia } from '../ia/AccionesDeIa'
import { MOTIVO_EN_TODAS } from '../transiciones/reglas'
import {
  CLASIFICACIONES_RESTRINGIDAS,
  DESTINOS_DE_EVIDENCIA,
  useDescargarEvidencia,
  useNombreDeArchivo,
  useNombreDeEvidencia,
  usePuedeDescargar,
  useVincularEvidencia
} from './api'
import { FormularioDeEvidencia } from './FormularioDeEvidencia'
import { opcion } from '../datos/opciones'

// S46 · ficha de evidencia (screens.md §11): qué sustenta, quién puede descargarla y si puede salir en un reporte externo.
// la descarga y la vista previa solo con READ y, para CONFIDENCIAL y DATOS PERSONALES, DOWNLOAD_RESTRICTED (RF-DOC-003); sin
// ella, los datos sin el archivo. el archivo no cambia: una corrección es una versión nueva con `replaces` (RF-DOC-001). los
// datos descriptivos y la clasificación se cambian con PATCH /api/sgspe/evidence/{id} (IM; motivo si cambia la clasificación)
export function FichaEvidenciaPage() {
  const { documentId = '' } = useParams()
  const evidencia = useRegistro('evidence', documentId)
  // un 404 es un registro que no existe o que no es de sus proyectos (alcance por proyecto, spec 4.4 §3.6): no se distingue
  return (
    <Consulta consulta={evidencia} noExiste={<NoEsDeSusProyectos />}>
      {(e) => <Ficha evidencia={e} />}
    </Consulta>
  )
}

function Ficha({ evidencia }: { evidencia: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyecto = atributo<string>(evidencia, 'project')
  const escribe = useEscribeEnProyecto(proyecto) && can('evidence', 'UPDATE')
  const puedeDescargar = usePuedeDescargar()(evidencia)
  const nombreDeEvidencia = useNombreDeEvidencia()
  // P59: el nombre del archivo solo para quien lo descarga
  const nombreDeArchivo = useNombreDeArchivo()(evidencia)
  const descargar = useDescargarEvidencia()
  const mensaje = useMensajeDeError()
  const descriptor = descriptorDe(atributo(evidencia, 'file'))
  const [editando, setEditando] = useState(false)
  const [versionando, setVersionando] = useState(false)
  const capturada = atributo<string>(evidencia, 'captured_at')
  const ubicacion = evidencia.geometries?.location
  const sinConsentimiento = atributo(evidencia, 'people_identifiable') === true && atributo(evidencia, 'photo_consent_given') !== true
  const biblioteca = proyecto ? `/projects/${encodeURIComponent(proyecto)}/documents` : '/documents'
  // el encabezado común y el nombre en las migas del proyecto (revisión de UX, etapa 4); la evidencia no tiene workflow, y lo que
  // sustenta es su trazabilidad
  useMigaDelRegistro(nombreDeEvidencia(evidencia))
  return (
    <article className="mx-auto max-w-[1440px] space-y-4">
      {proyecto ? null : (
        <Link to={biblioteca} className="text-sm text-sg-primary-text underline">
          {t('documentos.ficha.volver')}
        </Link>
      )}
      <EncabezadoDePagina
        antetitulo={[t('documentos.ficha.tipo'), opcion(evidencia, 'evidence_type')].filter(Boolean).join(' · ')}
        titulo={nombreDeEvidencia(evidencia)}
        chips={
          'classification' in evidencia.attributes ? <span className="text-sg-text-secondary">{opcion(evidencia, 'classification')}</span> : <Restringido />
        }
        primaria={
          puedeDescargar ? (
            <Button size="sm" onClick={() => descargar.mutate(evidencia)} disabled={descargar.isPending} aria-busy={descargar.isPending}>
              {descargar.isPending ? t('documentos.ficha.descargando') : t('documentos.ficha.descargar')}
            </Button>
          ) : undefined
        }
        secundarias={
          escribe ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditando(true)}>
                {t('documentos.ficha.editar')}
              </Button>
              {can('evidence', 'CREATE') ? (
                <Button size="sm" variant="secondary" onClick={() => setVersionando(true)}>
                  {t('documentos.ficha.versionNueva')}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      />
      {descargar.isError ? <Alert tone="danger">{mensaje(descargar.error)}</Alert> : null}
      {!puedeDescargar ? <Alert tone="notice">{t('documentos.ficha.noDescarga')}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {proyecto ? (
            <AccionesDeIa
              objeto="evidence"
              registro={evidencia}
              proyecto={proyecto}
              rotulo={nombreDeEvidencia(evidencia)}
              casos={casosDeEvidencia(evidencia, puedeDescargar)}
            />
          ) : null}
          {puedeDescargar && descriptor?.contentType.startsWith('image/') ? <VistaPrevia evidencia={evidencia} difuminada={sinConsentimiento} /> : null}
          <Sustenta evidencia={evidencia} escribe={escribe} />
          <Versiones evidencia={evidencia} />
        </div>
        <aside aria-label={t('documentos.ficha.privacidad')} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
          <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('documentos.ficha.privacidad')}</h2>
          <dl className="space-y-1">
            <Dato termino={t('documentos.ficha.personas')} valor={atributo(evidencia, 'people_identifiable') === true ? t('comun.si') : t('comun.no')} />
            {atributo(evidencia, 'people_identifiable') === true ? (
              <Dato
                termino={t('documentos.ficha.consentimiento')}
                valor={atributo(evidencia, 'photo_consent_given') === true ? t('comun.si') : t('comun.no')}
              />
            ) : null}
          </dl>
          <p>{sinConsentimiento ? t('documentos.ficha.externoNo') : t('documentos.ficha.externoSi')}</p>
          <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('documentos.ficha.archivo')}</h2>
          <dl className="space-y-1">
            <Dato termino={t('documentos.ficha.archivo')} valor={nombreDeArchivo ?? '—'} />
            <Dato termino={t('documentos.ficha.tipoDeArchivo')} valor={descriptor?.contentType ?? '—'} />
            <Dato termino={t('documentos.ficha.tamano')} valor={descriptor ? tamanoPe(descriptor.size) : '—'} />
            {/* sgspe#14: la huella deja confirmar si alguien tiene un archivo concreto; se reserva como el nombre (P59) a quien no lo
                descarga. el servidor ya la oculta del descriptor a quien no descarga (UPS-24); el portal la reserva igual como defensa
                adicional, y también cuando el descriptor no la trae */}
            <Dato
              termino={t('documentos.ficha.huella')}
              valor={
                !descriptor ? (
                  '—'
                ) : puedeDescargar && descriptor.sha256 ? (
                  <span className="break-all font-sg-mono text-sg-caption">{descriptor.sha256}</span>
                ) : (
                  t('documentos.ficha.huellaReservada')
                )
              }
            />
            <Dato termino={t('documentos.ficha.capturada')} valor={capturada ? fechaYHoraPe(new Date(capturada)) : '—'} />
            {ubicacion?.type === 'Point' && Array.isArray(ubicacion.coordinates) ? (
              <Dato
                termino={t('documentos.ficha.ubicacion')}
                valor={(ubicacion.coordinates as number[])
                  .map((c) => c.toFixed(5))
                  .reverse()
                  .join(', ')}
              />
            ) : null}
          </dl>
          <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('documentos.ficha.datos')}</h2>
          <dl className="space-y-1">
            <Dato termino={t('evidencias.tituloDelDocumento')} valor={texto(evidencia, 'title') || '—'} />
            <Dato
              termino={t('evidencias.fechaDelDocumento')}
              valor={atributo<string>(evidencia, 'document_date') ? diaPe(texto(evidencia, 'document_date')) : '—'}
            />
            <Dato termino={t('evidencias.autor')} valor={texto(evidencia, 'author') || '—'} />
          </dl>
        </aside>
      </div>
      {editando ? <EditarEvidencia evidencia={evidencia} alCerrar={() => setEditando(false)} /> : null}
      <Drawer
        titulo={t('documentos.ficha.versionNueva')}
        descripcion={t('documentos.ficha.versionNuevaAyuda')}
        abierto={versionando}
        alCerrar={() => setVersionando(false)}
      >
        <FormularioDeEvidencia
          proyecto={proyecto}
          reemplaza={evidencia.id}
          alRegistrar={() => setVersionando(false)}
          alCancelar={() => setVersionando(false)}
        />
      </Drawer>
    </article>
  )
}

function Dato({ termino, valor }: { termino: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-sg-text-muted">{termino}</dt>
      <dd>{valor}</dd>
    </div>
  )
}

// la vista previa de una foto, difuminada si muestra personas sin consentimiento; la URL del blob se revoca al salir.
// «Reintentar» sube el contador de intentos, que es dependencia del efecto: el archivo se vuelve a pedir
function VistaPrevia({ evidencia, difuminada }: { evidencia: Registro; difuminada: boolean }) {
  const { t } = useTranslation(NS)
  const nombreDeEvidencia = useNombreDeEvidencia()
  const pedir = usePedir()
  const [url, setUrl] = useState<string | null>(null)
  const [fallo, setFallo] = useState<unknown>(null)
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    let creada: string | null = null
    pedir
      .archivo(`/sgspe/evidence/${evidencia.id}/content`)
      .then(({ blob }) => {
        if (!vigente) return
        creada = URL.createObjectURL(blob)
        setUrl(creada)
      })
      .catch((e: unknown) => vigente && setFallo(e))
    return () => {
      vigente = false
      if (creada) URL.revokeObjectURL(creada)
    }
  }, [pedir, evidencia.id, intento])
  return (
    <section aria-label={t('documentos.ficha.vistaPrevia')} className="space-y-2">
      <h2 className="text-sg-h3 font-semibold">{t('documentos.ficha.vistaPrevia')}</h2>
      {difuminada ? <p className="text-sg-caption text-sg-warning">{t('documentos.ficha.difuminada')}</p> : null}
      {fallo ? (
        <FalloDeLectura
          error={fallo}
          alReintentar={() => {
            setFallo(null)
            setIntento((n) => n + 1)
          }}
        />
      ) : url ? (
        <img src={url} alt={nombreDeEvidencia(evidencia)} className={difuminada ? 'max-h-96 blur-md' : 'max-h-96'} />
      ) : (
        <Cargando compacto />
      )}
    </section>
  )
}

// el nombre de un registro sustentado, sea del objeto que sea: su código y su título, nombre, observación o fecha de entrega;
// sin ninguno, un texto (nunca su id)
const useRotulo = (): ((r: Registro) => string) => {
  const { t } = useTranslation(NS)
  return (r) => {
    const partes = [texto(r, 'code'), texto(r, 'title') || texto(r, 'name') || texto(r, 'observation') || texto(r, 'delivery_date')]
    return partes.filter(Boolean).join(' · ') || t('documentos.ficha.sinNombre')
  }
}

// los registros que sustenta: un vínculo evidence_<objeto> por destino; los objetos que la cuenta no lee (403) no se listan, ni los
// que el modelo del tenant todavía no tiene (404: un tenant de F3 no tiene las QCS ni los riesgos de F4). una QCS confidencial que
// la cuenta no lee no aparece: wasichai la quita de los relacionados (security.md §9.6)
function Sustenta({ evidencia, escribe }: { evidencia: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const rotulo = useRotulo()
  const pedir = usePedir()
  const consultas = useQueries({
    queries: DESTINOS_DE_EVIDENCIA.map((objeto) => ({
      queryKey: ['related', 'evidence', evidencia.id, `evidence_${objeto}`],
      queryFn: () => pedir<Pagina>(`/objects/evidence/records/${evidencia.id}/related/evidence_${objeto}?${consulta({ size: 200 })}`)
    }))
  })
  const legibles = consultas
    .map((c, i) => ({ objeto: DESTINOS_DE_EVIDENCIA[i], c }))
    .filter(({ c }) => !(c.error instanceof ApiError && (c.error.status === 403 || c.error.status === 404)))
  const cargando = legibles.some(({ c }) => c.isPending)
  const fallida = legibles.find(({ c }) => c.isError && !c.data)
  const filas = legibles.flatMap(({ objeto, c }) => (c.data?.content ?? []).map((r) => ({ objeto, r })))
  return (
    <section aria-label={t('documentos.ficha.sustenta')} className="space-y-2">
      <h2 className="text-sg-h3 font-semibold">{t('documentos.ficha.sustenta')}</h2>
      {fallida ? <FalloDeLectura error={fallida.c.error} alReintentar={() => void fallida.c.refetch()} /> : null}
      {cargando ? (
        <Cargando compacto />
      ) : filas.length === 0 && !fallida ? (
        <p className="text-sm text-sg-text-muted">{t('documentos.ficha.sustentaVacio')}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {filas.map(({ objeto, r }) => (
            <li key={`${objeto}:${r.id}`}>
              <Link
                to={rutaDeFicha(objeto, r) ?? rutaParaAbrir(objeto, r.id)}
                className="rounded-sg-sm bg-sg-surface-sunken px-2 py-0.5 text-sg-caption underline"
              >
                {t(`documentos.ficha.objetos.${objeto}`)}: {rotulo(r)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {escribe ? <Vincular evidencia={evidencia} /> : null}
    </section>
  )
}

function Vincular({ evidencia }: { evidencia: Registro }) {
  const { t } = useTranslation(NS)
  const rotulo = useRotulo()
  const { can } = useAuth()
  const vincular = useVincularEvidencia()
  const mensaje = useMensajeDeError()
  const [objeto, setObjeto] = useState('')
  const [elegido, setElegido] = useState<Registro | null>(null)
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const conMotivo = MOTIVO_EN_TODAS.includes(objeto)
  const faltaMotivo = conMotivo && motivo.trim() === ''
  const proyecto = atributo<string>(evidencia, 'project')
  const confirmar = () => {
    setIntentado(true)
    if (!elegido || faltaMotivo) return
    vincular.mutate(
      { evidencia: evidencia.id, vinculo: { object: objeto, recordId: elegido.id }, motivo: motivo.trim() || undefined },
      {
        onSuccess: () => {
          setElegido(null)
          setMotivo('')
          setIntentado(false)
        }
      }
    )
  }
  return (
    <details className="rounded-sg-md border border-sg-border p-3">
      <summary className="cursor-pointer text-sm font-medium text-sg-primary-text">{t('documentos.ficha.vincular')}</summary>
      <div className="mt-2 space-y-2">
        <Campo etiqueta={t('documentos.ficha.objeto')}>
          {(p) => (
            <SelectNativo
              {...p}
              value={objeto}
              onChange={(e) => {
                setObjeto(e.target.value)
                setElegido(null)
                vincular.reset()
              }}
              opciones={DESTINOS_DE_EVIDENCIA.filter((o) => can(o, 'UPDATE')).map((o) => ({ valor: o, etiqueta: t(`documentos.ficha.objetos.${o}`) }))}
            />
          )}
        </Campo>
        {objeto && !elegido ? (
          <BuscadorDeRegistro
            key={objeto}
            objeto={objeto}
            etiqueta={t('documentos.ficha.buscarRegistro')}
            filtros={proyecto && objeto !== 'community' && objeto !== 'land_parcel' && objeto !== 'study' ? { project: proyecto } : {}}
            rotulo={rotulo}
            alElegir={setElegido}
          />
        ) : null}
        {elegido ? <p className="text-sm">{rotulo(elegido)}</p> : null}
        {conMotivo ? (
          <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && faltaMotivo ? t('comun.motivoFalta') : undefined}>
            {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
        ) : null}
        {vincular.isError ? <Alert tone="danger">{mensaje(vincular.error)}</Alert> : null}
        {vincular.isSuccess ? (
          <p role="status" className="text-sm text-sg-success">
            {t('evidencias.vinculada')}
          </p>
        ) : null}
        <Button size="sm" onClick={confirmar} disabled={!elegido || vincular.isPending} aria-busy={vincular.isPending}>
          {t('evidencias.vincular')}
        </Button>
      </div>
    </details>
  )
}

// las versiones: a cuál reemplaza esta y cuáles la reemplazan a ella
function Versiones({ evidencia }: { evidencia: Registro }) {
  const { t } = useTranslation(NS)
  const anterior = useRegistro('evidence', atributo<string>(evidencia, 'replaces'))
  const posteriores = useRegistros('evidence', { replaces: evidencia.id, size: 50 })
  const enlace = (e: Registro) => rutaDeFicha('evidence', e) ?? rutaParaAbrir('evidence', e.id)
  const nombreDeEvidencia = useNombreDeEvidencia()
  return (
    <section aria-label={t('documentos.ficha.versiones')} className="space-y-2">
      <h2 className="text-sg-h3 font-semibold">{t('documentos.ficha.versiones')}</h2>
      {anterior.isError && !anterior.data ? <FalloDeLectura error={anterior.error} alReintentar={() => void anterior.refetch()} /> : null}
      {posteriores.isError && !posteriores.data ? <FalloDeLectura error={posteriores.error} alReintentar={() => void posteriores.refetch()} /> : null}
      {posteriores.isPending ? <Cargando compacto /> : null}
      <ul className="space-y-1 text-sm">
        {anterior.data ? (
          <li>
            <Link to={enlace(anterior.data)} className="text-sg-primary-text underline">
              {t('documentos.ficha.reemplazaA', { nombre: nombreDeEvidencia(anterior.data) })}
            </Link>
          </li>
        ) : null}
        {(posteriores.data?.content ?? []).map((e) => (
          <li key={e.id}>
            <Link to={enlace(e)} className="text-sg-primary-text underline">
              {t('documentos.ficha.reemplazadaPor', { nombre: nombreDeEvidencia(e) })}
            </Link>
          </li>
        ))}
      </ul>
      {!atributo(evidencia, 'replaces') && posteriores.data?.content.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('documentos.ficha.sinVersiones')}</p>
      ) : null}
    </section>
  )
}

const esquema = z.object({
  title: z.string(),
  document_date: z.string(),
  author: z.string(),
  classification: z.string().min(1),
  people_identifiable: z.boolean(),
  photo_consent_given: z.boolean(),
  motivo: z.string()
})
type Valores = z.infer<typeof esquema>
const EDITABLES = ['title', 'document_date', 'author', 'classification', 'people_identifiable', 'photo_consent_given'] as const

// los datos descriptivos y la clasificación (PATCH /api/sgspe/evidence/{id}): solo lo que cambió, con If-Match; cambiar la
// clasificación exige motivo (FIELD_REASON_REQUIRED) y bajar una restringida, DOWNLOAD_RESTRICTED (ASM-071). un 412 ofrece
// «Recargar» y lo escrito se conserva
function EditarEvidencia({ evidencia, alCerrar }: { evidencia: Registro; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  const definicion = useDefinicion('evidence')
  const cliente = useQueryClient()
  const releer = useReleer()
  const erroresDeCampo = useErroresDeCampo()
  const vigente = useRegistro('evidence', evidencia.id).data ?? evidencia
  const guardar = useComando<Registro, { cambios: Record<string, unknown>; motivo?: string }>(
    ({ cambios, motivo }) => ({ ruta: `/sgspe/evidence/${evidencia.id}`, metodo: 'PATCH', json: { attributes: cambios }, version: vigente.updatedAt, motivo }),
    { conClave: false, invalidar: () => [['records', 'evidence']] }
  )
  const inicial = (r: Registro): Valores => ({
    title: texto(r, 'title'),
    document_date: texto(r, 'document_date'),
    author: texto(r, 'author'),
    classification: texto(r, 'classification'),
    people_identifiable: atributo(r, 'people_identifiable') === true,
    photo_consent_given: atributo(r, 'photo_consent_given') === true,
    motivo: ''
  })
  const { register, handleSubmit, control, formState, setError } = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: inicial(evidencia) })
  const clasificacion = useWatch({ control, name: 'classification' })
  const personas = useWatch({ control, name: 'people_identifiable' })
  const cambiaClasificacion = clasificacion !== texto(vigente, 'classification')
  const bajaRestringida = CLASIFICACIONES_RESTRINGIDAS.includes(texto(vigente, 'classification')) && !CLASIFICACIONES_RESTRINGIDAS.includes(clasificacion)
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  const delServidor = Object.fromEntries(Object.entries(erroresDeCampo(guardar.error)).map(([c, x]) => [c.replace(/^attributes\./, ''), x]))
  // un error que ya se dice junto a su control no se repite en el aviso
  const soloDeCampos =
    Object.keys(delServidor).length > 0 && Object.keys(delServidor).every((c) => (EDITABLES as readonly string[]).includes(c) || c === 'reason')
  const enviar = handleSubmit((v) => {
    if (cambiaClasificacion && v.motivo.trim() === '') {
      setError('motivo', { type: 'manual', message: t('comun.motivoFalta') })
      return
    }
    const actual = inicial(vigente)
    const cambios = Object.fromEntries(EDITABLES.filter((c) => v[c] !== actual[c]).map((c) => [c, typeof v[c] === 'string' && v[c] === '' ? null : v[c]]))
    if (Object.keys(cambios).length === 0) {
      alCerrar()
      return
    }
    guardar.mutate(
      { cambios, motivo: v.motivo.trim() || undefined },
      {
        onSuccess: (r) => {
          cliente.setQueryData(['record', 'evidence', evidencia.id], r)
          alCerrar()
        }
      }
    )
  })
  return (
    <Drawer
      titulo={t('documentos.ficha.editarTitulo')}
      abierto
      alCerrar={alCerrar}
      pie={
        <>
          <Button variant="secondary" onClick={alCerrar} disabled={guardar.isPending}>
            {t('comun.cancelar')}
          </Button>
          <Button type="submit" form="editar-evidencia" disabled={guardar.isPending} aria-busy={guardar.isPending}>
            {guardar.isPending ? t('comun.guardando') : t('comun.guardar')}
          </Button>
        </>
      }
    >
      <form id="editar-evidencia" className="space-y-3" onSubmit={(e) => void enviar(e)}>
        <Campo etiqueta={t('evidencias.tituloDelDocumento')} error={delServidor.title}>
          {(p) => <Input {...p} {...register('title')} maxLength={300} />}
        </Campo>
        <Campo etiqueta={t('evidencias.fechaDelDocumento')} error={delServidor.document_date}>
          {(p) => <Input {...p} type="date" {...register('document_date')} />}
        </Campo>
        <Campo etiqueta={t('evidencias.autor')} error={delServidor.author}>
          {(p) => <Input {...p} {...register('author')} maxLength={200} />}
        </Campo>
        <Campo
          etiqueta={t('evidencias.clasificacion')}
          error={delServidor.classification ?? (formState.errors.classification ? t('evidencias.opcionFalta') : undefined)}
        >
          {(p) => <SelectNativo {...p} {...register('classification')} opciones={opciones('classification')} />}
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('people_identifiable')} />
          {t('evidencias.personas')}
        </label>
        {personas ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('photo_consent_given')} />
            {t('evidencias.consentimiento')}
          </label>
        ) : null}
        {cambiaClasificacion ? (
          <>
            <p className="text-sg-caption text-sg-text-muted">{t('documentos.ficha.motivoClasificacion')}</p>
            <Campo etiqueta={t('comun.motivoObligatorio')} error={formState.errors.motivo?.message ?? delServidor.reason}>
              {(p) => <Textarea {...p} {...register('motivo')} maxLength={500} />}
            </Campo>
          </>
        ) : null}
        {bajaRestringida ? <p className="text-sg-caption text-sg-warning">{t('documentos.ficha.bajaRestringida')}</p> : null}
        {guardar.isError && !soloDeCampos ? (
          <AvisoDeConflicto error={guardar.error} releer={() => releer(['record', 'evidence', evidencia.id])} alRecargar={() => guardar.reset()} />
        ) : null}
      </form>
    </Drawer>
  )
}
