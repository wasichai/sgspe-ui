import { useAuth } from '@wasichai/core'
import { Alert, Button, cn, Input, Table, Td, Th } from '@wasichai/ui'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Campo, SelectNativo } from '../componentes/Campo'
import { useMensajeDeError } from '../componentes/errores'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { Cargando } from '../componentes/Estados'
import { Pasos } from '../componentes/Pasos'
import { useMisProyectos, useProyectos } from '../contexto/proyectos'
import { codigoDelError, guardarArchivo } from '../datos/http'
import { atributo, texto, useDefinicion, useRegistro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import {
  columnaDeCampo,
  conteosPrevistos,
  decisionesDe,
  DESTINOS,
  importaA,
  filasConDecision,
  nuevaClave,
  useConfirmacion,
  useReporte,
  useVistaPrevia,
  type Columnas,
  type Conteos,
  type Decision,
  type Destino,
  type Pedido,
  type Resultado,
  type VistaPrevia
} from './importacion'

// S15 · importación geoespacial (screens.md §4): 1 archivo y destino, 2 CRS de origen y columnas, 3 vista previa con las
// decisiones fila por fila, 4 confirmación. el archivo vive en esta pestaña entre la vista previa y la confirmación (la
// importación no deja estado en el servidor, ASM-060); sin CRS de origen confirmado no se avanza (RQ-GIS-007, CON-024).
// los errores dicen el texto de su código (api.md §3.3): IMPORT_CONFLICT ofrece volver a ver la vista previa, IMPORT_BUSY
// (503) reintentar con la misma clave y SHA256_MISMATCH empezar de nuevo; la confirmación se compara con la vista previa
const COLUMNAS_DE_PUNTOS = ['code', 'easting', 'northing', 'elevation', 'azimuth', 'dip', 'depth', 'drillType', 'latitude', 'longitude'] as const

interface Estado {
  pedido: Pedido
  vista: VistaPrevia
}

// el estado de la importación en curso, fuera del árbol de rutas: /territory/imports/new y /territory/imports/:id lo comparten.
// es de quien lo abrió: si en la misma pestaña entra otra cuenta, no lo ve (core no avisa del cierre de sesión)
const enCurso: { estado: Estado | null; usuario: string | null } = { estado: null, usuario: null }

const guardarEnCurso = (usuario: string | undefined, estado: Estado) => {
  enCurso.estado = estado
  enCurso.usuario = usuario ?? null
}
const enCursoDe = (usuario: string | undefined): Estado | null => {
  if (enCurso.usuario !== (usuario ?? null)) enCurso.estado = null
  return enCurso.estado
}

export function ImportacionPage() {
  const { id } = useParams()
  return id === 'new' || !id ? <Preparar /> : <Revisar id={id} />
}

function Preparar() {
  const { t } = useTranslation(NS)
  const { can, user } = useAuth()
  const navegar = useNavigate()
  const [busqueda] = useSearchParams()
  const proyectos = useProyectos()
  const mios = useMisProyectos()
  const previo = enCursoDe(user?.id)?.pedido
  const [paso, setPaso] = useState(previo ? 1 : 0)
  const [archivo, setArchivo] = useState<File | null>(previo?.archivo ?? null)
  const destinos = DESTINOS.filter((d) => importaA(can, d))
  const [destino, setDestino] = useState<Destino | ''>(previo?.destino ?? destinos[0] ?? '')
  const [proyecto, setProyecto] = useState(previo?.proyecto ?? busqueda.get('project') ?? '')
  const registroDelProyecto = useRegistro('project', proyecto || undefined)
  const definicion = useDefinicion(destino || 'project_component')
  const [crs, setCrs] = useState(previo?.crs ?? '')
  const [confirmado, setConfirmado] = useState(false)
  const [columnas, setColumnas] = useState<Columnas>(previo?.columnas ?? { code: '' })
  const vistaPrevia = useVistaPrevia()
  const mensaje = useMensajeDeError()
  const pasos = t('importacion.pasos', { returnObjects: true }) as string[]
  const opcionesDeCrs = definicion.data?.fields.find((f) => f.name === 'source_crs')?.enumOptions ?? []
  // se propone el CRS de trabajo del proyecto solo si es uno de los orígenes que el servidor acepta; si no, la persona elige
  const propuesto = crs || texto(registroDelProyecto.data, 'working_crs')
  const crsPropuesto = opcionesDeCrs.includes(propuesto) ? propuesto : ''
  const esGeojson = archivo ? /\.(geo)?json$/i.test(archivo.name) : false

  if (destinos.length === 0) return <Alert tone="warning">{t('importacion.sinDestinos')}</Alert>

  const verPrevia = () => {
    if (!archivo || !destino || !proyecto || !crsPropuesto || !confirmado) return
    const pedido: Pedido = { archivo, destino, proyecto, crs: crsPropuesto, columnas: Object.fromEntries(Object.entries(columnas).filter(([, v]) => v)) }
    vistaPrevia.mutate(pedido, {
      onSuccess: (vista) => {
        guardarEnCurso(user?.id, { pedido, vista })
        navegar(`/territory/imports/${vista.importBatchId}`)
      }
    })
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-6 lg:grid-cols-[220px_1fr]">
      <div className="space-y-2">
        <h1 className="text-sg-h2 font-semibold">{t('importacion.titulo')}</h1>
        <Pasos pasos={pasos} actual={paso} visitados={paso} alIr={setPaso} />
      </div>
      <div className="space-y-4">
        <Alert tone="notice">{t('importacion.nadaEscrito')}</Alert>
        {paso === 0 ? (
          <section className="space-y-3" aria-label={pasos[0]}>
            <Campo etiqueta={t('importacion.archivo')}>
              {(p) => (
                <Input
                  {...p}
                  type="file"
                  accept=".xlsx,.csv,.geojson,.json"
                  onChange={(e) => {
                    setArchivo(e.target.files?.[0] ?? null)
                    // el CRS confirmado era el de otro archivo
                    setConfirmado(false)
                  }}
                />
              )}
            </Campo>
            <Campo etiqueta={t('importacion.destino')}>
              {(p) => (
                <SelectNativo
                  {...p}
                  vacio={false}
                  value={destino}
                  onChange={(e) => {
                    setDestino(e.target.value as Destino)
                    setConfirmado(false)
                  }}
                  opciones={destinos.map((d) => ({ valor: d, etiqueta: t(`importacion.destinos.${d}`) }))}
                />
              )}
            </Campo>
            <Campo etiqueta={t('importacion.proyecto')}>
              {(p) => (
                <SelectNativo
                  {...p}
                  value={proyecto}
                  disabled={!proyectos.data}
                  onChange={(e) => {
                    setProyecto(e.target.value)
                    // otro proyecto propone otro CRS de trabajo: lo que se confirmó era del anterior
                    setCrs('')
                    setConfirmado(false)
                  }}
                  opciones={(proyectos.data ?? [])
                    .filter((x) => mios.size === 0 || mios.has(x.id))
                    .map((x) => ({ valor: x.id, etiqueta: `${String(atributo(x, 'code'))} · ${String(atributo(x, 'name'))}` }))}
                />
              )}
            </Campo>
            {proyectos.isPending ? <Cargando /> : null}
            {proyectos.isError && !proyectos.data ? <FalloDeLectura error={proyectos.error} alReintentar={() => void proyectos.refetch()} /> : null}
            <Button disabled={!archivo || !destino || !proyecto} onClick={() => setPaso(1)}>
              {t('comun.siguiente')}
            </Button>
          </section>
        ) : (
          <section className="space-y-3" aria-label={pasos[1]}>
            {definicion.isPending ? <Cargando /> : null}
            {definicion.isError && !definicion.data ? <FalloDeLectura error={definicion.error} alReintentar={() => void definicion.refetch()} /> : null}
            {registroDelProyecto.isError && !registroDelProyecto.data ? (
              <FalloDeLectura error={registroDelProyecto.error} alReintentar={() => void registroDelProyecto.refetch()} />
            ) : null}
            <Campo etiqueta={t('importacion.crs')} ayuda={t('importacion.crsAyuda')}>
              {(p) => (
                <SelectNativo
                  {...p}
                  value={crsPropuesto}
                  onChange={(e) => {
                    setCrs(e.target.value)
                    setConfirmado(false)
                  }}
                  opciones={opcionesDeCrs}
                />
              )}
            </Campo>
            {crsPropuesto ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
                {t('importacion.confirmoCrs', { crs: crsPropuesto })}
              </label>
            ) : null}
            <fieldset className="grid gap-3 rounded-sg-lg border border-sg-border p-4 md:grid-cols-3">
              <legend className="px-1 text-sm font-medium">{t('importacion.columnas')}</legend>
              <p className="text-sg-caption text-sg-text-muted md:col-span-3">{t('importacion.columnasAyuda')}</p>
              {(esGeojson ? (['code'] as const) : COLUMNAS_DE_PUNTOS).map((c) => (
                <Campo key={c} etiqueta={t(`importacion.columna.${c}`)}>
                  {(p) => <Input {...p} value={columnas[c] ?? ''} onChange={(e) => setColumnas({ ...columnas, [c]: e.target.value })} />}
                </Campo>
              ))}
            </fieldset>
            {vistaPrevia.isError ? (
              <Alert tone="danger">
                {mensaje(vistaPrevia.error, { NOT_ASSIGNED: t('importacion.errores.NOT_ASSIGNED') })}
                {codigoDelError(vistaPrevia.error) === 'IMPORT_BUSY' ? (
                  <Button variant="secondary" size="sm" className="ml-2" onClick={verPrevia}>
                    {t('comun.reintentar')}
                  </Button>
                ) : null}
              </Alert>
            ) : null}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPaso(0)}>
                {t('comun.anterior')}
              </Button>
              <Button disabled={!crsPropuesto || !confirmado || vistaPrevia.isPending} onClick={verPrevia}>
                {vistaPrevia.isPending ? t('importacion.leyendo') : t('importacion.verPrevia')}
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Revisar({ id }: { id: string }) {
  const { t } = useTranslation(NS)
  const { user } = useAuth()
  const navegar = useNavigate()
  const guardado = enCursoDe(user?.id)
  const estado = guardado?.vista.importBatchId === id ? guardado : null
  const [decisiones, setDecisiones] = useState<Record<number, Decision['action']>>({})
  const [clave, setClave] = useState(nuevaClave)
  const [resultado, setResultado] = useState<{ escrito: Resultado; previsto: Conteos; vista: VistaPrevia; pedido: Pedido } | null>(null)
  // ya está escrito: volver a la dirección de la vista previa pide empezar de nuevo, no confirmar otra vez (también si la
  // respuesta llega con la pantalla desmontada)
  const confirmacion = useConfirmacion(reiniciarImportacion)
  const reporte = useReporte()
  const otraVistaPrevia = useVistaPrevia()
  const mensaje = useMensajeDeError()
  const pasos = t('importacion.pasos', { returnObjects: true }) as string[]
  if (resultado) return <Confirmada {...resultado} />
  if (!estado)
    return (
      <Alert tone="warning">
        {t('importacion.sinArchivo')}{' '}
        <Link to="/territory/imports/new" className="underline">
          {t('importacion.empezar')}
        </Link>
      </Alert>
    )
  const { vista, pedido } = estado
  const filas = filasConDecision(vista)
  const accion = (row: number) => decisiones[row] ?? 'APPLY'
  const descartada = (row: number) => filas.some((f) => f.row === row) && accion(row) === 'DISCARD'
  const cuenta = (caso: string) => vista.differences.filter((d) => d.outcome === caso).length
  // lo que se escribirá de cada caso: sus filas menos las descartadas (una fila fuera de zona cuenta en su caso si entra)
  const aplicadas = (caso: string) => vista.differences.filter((d) => d.outcome === caso && !descartada(d.row)).length
  const confirmar = () => {
    const enviadas = decisionesDe(filas, decisiones)
    confirmacion.mutate(
      { vista, pedido, clave, decisiones: enviadas },
      {
        onSuccess: (r) => {
          setResultado({ escrito: r, previsto: conteosPrevistos(vista, enviadas), vista, pedido })
        }
      }
    )
  }
  // IMPORT_CONFLICT: lo registrado cambió y no se escribió nada; la vista previa se repite con el mismo pedido
  const previsualizarOtraVez = () =>
    otraVistaPrevia.mutate(pedido, {
      onSuccess: (nueva) => {
        guardarEnCurso(user?.id, { pedido, vista: nueva })
        setDecisiones({})
        setClave(nuevaClave())
        confirmacion.reset()
        navegar(`/territory/imports/${nueva.importBatchId}`)
      }
    })
  const codigo = codigoDelError(confirmacion.error)
  const kpis = [
    ['filas', vista.rows],
    ['nuevas', cuenta('CREATE')],
    ['sinCambio', cuenta('UNCHANGED')],
    ['conDiferencias', cuenta('NEW_VERSION') + cuenta('UPDATE')],
    ['invalidas', vista.invalid.length],
    ['fueraDeZona', vista.outOfZone.length]
  ] as const

  return (
    <div className="mx-auto grid max-w-[1200px] gap-6 lg:grid-cols-[220px_1fr]">
      <div className="space-y-2">
        <h1 className="text-sg-h2 font-semibold">{t('importacion.titulo')}</h1>
        <Pasos pasos={pasos} actual={2} visitados={2} />
      </div>
      <div className="space-y-4">
        <Alert tone="notice">{t('importacion.nadaEscrito')}</Alert>
        <p className="font-sg-mono text-sg-caption text-sg-text-muted">
          {pedido.archivo.name} · {pedido.crs} · SHA-256 {vista.sha256}
        </p>
        <ul className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {kpis.map(([k, v]) => (
            <li key={k} aria-label={t(`importacion.kpis.${k}`)} className="rounded-sg-lg border border-sg-border bg-sg-surface p-3">
              <p className="text-sg-caption text-sg-text-muted">{t(`importacion.kpis.${k}`)}</p>
              <p className="text-sg-kpi-sm font-semibold tabular-nums">{numeroPe(v)}</p>
            </li>
          ))}
        </ul>
        {vista.invalid.length > 0 ? (
          <section aria-label={t('importacion.invalidas')} className="space-y-1 text-sm">
            <h2 className="font-medium">{t('importacion.invalidas')}</h2>
            <ul>
              {vista.invalid.map((f) => (
                <li key={`${f.row}-${f.field ?? ''}`}>
                  {t('importacion.fila', { n: f.row })}
                  {columnaDeCampo(f.field) ? ` · ${t(`importacion.columna.${columnaDeCampo(f.field)}`)}` : ''}: {f.message}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {filas.length > 0 ? (
          <Table aria-label={t('importacion.decisiones')}>
            <thead>
              <tr>
                {(['fila', 'codigo', 'caso', 'distancia', 'decision'] as const).map((c) => (
                  <Th key={c} scope="col">
                    {t(`importacion.columnasDecision.${c}`)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr
                  key={`${f.caso}-${f.row}`}
                  data-fuera-de-zona={f.caso === 'OUT_OF_ZONE' ? 'true' : undefined}
                  className={cn(f.caso === 'OUT_OF_ZONE' && 'bg-sg-warning-soft')}
                >
                  <Td>{f.row}</Td>
                  <Td className="font-sg-mono text-sg-caption">{f.code}</Td>
                  <Td>
                    {f.caso === 'OUT_OF_ZONE' ? (
                      <span className="inline-flex items-center gap-1 font-medium text-sg-warning">
                        <TriangleAlert aria-hidden className="size-3.5" />
                        {t(`importacion.casos.${f.caso}`)}
                      </span>
                    ) : (
                      t(`importacion.casos.${f.caso}`)
                    )}
                    {f.mensaje ? <p className="text-sg-caption text-sg-text-secondary">{f.mensaje}</p> : null}
                  </Td>
                  <Td>{f.distanceM === null || f.distanceM === undefined ? '—' : numeroPe(f.distanceM)}</Td>
                  <Td>
                    <select
                      aria-label={`${t('importacion.columnasDecision.decision')} ${t('importacion.fila', { n: f.row })}`}
                      value={accion(f.row)}
                      onChange={(e) => setDecisiones({ ...decisiones, [f.row]: e.target.value as Decision['action'] })}
                      className="h-8 rounded-sg-md border border-sg-border-strong bg-sg-surface px-2 text-sm"
                    >
                      <option value="APPLY">{t('importacion.acciones.APPLY')}</option>
                      <option value="DISCARD">{t('importacion.acciones.DISCARD')}</option>
                    </select>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
        <section aria-label={t('importacion.alConfirmar')} className="rounded-sg-lg border border-sg-border bg-sg-surface-sunken p-4 text-sm">
          <h2 className="font-medium">{t('importacion.alConfirmar')}</h2>
          <p>
            {t('importacion.escritura', {
              crear: numeroPe(aplicadas('CREATE')),
              versiones: numeroPe(aplicadas('NEW_VERSION')),
              actualizar: numeroPe(aplicadas('UPDATE')),
              count: filas.filter((f) => accion(f.row) === 'DISCARD').length
            })}
          </p>
        </section>
        {confirmacion.isError ? (
          <Alert tone="danger">
            {mensaje(confirmacion.error, { NOT_ASSIGNED: t('importacion.errores.NOT_ASSIGNED') })}
            {codigo === 'IMPORT_CONFLICT' ? (
              <Button variant="secondary" size="sm" className="ml-2" onClick={previsualizarOtraVez} disabled={otraVistaPrevia.isPending}>
                {t('importacion.volverAPrevisualizar')}
              </Button>
            ) : codigo === 'IMPORT_BUSY' ? (
              <Button variant="secondary" size="sm" className="ml-2" onClick={confirmar}>
                {t('comun.reintentar')}
              </Button>
            ) : codigo === 'SHA256_MISMATCH' ? (
              <Link to="/territory/imports/new" className="ml-2 underline" onClick={reiniciarImportacion}>
                {t('importacion.empezar')}
              </Link>
            ) : null}
          </Alert>
        ) : null}
        {otraVistaPrevia.isError ? <Alert tone="danger">{mensaje(otraVistaPrevia.error)}</Alert> : null}
        {reporte.isError ? <Alert tone="danger">{mensaje(reporte.error)}</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navegar('/territory/imports/new')}>
            {t('importacion.otroCrs')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => reporte.mutate(pedido, { onSuccess: (a) => guardarArchivo(a, `diferencias-${vista.importBatchId}.xlsx`) })}
            disabled={reporte.isPending}
          >
            {t('importacion.reporte')}
          </Button>
          <Button disabled={confirmacion.isPending} onClick={confirmar}>
            {confirmacion.isPending ? t('importacion.confirmando') : t('importacion.confirmar')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// la importación ya está escrita: sus conteos frente a los que preveía la vista previa
function Confirmada({ escrito, previsto, vista, pedido }: { escrito: Resultado; previsto: Conteos; vista: VistaPrevia; pedido: Pedido }) {
  const { t } = useTranslation(NS)
  const claves = ['created', 'newVersions', 'updated', 'unchanged', 'rejected'] as const
  const difiere = claves.some((k) => escrito[k] !== previsto[k])
  return (
    <section className="mx-auto max-w-[900px] space-y-4">
      <h1 className="text-sg-h2 font-semibold">{t('importacion.hecho')}</h1>
      {difiere ? <Alert tone="warning">{t('importacion.difiere', { id: vista.importBatchId })}</Alert> : null}
      <ul className="grid gap-3 sm:grid-cols-5">
        {claves.map((k) => (
          <li key={k} aria-label={t(`importacion.resultado.${k}`)} className="rounded-sg-lg border border-sg-border bg-sg-surface p-3">
            <p className="text-sg-caption text-sg-text-muted">{t(`importacion.resultado.${k}`)}</p>
            <p className="text-sg-kpi-sm font-semibold">{numeroPe(escrito[k])}</p>
            {escrito[k] !== previsto[k] ? <p className="text-sg-caption text-sg-warning">{t('importacion.previsto', { n: numeroPe(previsto[k]) })}</p> : null}
          </li>
        ))}
      </ul>
      <Button asChild>
        <Link to={`/projects/${pedido.proyecto}/map`}>{t('importacion.volverAlMapa')}</Link>
      </Button>
    </section>
  )
}

// deja la pestaña sin importación en curso: al confirmar, al empezar de nuevo y en las pruebas
export const reiniciarImportacion = () => {
  enCurso.estado = null
  enCurso.usuario = null
}
