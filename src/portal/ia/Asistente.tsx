import { ApiError } from '@wasichai/core'
import { Alert, Button, cn, Textarea } from '@wasichai/ui'
import { Sparkles } from 'lucide-react'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Campo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { Cargando } from '../componentes/Estados'
import { LimiteDeError } from '../componentes/LimiteDeError'
import { correlacionDe, useMensajeDeError } from '../componentes/errores'
import { rutaParaAbrir } from '../datos/fichas'
import { campoDelError, codigoDelError } from '../datos/http'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { AvisoDeIa } from './AvisoDeIa'
import {
  disponibilidadDe,
  useEstadoDeIa,
  usePreguntarALosDatos,
  usePreguntarALosDocumentos,
  type Disponibilidad,
  type PasoDelAsistente,
  type RespuestaConCitas,
  type RespuestaDelAsistente
} from './contrato'
import { ProyectoDeLaPregunta, RespuestaConFuentes } from './Documentos'
import { MarcaDeIa } from './MarcaDeIa'
import { TextoDeIa } from './TextoDeIa'

// S05 · el panel del asistente (screens.md §13, flujo 18). no es una sección (ASM-073): el AppShell monta el proveedor, el
// botón «Preguntar» lo abre global y una ficha lo abre con su registro como contexto (ux-architecture.md §7.5). el asistente lee
// como la persona y nunca escribe; su respuesta llega restaurada, salvo los campos restringidos, que quedan como marcador
export type ModoDelAsistente = 'datos' | 'documentos'

export interface ContextoDelAsistente {
  modo?: ModoDelAsistente
  proyecto?: string
  registro?: { objeto: string; id: string; rotulo: string }
}

interface ValorDelAsistente {
  abrir: (contexto?: ContextoDelAsistente) => void
}

const Contexto = createContext<ValorDelAsistente | null>(null)

// null fuera del AppShell (las pruebas de una pantalla sola): quien abre el asistente no se dibuja
export const useAsistente = (): ValorDelAsistente | null => useContext(Contexto)

function FalloDelAsistente({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const { t } = useTranslation(NS)
  return (
    <Drawer titulo={t('asistente.titulo')} abierto={abierto} alCerrar={alCerrar}>
      <Alert tone="danger">{t('asistente.fallo')}</Alert>
    </Drawer>
  )
}

export function ProveedorDelAsistente({ children }: { children: ReactNode }) {
  const { t } = useTranslation(NS)
  const [abierto, setAbierto] = useState(false)
  const [contexto, setContexto] = useState<ContextoDelAsistente>({})
  // cada apertura cuenta: el panel prellena la pregunta y elige el modo al abrirse, no en cada render
  const [vez, setVez] = useState(0)
  const valor = useMemo<ValorDelAsistente>(
    () => ({
      abrir: (nuevo = {}) => {
        setContexto(nuevo)
        setVez((v) => v + 1)
        setAbierto(true)
      }
    }),
    []
  )
  return (
    <Contexto.Provider value={valor}>
      {children}
      {/* un fallo del panel no tumba el shell que lo contiene (D1): lo dice en el drawer y cada apertura lo intenta de nuevo */}
      <LimiteDeError key={vez} mensaje={t('asistente.fallo')} alternativa={<FalloDelAsistente abierto={abierto} alCerrar={() => setAbierto(false)} />}>
        <PanelDelAsistente abierto={abierto} contexto={contexto} vez={vez} alCerrar={() => setAbierto(false)} />
      </LimiteDeError>
    </Contexto.Provider>
  )
}

// el botón de la barra superior: solo si el servidor tiene la IA (decisión 3 del plan); el panel dice el resto
export function BotonPreguntar() {
  const { t } = useTranslation(NS)
  const estado = useEstadoDeIa()
  const asistente = useAsistente()
  const { scope } = useContextFilters()
  if (!estado.data || !asistente) return null
  return (
    <button
      type="button"
      onClick={() => asistente.abrir({ proyecto: scope.kind === 'project' ? scope.projectId : undefined })}
      title={t('shell.preguntar')}
      className="flex h-8 items-center gap-1.5 rounded-sg-md border border-dashed border-sg-ai-border bg-sg-ai-soft px-2.5 text-sg-body-sm text-sg-ai hover:bg-sg-surface-hover"
    >
      <Sparkles aria-hidden className="size-4" />
      {/* en el teléfono, solo el ícono: la barra superior no da para más (el nombre sigue para lectores y en title) */}
      <span className="sr-only sm:not-sr-only">{t('shell.preguntar')}</span>
    </button>
  )
}

export interface Turno<R, V> {
  id: number
  pregunta: string
  valor: V
  respuesta?: R
  error?: unknown
}

// la conversación de un modo: vive en el panel, que no se desmonta al cerrar el drawer
export function useConversacion<V, R>(enviar: (valor: V) => Promise<R>) {
  const [turnos, setTurnos] = useState<Turno<R, V>[]>([])
  const [enCurso, setEnCurso] = useState(false)
  const siguiente = useRef(0)
  const preguntar = async (pregunta: string, valor: V) => {
    const id = ++siguiente.current
    setTurnos((ts) => [...ts, { id, pregunta, valor }])
    setEnCurso(true)
    try {
      const respuesta = await enviar(valor)
      setTurnos((ts) => ts.map((x) => (x.id === id ? { ...x, respuesta } : x)))
    } catch (error) {
      setTurnos((ts) => ts.map((x) => (x.id === id ? { ...x, error } : x)))
    } finally {
      setEnCurso(false)
    }
  }
  return { turnos, enCurso, preguntar }
}

// los registros que el asistente leyó, por la entrada de cada paso ({ object, id } en wasichai-agent), sin repetir
export function registrosConsultados(pasos: PasoDelAsistente[]): { objeto: string; id: string; ruta: string }[] {
  const vistos = new Map<string, { objeto: string; id: string; ruta: string }>()
  for (const paso of pasos) {
    const objeto = paso.input.object ?? paso.input.objectName
    const id = paso.input.id ?? paso.input.recordId
    if (typeof objeto !== 'string' || typeof id !== 'string') continue
    const ruta = rutaParaAbrir(objeto, id)
    if (!vistos.has(ruta)) vistos.set(ruta, { objeto, id, ruta })
  }
  return [...vistos.values()]
}

export function RespuestaDeDatos({ respuesta }: { respuesta: RespuestaDelAsistente }) {
  const { t } = useTranslation(NS)
  const enlaces = registrosConsultados(respuesta.steps)
  return (
    <article className="space-y-2 rounded-sg-md border border-dashed border-sg-ai-border bg-sg-ai-soft p-3 text-sm">
      <MarcaDeIa clase="resumen" />
      {/* truncada, el servidor responde un aviso fijo en español: el portal dice el suyo y no repite ambos */}
      {respuesta.truncated ? <Alert tone="warning">{t('asistente.truncada')}</Alert> : <TextoDeIa texto={respuesta.answer} markdown />}
      {enlaces.length > 0 ? (
        <ul className="space-y-1">
          {enlaces.map((e, i) => (
            <li key={e.ruta}>
              <Link to={e.ruta} className="text-sg-primary-text underline">
                {t('asistente.registroConsultado', { n: i + 1 })}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <details>
        <summary className="cursor-pointer text-sg-caption text-sg-text-secondary">{t('asistente.comoLoObtuvo', { n: respuesta.steps.length })}</summary>
        {respuesta.steps.length === 0 ? (
          <p className="text-sg-caption">{t('asistente.sinPasos')}</p>
        ) : (
          <ol className="ml-5 list-decimal space-y-1 text-sg-caption">
            {respuesta.steps.map((paso, i) => (
              <li key={i}>
                <span className="font-sg-mono">{paso.tool}</span> · <TextoDeIa texto={paso.summary} />
              </li>
            ))}
          </ol>
        )}
      </details>
    </article>
  )
}

function FalloDePregunta({ error, alRepetir }: { error: unknown; alRepetir: () => void }) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  const correlacion = correlacionDe(error)
  // un 403 es el permiso que falta (sin código, como el de AgentHttpGate), salvo PERSON_REQUIRED, que dice su texto: una cuenta
  // de servicio no pregunta
  const sinRol = error instanceof ApiError && error.status === 403 && codigoDelError(error) !== 'PERSON_REQUIRED'
  // se repite lo que puede cambiar: el proveedor caído, otra falla del servidor o de la red; nunca la organización sin IA
  const repetible = !(error instanceof ApiError) || (error.status >= 500 && campoDelError(error) !== 'organization')
  return (
    <Alert tone="danger">
      {/* solo la pregunta a los documentos responde 404: el proyecto no existe o la cuenta no lo lee (api.md §4.14) */}
      <p>{sinRol ? t('ia.sinIa.rol') : mensaje(error, { '404': t('asistente.proyectoNoLegible') })}</p>
      {correlacion ? <p className="font-sg-mono text-sg-caption">{t('comun.correlacion', { id: correlacion })}</p> : null}
      {repetible ? (
        <Button size="sm" variant="secondary" className="mt-2" onClick={alRepetir}>
          {t('asistente.volverAPreguntar')}
        </Button>
      ) : null}
    </Alert>
  )
}

export function Conversacion<R, V>({
  turnos,
  vacio,
  dibujar,
  alRepetir
}: {
  turnos: Turno<R, V>[]
  vacio: string
  dibujar: (respuesta: R) => ReactNode
  alRepetir: (turno: Turno<R, V>) => void
}) {
  const { t } = useTranslation(NS)
  if (turnos.length === 0) return <p className="text-sm text-sg-text-secondary">{vacio}</p>
  return (
    <ol aria-label={t('asistente.titulo')} className="space-y-4">
      {turnos.map((turno) => (
        <li key={turno.id} className="space-y-2">
          <p className="ml-8 whitespace-pre-line rounded-sg-md bg-sg-primary-soft p-2 text-sm">
            <span className="sr-only">{t('asistente.usted')}: </span>
            {turno.pregunta}
          </p>
          {turno.respuesta !== undefined ? (
            dibujar(turno.respuesta)
          ) : turno.error !== undefined ? (
            <FalloDePregunta error={turno.error} alRepetir={() => alRepetir(turno)} />
          ) : (
            <Cargando compacto etiqueta={t('asistente.preguntando')} />
          )}
        </li>
      ))}
    </ol>
  )
}

export function FormularioDePregunta({
  disponibilidad,
  documentos = false,
  borrador,
  alCambiar,
  enCurso,
  listo = true,
  alPreguntar,
  alReintentarEstado,
  children
}: {
  disponibilidad: Disponibilidad
  documentos?: boolean
  borrador: string
  alCambiar: (texto: string) => void
  enCurso: boolean
  // falta algo además de la pregunta (el proyecto de los documentos)
  listo?: boolean
  alPreguntar: (pregunta: string) => void
  alReintentarEstado: () => void
  children?: ReactNode
}) {
  const { t } = useTranslation(NS)
  const [vacia, setVacia] = useState(false)
  if (!disponibilidad.disponible) return <AvisoDeIa motivo={disponibilidad.motivo} documentos={documentos} alReintentar={alReintentarEstado} />
  return (
    <form
      className="space-y-2 border-t border-sg-border pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        const pregunta = borrador.trim()
        if (!pregunta) {
          setVacia(true)
          return
        }
        setVacia(false)
        alCambiar('')
        alPreguntar(pregunta)
      }}
    >
      {children}
      <Campo etiqueta={t('asistente.pregunta')} error={vacia ? t('asistente.vacia') : undefined} ayuda={t('asistente.soloLectura')}>
        {(p) => <Textarea {...p} value={borrador} maxLength={4000} onChange={(e) => alCambiar(e.target.value)} />}
      </Campo>
      <Button type="submit" disabled={enCurso || !listo} aria-busy={enCurso}>
        {enCurso ? t('asistente.preguntando') : t('asistente.preguntar')}
      </Button>
    </form>
  )
}

export function PanelDelAsistente({
  abierto,
  contexto,
  vez,
  alCerrar
}: {
  abierto: boolean
  contexto: ContextoDelAsistente
  vez: number
  alCerrar: () => void
}) {
  const { t } = useTranslation(NS)
  const estado = useEstadoDeIa()
  const { scope } = useContextFilters()
  const aLosDatos = usePreguntarALosDatos()
  const aLosDocumentos = usePreguntarALosDocumentos()
  const datos = useConversacion((pregunta: string) => aLosDatos.mutateAsync(pregunta))
  const documentos = useConversacion((valor: { pregunta: string; proyecto: string }) => aLosDocumentos.mutateAsync(valor))
  const [modo, setModo] = useState<ModoDelAsistente>('datos')
  const [borrador, setBorrador] = useState('')
  const [proyecto, setProyecto] = useState('')
  // al abrir: el modo pedido, el proyecto del contexto o de la ruta, y la pregunta prellenada desde una ficha (decisión 6)
  useEffect(() => {
    setModo(contexto.modo ?? 'datos')
    setProyecto(contexto.proyecto ?? (scope.kind === 'project' ? scope.projectId : ''))
    if (contexto.registro) setBorrador(t('asistente.sobreElRegistro', { objeto: contexto.registro.objeto, id: contexto.registro.id }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vez])
  // flujo 18: quien no lee los nombres de las personas solo ve «Preguntar a los datos» (decisión 5)
  const ofreceDocumentos = estado.data?.useCases.includes('AI-06') ?? false
  const enDocumentos = modo === 'documentos' && ofreceDocumentos
  const disponibilidad: Disponibilidad = estado.isPending
    ? { disponible: false, motivo: 'cargando' }
    : disponibilidadDe(estado.data, enDocumentos ? 'AI-06' : 'AI-05')
  return (
    <Drawer titulo={t('asistente.titulo')} abierto={abierto} alCerrar={alCerrar}>
      {contexto.registro ? <p className="text-sg-caption text-sg-text-secondary">{t('asistente.contexto', { contexto: contexto.registro.rotulo })}</p> : null}
      {ofreceDocumentos ? (
        <div role="tablist" aria-label={t('asistente.titulo')} className="flex gap-1 border-b border-sg-border">
          {(['datos', 'documentos'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={modo === m}
              onClick={() => setModo(m)}
              className={cn(
                'border-b-2 px-3 py-2 text-sm',
                modo === m ? 'border-sg-primary font-medium text-sg-primary-text' : 'border-transparent text-sg-text-secondary'
              )}
            >
              {t(`asistente.modos.${m}`)}
            </button>
          ))}
        </div>
      ) : null}
      {enDocumentos ? (
        <Conversacion
          turnos={documentos.turnos}
          vacio={t('asistente.inicioDocumentos')}
          dibujar={(respuesta: RespuestaConCitas) => <RespuestaConFuentes respuesta={respuesta} />}
          alRepetir={(turno) => void documentos.preguntar(turno.pregunta, turno.valor)}
        />
      ) : (
        <Conversacion
          turnos={datos.turnos}
          vacio={t('asistente.inicio')}
          dibujar={(respuesta) => <RespuestaDeDatos respuesta={respuesta} />}
          alRepetir={(turno) => void datos.preguntar(turno.pregunta, turno.valor)}
        />
      )}
      <FormularioDePregunta
        disponibilidad={disponibilidad}
        documentos={enDocumentos}
        borrador={borrador}
        alCambiar={setBorrador}
        enCurso={enDocumentos ? documentos.enCurso : datos.enCurso}
        listo={!enDocumentos || proyecto !== ''}
        alPreguntar={(pregunta) => void (enDocumentos ? documentos.preguntar(pregunta, { pregunta, proyecto }) : datos.preguntar(pregunta, pregunta))}
        alReintentarEstado={() => void estado.refetch()}
      >
        {enDocumentos ? <ProyectoDeLaPregunta valor={proyecto} alCambiar={setProyecto} /> : null}
      </FormularioDePregunta>
    </Drawer>
  )
}
