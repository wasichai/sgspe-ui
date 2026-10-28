import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth, type FieldMeta } from '@wasichai/core'
import { Alert, Button, Table, Td, Th } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { usePedir } from '../datos/http'
import { campoDe, texto, useDefinicion, usePuedeEditar, useTodosConTope, type Parametros, type Registro } from '../datos/registros'
import { diaPe, fechaYHoraPe, NS, numeroPe } from '../i18n'
import { AvisoDeConflicto, useReleer } from './AvisoDeConflicto'
import { CajaDeBusqueda } from './BarraDeFiltros'
import { CLASE_DE_TONO } from './apariencias'
import { Drawer } from './Drawer'
import type { MensajesPropios } from './errores'
import { Cargando, Vacio } from './Estados'
import { FormularioDeRegistro } from './FormularioDeRegistro'
import { comparable } from './FiltroDeGrupo'
import { FalloDeLectura } from './LecturaConEstados'
import { VacioDeLista } from './Lista'
import { RegistroVinculado } from './RegistroVinculado'
import { opcion } from '../datos/opciones'

// los registros de F4 sin workflow que se llevan a mano en una lista con su formulario (menciones, señales, reglas, impactos y
// medidas; screens.md S58 a S61 y S40): la lista del alcance con tope (avisa si recorta), «+ Nuevo» para quien crea y escribe en
// el proyecto, y un drawer por registro con el formulario de la metadata (FormularioDeRegistro: If-Match, derivados fuera, un 412
// con «Recargar») o sus datos en solo lectura, y «Borrar» para quien borra. un borrado rechazado (HAS_DEPENDENTS) se dice con su
// texto o con el propio de la pantalla. el registro abierto puede venir de la ruta (abierto y alAbrir) o vivir en la pantalla.
// desde F5, también los hijos de un aporte y de un programa, con valores propuestos (iniciales), una lista que ya no cambia
// (congelado) y lo que la pantalla deja viejo al escribir (alCambiar)
export interface ColumnaSimple {
  id: string
  encabezado: string
  celda: (registro: Registro) => ReactNode
}

export interface RegistrosSimplesProps {
  objeto: string
  titulo: string
  // la consulta de la lista (por igualdad): el proyecto, el riesgo de una medida
  filtros: Parametros
  // lo que el alta fija y no se muestra: el proyecto, el riesgo
  fijos: Record<string, unknown>
  columnas: ColumnaSimple[]
  // los campos del formulario, en su orden
  campos: readonly string[]
  // el proyecto cuya asignación vigente pide la escritura (useEscribeEnProyecto); sin él, solo los permisos
  proyecto?: string
  abierto?: string | null
  alAbrir?: (id: string | null) => void
  textoNuevo: string
  textoVacio: string
  // lo que el drawer dice antes del formulario (qué significa cada dato)
  ayuda?: ReactNode
  // lo que se dice al rechazar un borrado, por código
  mensajesAlBorrar?: MensajesPropios
  // valores propuestos en el alta (FormularioDeRegistro.iniciales)
  iniciales?: Record<string, unknown>
  // por qué la lista ya no cambia (los ítems de un aporte fuera de requested): sin «Nuevo», sin formulario y sin «Borrar», con
  // este texto a la vista. el servidor lo juzga igual (ITEMS_FROZEN): esto solo no ofrece lo que rechazaría
  congelado?: string
  // tras crear, cambiar o borrar: lo que la pantalla deja viejo además de la lista (el total de un aporte, su consulta en seco)
  alCambiar?: () => void
  // lo que el drawer de un registro suma debajo de sus datos (las acciones de IA de una mención, F7)
  delRegistro?: (registro: Registro) => ReactNode
  // tras crear uno, el drawer queda abierto con el formulario vacío para el siguiente (los ítems de un aporte; tercera pasada de
  // UX, 2.11): dice que se agregó y ofrece «Listo» para cerrar
  conOtro?: boolean
  // una lista de página (señales, menciones, impactos) busca en lo leído por el texto de cada registro, con ?q= en la URL
  // (tercera pasada de UX, 3.7 y 3.8): volver de un registro conserva la búsqueda. una lista dentro de una ficha no la lleva
  busqueda?: { etiqueta: string; texto: (registro: Registro) => string }
}

const NUEVO = '__nuevo__'

export function RegistrosSimples(props: RegistrosSimplesProps) {
  const { objeto, titulo, filtros, columnas, proyecto, textoNuevo, textoVacio } = props
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const escribe = useEscribeEnProyecto(proyecto)
  const lista = useTodosConTope(objeto, filtros)
  const [parametros, fijarParametros] = useSearchParams()
  const q = props.busqueda ? (parametros.get('q') ?? '') : ''
  const buscado = comparable(q.trim())
  const filas = (lista.data ?? []).filter((r) => !buscado || !props.busqueda || comparable(props.busqueda.texto(r)).includes(buscado))
  const buscar = (valor: string) => {
    const siguiente = new URLSearchParams(parametros)
    if (valor.trim()) siguiente.set('q', valor)
    else siguiente.delete('q')
    fijarParametros(siguiente, { replace: true })
  }
  const [propio, setPropio] = useState<string | null>(null)
  const abierto = props.alAbrir ? (props.abierto ?? null) : propio
  const abrir = props.alAbrir ?? setPropio
  const crea = escribe && can(objeto, 'CREATE') && !props.congelado
  const registro = abierto && abierto !== NUEVO ? lista.data?.find((r) => r.id === abierto) : undefined
  // con conOtro, cuántos se agregaron en esta apertura del drawer: cada uno vuelve a montar el formulario vacío
  const [agregados, setAgregados] = useState(0)
  const cerrarAlta = () => {
    setAgregados(0)
    abrir(null)
  }
  return (
    <section aria-label={titulo} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sg-h3 font-semibold">{titulo}</h2>
        {/* una acción de la lista, secundaria: la primaria de la ficha que la contiene es su siguiente acción (P-09 y DD-02 del
            rediseño de UX, una sola primaria por ficha) */}
        {crea ? (
          <Button size="sm" variant="secondary" onClick={() => abrir(NUEVO)}>
            {textoNuevo}
          </Button>
        ) : null}
      </div>
      {props.congelado ? <p className="text-sm text-sg-text-muted">{props.congelado}</p> : null}
      {lista.truncado ? <Alert tone="warning">{t('piezas.registros.truncado', { n: numeroPe(lista.data?.length ?? 0) })}</Alert> : null}
      {lista.isPending ? (
        <Cargando compacto />
      ) : lista.isError && !lista.data ? (
        <FalloDeLectura error={lista.error} alReintentar={() => void lista.refetch()} />
      ) : (lista.data ?? []).length === 0 ? (
        <Vacio titulo={textoVacio} />
      ) : (
        <>
          {props.busqueda ? <CajaDeBusqueda etiqueta={props.busqueda.etiqueta} valor={q} alCambiar={buscar} /> : null}
          {filas.length === 0 ? (
            <VacioDeLista conFiltros alLimpiar={() => buscar('')} sinFiltros={lista.data?.length} />
          ) : (
            <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
              <Table aria-label={titulo}>
                <thead>
                  <tr>
                    {columnas.map((c) => (
                      <Th key={c.id} scope="col">
                        {c.encabezado}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((r) => (
                    <tr key={r.id}>
                      {columnas.map((c, i) => (
                        <Td key={c.id} className="text-sm">
                          {i === 0 ? (
                            <button type="button" className="text-left text-sg-primary-text underline" onClick={() => abrir(r.id)}>
                              {c.celda(r)}
                            </button>
                          ) : (
                            c.celda(r)
                          )}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </>
      )}
      {/* el alta pedida por la ruta (abierto='__nuevo__') solo se abre para quien crea: una lista congelada no la ofrece */}
      <Drawer titulo={abierto === NUEVO ? textoNuevo : titulo} abierto={(abierto === NUEVO && crea) || registro !== undefined} alCerrar={cerrarAlta}>
        {props.ayuda}
        {abierto === NUEVO && crea ? (
          <>
            {agregados > 0 ? (
              <div className={`flex flex-wrap items-center justify-between gap-2 rounded-sg-md px-3 py-2 text-sm ${CLASE_DE_TONO.success}`}>
                <p role="status">{t('piezas.registros.agregado')}</p>
                <Button size="sm" variant="secondary" onClick={cerrarAlta}>
                  {t('piezas.registros.listo')}
                </Button>
              </div>
            ) : null}
            <FormularioDeRegistro
              key={agregados}
              objeto={objeto}
              fijos={props.fijos}
              iniciales={props.iniciales}
              campos={props.campos}
              alGuardar={() => {
                props.alCambiar?.()
                if (props.conOtro) setAgregados((n) => n + 1)
                else cerrarAlta()
              }}
              alCancelar={cerrarAlta}
            />
          </>
        ) : registro ? (
          <DelRegistro key={registro.id} {...props} registro={registro} escribe={escribe} alCerrar={() => abrir(null)} />
        ) : null}
      </Drawer>
    </section>
  )
}

function DelRegistro({
  objeto,
  campos,
  registro,
  escribe,
  mensajesAlBorrar,
  congelado,
  alCambiar,
  delRegistro,
  alCerrar
}: RegistrosSimplesProps & { registro: Registro; escribe: boolean; alCerrar: () => void }) {
  const { can } = useAuth()
  const edita = usePuedeEditar(objeto) && escribe && !congelado
  const terminar = () => {
    alCambiar?.()
    alCerrar()
  }
  return (
    <div className="space-y-4">
      {edita ? (
        <FormularioDeRegistro objeto={objeto} registro={registro} campos={campos} alGuardar={terminar} alCancelar={alCerrar} />
      ) : (
        <SoloLectura objeto={objeto} campos={campos} registro={registro} />
      )}
      {delRegistro?.(registro)}
      {escribe && !congelado && can(objeto, 'DELETE') ? <Borrar objeto={objeto} registro={registro} propios={mensajesAlBorrar} alBorrar={terminar} /> : null}
    </div>
  )
}

// los datos del registro para quien no los cambia: la etiqueta de la metadata y el valor como se lee (una relación, por su rótulo);
// un campo que la cuenta no lee no llega y no se muestra
function SoloLectura({ objeto, campos, registro }: { objeto: string; campos: readonly string[]; registro: Registro }) {
  const definicion = useDefinicion(objeto)
  if (definicion.isPending) return <Cargando compacto />
  if (definicion.isError && !definicion.data) return <FalloDeLectura error={definicion.error} alReintentar={() => void definicion.refetch()} />
  const legibles = campos.map((c) => campoDe(definicion.data, c)).filter((f): f is FieldMeta => f !== undefined)
  return (
    <dl className="space-y-2 text-sm">
      {legibles.map((f) => (
        <div key={f.name}>
          <dt className="text-sg-caption text-sg-text-muted">{f.label}</dt>
          <dd className="whitespace-pre-line">
            <Valor campo={f} registro={registro} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Valor({ campo, registro }: { campo: FieldMeta; registro: Registro }) {
  const { t } = useTranslation(NS)
  const valor = registro.attributes[campo.name]
  if (valor === null || valor === undefined || valor === '') return <>—</>
  if (campo.type === 'RELATION' && campo.relationTarget) return <RegistroVinculado objeto={campo.relationTarget} id={String(valor)} />
  if (campo.type === 'BOOLEAN') return <>{valor === true ? t('comun.si') : t('comun.no')}</>
  if (campo.type === 'DATE') return <>{diaPe(String(valor))}</>
  if (campo.type === 'DATETIME') return <>{fechaYHoraPe(new Date(String(valor)))}</>
  if (campo.type === 'ENUM') return <>{opcion(registro, campo.name)}</>
  return <>{texto(registro, campo.name)}</>
}

// borrar con la versión leída (If-Match): HAS_DEPENDENTS (una regla con alertas) se dice con el texto propio de la pantalla
function Borrar({ objeto, registro, propios, alBorrar }: { objeto: string; registro: Registro; propios?: MensajesPropios; alBorrar: () => void }) {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  const cliente = useQueryClient()
  const releer = useReleer()
  const [confirmando, setConfirmando] = useState(false)
  const borrar = useMutation({
    mutationFn: () => pedir(`/objects/${objeto}/records/${encodeURIComponent(registro.id)}`, { metodo: 'DELETE', version: registro.updatedAt }),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['records', objeto] })
      alBorrar()
    }
  })
  return (
    <div className="space-y-2 border-t border-sg-border pt-3">
      {borrar.isError ? (
        <AvisoDeConflicto error={borrar.error} propios={propios} releer={() => releer(['records', objeto])} alRecargar={() => borrar.reset()} />
      ) : null}
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{t('piezas.registros.borrarConfirmar')}</span>
          <Button size="sm" variant="secondary" onClick={() => borrar.mutate()} disabled={borrar.isPending} aria-busy={borrar.isPending}>
            {borrar.isPending ? t('piezas.registros.borrando') : t('piezas.registros.borrar')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmando(false)}>
            {t('comun.cancelar')}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setConfirmando(true)}>
          {t('piezas.registros.borrar')}
        </Button>
      )}
    </div>
  )
}
