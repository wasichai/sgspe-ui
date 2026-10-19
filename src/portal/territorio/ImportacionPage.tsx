import { useAuth } from '@wasichai/core'
import { Alert, Button, cn, Input, Table, Td, Th } from '@wasichai/ui'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Campo, SelectNativo } from '../componentes/Campo'
import { useMensajeDeError } from '../componentes/errores'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { Cargando, esIlegible, NoEsDeSusProyectos } from '../componentes/Estados'
import { Pasos } from '../componentes/Pasos'
import { useMisProyectos, useProyectos } from '../contexto/proyectos'
import { codigoDelError, guardarArchivo } from '../datos/http'
import { atributo, texto, useDefinicion, useRegistro } from '../datos/registros'
import { NS, numeroPe } from '../i18n'
import { useFormatosDeImportacion } from './consultas'
import {
  aceptaDe,
  capasDelError,
  columnaDeCampo,
  conteosPrevistos,
  CRS_FIJO,
  decisionesDe,
  DESTINOS,
  DESTINOS_DE_F2,
  DESTINOS_VECTORIALES,
  destinoSinModelo,
  disponible,
  eleccionPedida,
  esVectorial,
  formatoDe,
  FORMATOS_DE_F2,
  FORMATOS_EN_ORDEN,
  importaA,
  filasConDecision,
  LEE_GDAL,
  nuevaClave,
  opcionDeCrs,
  useConfirmacion,
  useReporte,
  useVistaPrevia,
  type CapaDelArchivo,
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
// (503) reintentar con la misma clave y SHA256_MISMATCH empezar de nuevo; la confirmación se compara con la vista previa.
// desde F6, los formatos que lee el servidor (imports/formats; sin GDAL, los de F2), la capa de un archivo de varias, el CRS
// que declara el archivo como propuesta y los destinos comunidad y elemento ambiental (spec §3.4)
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
  const formatosDelServidor = useFormatosDeImportacion()
  // un destino de F6 que el servidor rechazó porque la organización todavía no tiene su modelo: se vuelve a los de F2
  const [sinModeloDeF6, setSinModeloDeF6] = useState(false)
  // sin /imports/formats (backend sin F6) se ofrece lo de F2: sus formatos y sus destinos
  const conF6 = formatosDelServidor.isSuccess
  const formatos = formatosDelServidor.data?.formats ?? FORMATOS_DE_F2
  const previo = enCursoDe(user?.id)?.pedido
  const [paso, setPaso] = useState(previo ? 1 : 0)
  const [archivo, setArchivo] = useState<File | null>(previo?.archivo ?? null)
  const destinos = (conF6 && !sinModeloDeF6 ? DESTINOS : DESTINOS_DE_F2).filter((d) => importaA(can, d))
  const [elegido, setDestino] = useState<Destino | ''>(previo?.destino ?? '')
  // el elegido mientras se ofrezca; si no (todavía no hay formatos, o el servidor no tiene ese destino), el primero
  const destino: Destino | '' = elegido !== '' && destinos.includes(elegido) ? elegido : (destinos.at(0) ?? '')
  const [proyecto, setProyecto] = useState(previo?.proyecto ?? busqueda.get('project') ?? '')
  const registroDelProyecto = useRegistro('project', proyecto || undefined)
  const definicion = useDefinicion(destino || 'project_component')
  const [crs, setCrs] = useState(previo?.crs ?? '')
  // el CRS que la persona confirmó: la confirmación vale solo mientras ese siga siendo el propuesto (CON-024)
  const [confirmadoEn, setConfirmadoEn] = useState('')
  // al volver de la vista previa, un tipo fijo (=valor) vuelve a su selector y no al campo de la columna
  const fijoPrevio = previo?.columnas.featureType?.startsWith('=') ? previo.columnas.featureType.slice(1) : ''
  const [columnas, setColumnas] = useState<Columnas>(() => (previo ? (fijoPrevio ? { ...previo.columnas, featureType: '' } : previo.columnas) : { code: '' }))
  const [tipoFijo, setTipoFijo] = useState(fijoPrevio)
  const [capa, setCapa] = useState(previo?.capa ?? '')
  const alFallar = (error: unknown) => {
    if (!destinoSinModelo(error) || !destino || !DESTINOS_VECTORIALES.includes(destino)) return
    setSinModeloDeF6(true)
    setConfirmadoEn('')
    setPaso(0)
  }
  const vistaPrevia = useVistaPrevia()
  // «Leer el archivo»: la vista previa sin sourceCrs, que responde 400 con las capas y el CRS que declara cada una
  const lectura = useVistaPrevia()
  const mensaje = useMensajeDeError()
  const pasos = t('importacion.pasos', { returnObjects: true }) as string[]
  const opcionesDeCrs = definicion.data?.fields.find((f) => f.name === 'source_crs')?.enumOptions ?? []
  const tiposDeElemento = definicion.data?.fields.find((f) => f.name === 'feature_type')?.enumOptions ?? []
  const formato = archivo ? formatoDe(archivo.name) : null
  const formatoUsable = formato !== null && disponible(formato, formatos)
  const vectorial = esVectorial(formato)
  const destinoVectorial = destino !== '' && DESTINOS_VECTORIALES.includes(destino)
  // KML, KMZ y GPX fijan EPSG 4326
  const fijo = formato ? CRS_FIJO[formato] : undefined
  const leidas = capasDelError(lectura.error)
  const capasDelArchivo = leidas.length > 0 ? leidas : capasDelError(vistaPrevia.error)
  // con una sola capa, esa; con varias, la que elija la persona
  const capaDe = (nombre: string) => capasDelArchivo.find((c) => c.name === nombre) ?? (capasDelArchivo.length === 1 ? capasDelArchivo[0] : undefined)
  const capaElegida = capaDe(capa)
  // el CRS que declara la capa es una propuesta, como el de trabajo del proyecto: la persona la confirma con la casilla. lo que
  // la persona eligió gana; si no, el del archivo; si no, el de trabajo del proyecto, solo si es un origen que el servidor acepta
  const propuestaCon = (laCapa: CapaDelArchivo | undefined) => {
    const propuesto = fijo ?? (crs || opcionDeCrs(laCapa?.detectedCrs, opcionesDeCrs) || texto(registroDelProyecto.data, 'working_crs'))
    return opcionesDeCrs.includes(propuesto) ? propuesto : ''
  }
  const delArchivo = opcionDeCrs(capaElegida?.detectedCrs, opcionesDeCrs)
  const crsPropuesto = propuestaCon(capaElegida)
  const confirmado = confirmadoEn !== '' && confirmadoEn === crsPropuesto
  // leer el archivo antes de la vista previa solo sirve si su CRS no está fijo: con KML, KMZ y GPX la vista previa ya va con
  // EPSG 4326 y, si el archivo tiene varias capas, responde LAYER_REQUIRED con ellas
  const porLeer = formato !== null && LEE_GDAL.has(formato) && !fijo && capasDelArchivo.length === 0
  const camposDeColumnas: (keyof Columnas)[] = vectorial
    ? ['code', ...(destinoVectorial ? (['name'] as const) : []), ...(destino === 'environmental_feature' ? (['featureType'] as const) : [])]
    : [...COLUMNAS_DE_PUNTOS]
  const columnasQueViajan = (): Columnas => {
    const llenas: Columnas = Object.fromEntries(Object.entries(columnas).filter(([c, v]) => v && camposDeColumnas.includes(c as keyof Columnas)))
    // el tipo fijo del formulario viaja como constante (un valor que empieza con =, api.md §4.2)
    if (destino === 'environmental_feature' && !llenas.featureType && tipoFijo) llenas.featureType = `=${tipoFijo}`
    return llenas
  }
  const faltaTipo = destino === 'environmental_feature' && !columnas.featureType && !tipoFijo
  const faltaCapa = capasDelArchivo.length > 1 && !capaElegida

  if (formatosDelServidor.isPending) return <Cargando />
  // sin destinos solo porque la organización no tiene el modelo de F6 (la cuenta importa solo a esos): se dice eso, no un
  // permiso que falta
  if (destinos.length === 0) return <Alert tone="warning">{sinModeloDeF6 ? t('importacion.sinModeloDeF6') : t('importacion.sinDestinos')}</Alert>

  const verPrevia = () => {
    if (!archivo || !destino || !proyecto || !crsPropuesto || !confirmado || faltaTipo || faltaCapa) return
    const nombreDeCapa = capaElegida?.name ?? capa
    const pedido: Pedido = { archivo, destino, proyecto, crs: crsPropuesto, columnas: columnasQueViajan(), ...(nombreDeCapa ? { capa: nombreDeCapa } : {}) }
    vistaPrevia.mutate(pedido, {
      onSuccess: (vista) => {
        guardarEnCurso(user?.id, { pedido, vista })
        navegar(`/territory/imports/${encodeURIComponent(vista.importBatchId)}`)
      },
      onError: alFallar
    })
  }
  const leer = () => {
    if (!archivo || !destino || !proyecto) return
    vistaPrevia.reset()
    lectura.mutate({ archivo, destino, proyecto, crs: '', columnas: {} }, { onError: alFallar })
  }
  const describirCapa = (c: CapaDelArchivo) => t('importacion.capaOpcion', { nombre: c.name, tipo: c.geometryType ?? '—', n: c.featureCount ?? '—' })
  // el texto propio de FORMAT_NOT_SUPPORTED nombra los formatos de GDAL: solo con F6; sin él, el de comun.codigos
  const mensajes = {
    NOT_ASSIGNED: t('importacion.errores.NOT_ASSIGNED'),
    ...(conF6 ? { FORMAT_NOT_SUPPORTED: t('importacion.errores.FORMAT_NOT_SUPPORTED') } : {})
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="space-y-2">
        <h1 className="text-sg-h2 font-semibold">{t('importacion.titulo')}</h1>
        <Pasos pasos={pasos} actual={paso} visitados={paso} alIr={setPaso} />
      </div>
      <div className="space-y-4">
        <Alert tone="notice">{t('importacion.nadaEscrito')}</Alert>
        {paso === 0 ? (
          <section className="space-y-3" aria-label={pasos[0]}>
            {sinModeloDeF6 ? <Alert tone="warning">{t('importacion.destinoSinModelo')}</Alert> : null}
            <Campo
              etiqueta={conF6 ? t('importacion.archivoF6') : t('importacion.archivo')}
              ayuda={
                conF6
                  ? t('importacion.formatosDisponibles', {
                      formatos: FORMATOS_EN_ORDEN.filter((f) => disponible(f, formatos))
                        .map((f) => t(`importacion.nombresDeFormato.${f}`))
                        .join(', ')
                    })
                  : undefined
              }
            >
              {(p) => (
                <Input
                  {...p}
                  type="file"
                  accept={aceptaDe(formatos)}
                  onChange={(e) => {
                    setArchivo(e.target.files?.[0] ?? null)
                    // el CRS elegido y confirmado y la capa eran de otro archivo: así se ve lo que propone el nuevo
                    setCrs('')
                    setConfirmadoEn('')
                    setCapa('')
                    vistaPrevia.reset()
                    lectura.reset()
                  }}
                />
              )}
            </Campo>
            {archivo && formato === null ? <Alert tone="warning">{t('importacion.formatoDesconocido')}</Alert> : null}
            {archivo && formato !== null && !formatoUsable ? (
              <Alert tone="warning">{t('importacion.formatoNoDisponible', { formato: t(`importacion.nombresDeFormato.${formato}`) })}</Alert>
            ) : null}
            <Campo etiqueta={t('importacion.destino')} ayuda={destinoVectorial ? t('importacion.soloPoligonos') : undefined}>
              {(p) => (
                <SelectNativo
                  {...p}
                  vacio={false}
                  value={destino}
                  onChange={(e) => {
                    setDestino(e.target.value as Destino)
                    setConfirmadoEn('')
                  }}
                  opciones={destinos.map((d) => ({ valor: d, etiqueta: t(`importacion.destinos.${d}`) }))}
                />
              )}
            </Campo>
            {archivo && destinoVectorial && formato !== null && !vectorial ? <Alert tone="warning">{t('importacion.soloVectorial')}</Alert> : null}
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
                    setConfirmadoEn('')
                  }}
                  opciones={(proyectos.data ?? [])
                    .filter((x) => mios.size === 0 || mios.has(x.id))
                    .map((x) => ({ valor: x.id, etiqueta: `${String(atributo(x, 'code'))} · ${String(atributo(x, 'name'))}` }))}
                />
              )}
            </Campo>
            {proyectos.isPending ? <Cargando /> : null}
            {proyectos.isError && !proyectos.data ? <FalloDeLectura error={proyectos.error} alReintentar={() => void proyectos.refetch()} /> : null}
            <Button disabled={!archivo || !formatoUsable || !destino || !proyecto || (destinoVectorial && !vectorial)} onClick={() => setPaso(1)}>
              {t('comun.siguiente')}
            </Button>
          </section>
        ) : (
          <section className="space-y-3" aria-label={pasos[1]}>
            {definicion.isPending ? <Cargando /> : null}
            {definicion.isError && !definicion.data ? <FalloDeLectura error={definicion.error} alReintentar={() => void definicion.refetch()} /> : null}
            {/* un proyecto de la dirección (un marcador viejo) que ya no se lee responde 404, como uno que no existe (ADR-0029) */}
            {registroDelProyecto.isError && !registroDelProyecto.data ? (
              esIlegible(registroDelProyecto.error) ? (
                <NoEsDeSusProyectos />
              ) : (
                <FalloDeLectura error={registroDelProyecto.error} alReintentar={() => void registroDelProyecto.refetch()} />
              )
            ) : null}
            {porLeer ? (
              <div className="space-y-1">
                <Button variant="secondary" disabled={lectura.isPending || !proyecto} aria-busy={lectura.isPending} onClick={leer}>
                  {lectura.isPending ? t('importacion.leyendo') : t('importacion.leerArchivo')}
                </Button>
                <p className="text-sg-caption text-sg-text-muted">{t('importacion.leerArchivoAyuda')}</p>
                {lectura.isError && leidas.length === 0 ? <Alert tone="danger">{mensaje(lectura.error, mensajes)}</Alert> : null}
              </div>
            ) : null}
            {/* la capa que pide el servidor (LAYER_REQUIRED, por el campo layer del error) */}
            {eleccionPedida(lectura.error) === 'layer' ? <Alert tone="notice">{t('comun.codigos.LAYER_REQUIRED')}</Alert> : null}
            {capasDelArchivo.length === 1 ? (
              <p className="text-sm text-sg-text-secondary">{t('importacion.capaLeida', { capa: describirCapa(capasDelArchivo[0]) })}</p>
            ) : null}
            {capasDelArchivo.length > 1 ? (
              <Campo etiqueta={t('importacion.capa')}>
                {(p) => (
                  <SelectNativo
                    {...p}
                    value={capaElegida?.name ?? ''}
                    onChange={(e) => {
                      setCapa(e.target.value)
                      // otra capa puede proponer otro CRS: lo confirmado vale solo si la propuesta no cambia
                      if (propuestaCon(capaDe(e.target.value)) !== crsPropuesto) setConfirmadoEn('')
                    }}
                    opciones={capasDelArchivo.map((c) => ({ valor: c.name, etiqueta: describirCapa(c) }))}
                  />
                )}
              </Campo>
            ) : null}
            <Campo
              etiqueta={t('importacion.crs')}
              ayuda={fijo ? t('importacion.crsFijo') : delArchivo && !crs ? t('importacion.crsDelArchivo', { crs: delArchivo }) : t('importacion.crsAyuda')}
            >
              {(p) => (
                <SelectNativo
                  {...p}
                  value={crsPropuesto}
                  disabled={Boolean(fijo)}
                  onChange={(e) => {
                    setCrs(e.target.value)
                    setConfirmadoEn('')
                  }}
                  opciones={opcionesDeCrs}
                />
              )}
            </Campo>
            {crsPropuesto ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmadoEn(e.target.checked ? crsPropuesto : '')} />
                {t('importacion.confirmoCrs', { crs: crsPropuesto })}
              </label>
            ) : null}
            <fieldset className="grid gap-3 rounded-sg-lg border border-sg-border p-4 md:grid-cols-3">
              <legend className="px-1 text-sm font-medium">{t('importacion.columnas')}</legend>
              <p className="text-sg-caption text-sg-text-muted md:col-span-3">{t('importacion.columnasAyuda')}</p>
              {camposDeColumnas.map((c) => (
                <Campo key={c} etiqueta={t(`importacion.columna.${c}`)}>
                  {(p) => <Input {...p} value={columnas[c] ?? ''} onChange={(e) => setColumnas({ ...columnas, [c]: e.target.value })} />}
                </Campo>
              ))}
              {destino === 'environmental_feature' ? (
                <Campo etiqueta={t('importacion.tipoFijo')} error={faltaTipo && confirmado ? t('importacion.tipoFalta') : undefined}>
                  {(p) => <SelectNativo {...p} value={tipoFijo} onChange={(e) => setTipoFijo(e.target.value)} opciones={tiposDeElemento} />}
                </Campo>
              ) : null}
            </fieldset>
            {vistaPrevia.isError ? (
              <Alert tone={capasDelArchivo.length > 0 ? 'notice' : 'danger'}>
                {mensaje(vistaPrevia.error, mensajes)}
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
              <Button disabled={!crsPropuesto || !confirmado || faltaTipo || faltaCapa || vistaPrevia.isPending} onClick={verPrevia}>
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
  // IMPORT_CONFLICT o el CRS del archivo: la vista previa se repite, con el mismo pedido (lo registrado cambió y no se escribió
  // nada) o con el CRS que declara el archivo
  const previsualizarCon = (otro: Pedido) =>
    otraVistaPrevia.mutate(otro, {
      onSuccess: (nueva) => {
        guardarEnCurso(user?.id, { pedido: otro, vista: nueva })
        setDecisiones({})
        setClave(nuevaClave())
        confirmacion.reset()
        navegar(`/territory/imports/${encodeURIComponent(nueva.importBatchId)}`)
      }
    })
  const previsualizarOtraVez = () => previsualizarCon(pedido)
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
    <div className="mx-auto grid max-w-[1200px] gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="space-y-2">
        <h1 className="text-sg-h2 font-semibold">{t('importacion.titulo')}</h1>
        <Pasos pasos={pasos} actual={2} visitados={2} />
      </div>
      <div className="space-y-4">
        <Alert tone="notice">{t('importacion.nadaEscrito')}</Alert>
        <p className="font-sg-mono text-sg-caption text-sg-text-muted">
          {pedido.archivo.name}
          {vista.layer ? ` · ${vista.layer}` : ''} · {pedido.crs} · SHA-256 {vista.sha256}
        </p>
        <CrsDetectado vista={vista} pedido={pedido} alUsar={(otro) => previsualizarCon({ ...pedido, crs: otro })} ocupado={otraVistaPrevia.isPending} />
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
        <Link to={`/projects/${encodeURIComponent(pedido.proyecto)}/map`}>{t('importacion.volverAlMapa')}</Link>
      </Button>
    </section>
  )
}

// el CRS que declara el archivo (decisión 16 del plan 6.3), siempre un valor del catálogo o null: se muestra como propuesta; si
// difiere del elegido, «Usar el CRS del archivo» repite la vista previa con él, y ese clic es la confirmación (CON-024)
function CrsDetectado({ vista, pedido, alUsar, ocupado }: { vista: VistaPrevia; pedido: Pedido; alUsar: (crs: string) => void; ocupado: boolean }) {
  const { t } = useTranslation(NS)
  const definicion = useDefinicion(pedido.destino)
  if (!vista.detectedCrs) return null
  const opciones = definicion.data?.fields.find((f) => f.name === 'source_crs')?.enumOptions ?? []
  const opcion = opcionDeCrs(vista.detectedCrs, opciones)
  if (vista.detectedCrs === pedido.crs)
    return <p className="text-sm text-sg-text-muted">{t('importacion.crsDetectadoIgual', { detectado: vista.detectedCrs })}</p>
  return (
    <Alert tone="warning">
      {t('importacion.crsDetectado', { detectado: vista.detectedCrs, elegido: pedido.crs })}
      {opcion ? (
        <Button variant="secondary" size="sm" className="ml-2" disabled={ocupado} onClick={() => alUsar(opcion)}>
          {t('importacion.usarCrsDetectado')}
        </Button>
      ) : null}
    </Alert>
  )
}

// deja la pestaña sin importación en curso: al confirmar, al empezar de nuevo y en las pruebas
export const reiniciarImportacion = () => {
  enCurso.estado = null
  enCurso.usuario = null
}
