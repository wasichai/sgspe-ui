import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth, type FieldMeta } from '@wasichai/core'
import { Alert, Button, Table, Td, Th } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { usePedir } from '../datos/http'
import { campoDe, texto, useDefinicion, usePuedeEditar, useTodosConTope, type Parametros, type Registro } from '../datos/registros'
import { diaPe, fechaYHoraPe, NS, numeroPe } from '../i18n'
import { AvisoDeConflicto, useReleer } from './AvisoDeConflicto'
import { Drawer } from './Drawer'
import type { MensajesPropios } from './errores'
import { Cargando, Vacio } from './Estados'
import { FormularioDeRegistro } from './FormularioDeRegistro'
import { FalloDeLectura } from './LecturaConEstados'
import { RegistroVinculado } from './RegistroVinculado'

// los registros de F4 sin workflow que se llevan a mano en una lista con su formulario (menciones, señales, reglas, impactos y
// medidas; screens.md S58 a S61 y S40): la lista del alcance con tope (avisa si recorta), «+ Nuevo» para quien crea y escribe en
// el proyecto, y un drawer por registro con el formulario de la metadata (FormularioDeRegistro: If-Match, derivados fuera, un 412
// con «Recargar») o sus datos en solo lectura, y «Borrar» para quien borra. un borrado rechazado (HAS_DEPENDENTS) se dice con su
// texto o con el propio de la pantalla. el registro abierto puede venir de la ruta (abierto y alAbrir) o vivir en la pantalla
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
}

const NUEVO = '__nuevo__'

export function RegistrosSimples(props: RegistrosSimplesProps) {
  const { objeto, titulo, filtros, columnas, proyecto, textoNuevo, textoVacio } = props
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const escribe = useEscribeEnProyecto(proyecto)
  const lista = useTodosConTope(objeto, filtros)
  const [propio, setPropio] = useState<string | null>(null)
  const abierto = props.alAbrir ? (props.abierto ?? null) : propio
  const abrir = props.alAbrir ?? setPropio
  const crea = escribe && can(objeto, 'CREATE')
  const registro = abierto && abierto !== NUEVO ? lista.data?.find((r) => r.id === abierto) : undefined
  return (
    <section aria-label={titulo} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sg-h3 font-semibold">{titulo}</h2>
        {crea ? (
          <Button size="sm" onClick={() => abrir(NUEVO)}>
            {textoNuevo}
          </Button>
        ) : null}
      </div>
      {lista.truncado ? <Alert tone="warning">{t('piezas.registros.truncado', { n: numeroPe(lista.data?.length ?? 0) })}</Alert> : null}
      {lista.isPending ? (
        <Cargando compacto />
      ) : lista.isError && !lista.data ? (
        <FalloDeLectura error={lista.error} alReintentar={() => void lista.refetch()} />
      ) : (lista.data ?? []).length === 0 ? (
        <Vacio titulo={textoVacio} />
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
              {(lista.data ?? []).map((r) => (
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
      <Drawer titulo={abierto === NUEVO ? textoNuevo : titulo} abierto={abierto === NUEVO || registro !== undefined} alCerrar={() => abrir(null)}>
        {props.ayuda}
        {abierto === NUEVO ? (
          <FormularioDeRegistro objeto={objeto} fijos={props.fijos} campos={props.campos} alGuardar={() => abrir(null)} alCancelar={() => abrir(null)} />
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
  alCerrar
}: RegistrosSimplesProps & { registro: Registro; escribe: boolean; alCerrar: () => void }) {
  const { can } = useAuth()
  const edita = usePuedeEditar(objeto) && escribe
  return (
    <div className="space-y-4">
      {edita ? (
        <FormularioDeRegistro objeto={objeto} registro={registro} campos={campos} alGuardar={alCerrar} alCancelar={alCerrar} />
      ) : (
        <SoloLectura objeto={objeto} campos={campos} registro={registro} />
      )}
      {escribe && can(objeto, 'DELETE') ? <Borrar objeto={objeto} registro={registro} propios={mensajesAlBorrar} alBorrar={alCerrar} /> : null}
    </div>
  )
}

// los datos del registro para quien no los cambia: la etiqueta de la metadata y el valor como se lee (una relación, por su rótulo);
// un campo que la cuenta no lee no llega y no se muestra
function SoloLectura({ objeto, campos, registro }: { objeto: string; campos: readonly string[]; registro: Registro }) {
  const definicion = useDefinicion(objeto)
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
