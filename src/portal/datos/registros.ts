import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuth, useObjectDefinition, type FieldMeta, type ObjectDefinition, type RecordItem } from '@wasichai/core'
import { useRef } from 'react'
import { enviarComando, esClaveReusada, type Esperar } from './comandos'
import { esDeComando, esDerivado } from './derivados'
import { nuevaClave, usePedir, type Pedido } from './http'

// los registros por la API genérica de wasichai (api.md §2): la forma { id, createdAt, updatedAt, state, attributes,
// geometries }, la página { content, page, size, totalElements, totalPages, nextCursor } y las mismas claves de consulta
// que core (['records', objeto, consulta], ['record', objeto, id]) para que una escritura invalide lo de los dos

export interface Geometria {
  type: string
  coordinates: unknown
}

export interface Registro extends RecordItem {
  state?: string | null
  geometries?: Record<string, Geometria | null>
}

export interface Pagina<T = Registro> {
  content: T[]
  page: number
  size: number
  totalElements: number | null
  totalPages: number | null
  nextCursor?: string | null
}

export type ValorDeParametro = string | number | boolean | null | undefined | readonly string[]
export type Parametros = Record<string, ValorDeParametro>

// la consulta de una lista: un vacío no filtra, y un filtro de varios valores se repite (api.md §3.4)
export function consulta(parametros: Parametros): string {
  const busqueda = new URLSearchParams()
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor === undefined || valor === null || valor === '') continue
    if (Array.isArray(valor)) for (const uno of valor) busqueda.append(clave, uno)
    else busqueda.append(clave, String(valor))
  }
  return busqueda.toString()
}

export const atributo = <T = unknown>(registro: Registro | undefined | null, campo: string): T | undefined => registro?.attributes[campo] as T | undefined

export const texto = (registro: Registro | undefined | null, campo: string): string => {
  const valor = atributo(registro, campo)
  return valor === undefined || valor === null ? '' : String(valor)
}

export function useRegistros(objeto: string, parametros: Parametros, activo = true) {
  const pedir = usePedir()
  const busqueda = consulta(parametros)
  return useQuery({
    queryKey: ['records', objeto, busqueda],
    queryFn: () => pedir<Pagina>(`/objects/${objeto}/records?${busqueda}`),
    enabled: activo
  })
}

// el estado del workflow como filtro de la lista genérica (api.md §3.4): state deja los registros en esos estados y state_not los
// que no están en ellos; los estados van separados por comas, porque la lista lee un solo valor por parámetro
export const estados = (lista: readonly string[]): string => lista.join(',')

// cuántos registros tiene una consulta, sin traerlos: una página de uno con su conteo (api.md §3.4). una consulta null no puede
// tener registros (cuenta 0 sin pedir nada); mientras llega, o si falla, el conteo es null y no se dice
const leerConteo = async (pedir: Pedido, objeto: string, parametros: Parametros): Promise<number | null> =>
  (await pedir<Pagina>(`/objects/${objeto}/records?${consulta({ ...parametros, size: 1 })}`)).totalElements ?? null

const lecturaDeConteo = (pedir: Pedido, objeto: string, parametros: Parametros | null, activo: boolean) => ({
  queryKey: ['records', objeto, 'conteo', parametros ? consulta(parametros) : null],
  queryFn: () => leerConteo(pedir, objeto, parametros ?? {}),
  enabled: activo && parametros !== null
})

export function useConteo(objeto: string, parametros: Parametros | null, activo = true): number | null {
  const pedir = usePedir()
  const lectura = useQuery(lecturaDeConteo(pedir, objeto, parametros, activo))
  return parametros === null ? 0 : (lectura.data ?? null)
}

// el conteo de cada vista de una lista, por su clave
export function useConteos(objeto: string, consultas: Record<string, Parametros | null>, activo = true): Record<string, number | null> {
  const pedir = usePedir()
  const claves = Object.keys(consultas)
  const lecturas = useQueries({ queries: claves.map((clave) => lecturaDeConteo(pedir, objeto, consultas[clave], activo)) })
  return Object.fromEntries(claves.map((clave, i) => [clave, consultas[clave] === null ? 0 : (lecturas[i].data ?? null)]))
}

// todos los registros de una consulta, por cursor y sin conteo (api.md §3.4), hasta un tope: para conjuntos acotados
// (las interacciones de un mes, los miembros de un área, las asignaciones de un proyecto). `truncado` dice que el tope cortó
// la lectura con páginas pendientes: quien lo necesita (una lista que podría tener más) lo avisa en lugar de callarlo
export interface Lectura {
  registros: Registro[]
  truncado: boolean
}

export async function leerConTope(pedir: Pedido, objeto: string, parametros: Parametros, tope = 1000): Promise<Lectura> {
  const registros: Registro[] = []
  let despues: string | null | undefined = undefined
  do {
    const pagina: Pagina = await pedir<Pagina>(`/objects/${objeto}/records?${consulta({ ...parametros, size: 200, count: false, after: despues })}`)
    registros.push(...pagina.content)
    despues = pagina.nextCursor
  } while (despues && registros.length < tope)
  return { registros, truncado: Boolean(despues) }
}

export async function leerTodos(pedir: Pedido, objeto: string, parametros: Parametros, tope = 1000): Promise<Registro[]> {
  return (await leerConTope(pedir, objeto, parametros, tope)).registros
}

export function useTodos(objeto: string, parametros: Parametros, activo = true) {
  const pedir = usePedir()
  const busqueda = consulta(parametros)
  return useQuery({
    queryKey: ['records', objeto, 'todos', busqueda],
    queryFn: () => leerTodos(pedir, objeto, parametros),
    enabled: activo
  })
}

// como useTodos, pero dice si el tope cortó la lectura (`truncado`); `data` sigue siendo la lista. para las pantallas que
// leen un alcance sin rango y no pueden afirmar que lo ven completo (el calendario de interacciones)
export function useTodosConTope(objeto: string, parametros: Parametros, activo = true) {
  const pedir = usePedir()
  const busqueda = consulta(parametros)
  const lectura = useQuery({
    queryKey: ['records', objeto, 'todos-con-tope', busqueda],
    queryFn: () => leerConTope(pedir, objeto, parametros),
    enabled: activo
  })
  return { ...lectura, data: lectura.data?.registros, truncado: lectura.data?.truncado ?? false }
}

export function useRegistro(objeto: string, id: string | undefined) {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['record', objeto, id],
    queryFn: () => pedir<Registro>(`/objects/${objeto}/records/${id}`),
    enabled: Boolean(id)
  })
}

// la definición del objeto para quien llama: wasichai quita los campos que no puede leer y marca editable: false los que
// no puede escribir (WAS-ADR-0020). un campo que falta es un campo restringido
// sin objeto (undefined) no pide nada: para lo que solo se necesita si la persona puede leerlo
export const useDefinicion = (objeto: string | undefined) => useObjectDefinition(objeto)

export const campoDe = (definicion: ObjectDefinition | undefined, campo: string): FieldMeta | undefined => definicion?.fields.find((f) => f.name === campo)

export const puedeLeer = (definicion: ObjectDefinition | undefined, campo: string): boolean => campoDe(definicion, campo) !== undefined

export const puedeEscribir = (definicion: ObjectDefinition | undefined, campo: string): boolean => campoDe(definicion, campo)?.editable === true

const esGeometria = (campo: FieldMeta) => campo.type === 'GEOMETRY'

const vacioANulo = (valor: unknown) => (valor === '' ? null : valor)

// los atributos que una escritura manda, armados con la forma del GET y los permisos de quien llama, nunca con el modelo
// completo. el PUT de wasichai reemplaza los campos escribibles (UPS-04) y responde 400 a un campo que la persona no puede
// escribir, así que al cambiar se mandan las claves que trajo el GET y la definición de quien llama marca editables, con lo
// leído o lo cambiado. una clave que el GET no trajo es un campo restringido (security.md §7.9: la postura para quien no la
// lee, la religión de un perfil de localidad para el relacionista) y no viaja aunque el formulario la nombre; un rol con
// "u" (todos los campos de solo lectura) no manda ningún campo de negocio. los derivados se omiten: DerivedFieldsKeeper
// (plan 2.2) les devuelve el valor guardado y DerivedFieldsGuard solo rechaza un valor distinto. al crear no hay GET: van
// los campos que la persona puede escribir y que el formulario trae. los de solo comando (CAMPOS_DE_COMANDO, plan 4.2a) viajan al
// cambiar tal como se leyeron y nunca al crear
export function atributosDeEscritura(objeto: string, definicion: ObjectDefinition, cambios: Record<string, unknown>, base?: Registro): Record<string, unknown> {
  const salida: Record<string, unknown> = {}
  for (const campo of definicion.fields) {
    if (!campo.editable || esGeometria(campo) || esDerivado(objeto, campo.name)) continue
    if (base) {
      if (!(campo.name in base.attributes)) continue
      // un campo de solo comando (CAMPOS_DE_COMANDO) viaja tal como se leyó, aunque el formulario traiga otro valor
      if (esDeComando(objeto, campo.name)) {
        salida[campo.name] = base.attributes[campo.name]
        continue
      }
      // un valor undefined (un opcional que el formulario no registró) no es un cambio: sale lo leído
      salida[campo.name] = cambios[campo.name] !== undefined ? vacioANulo(cambios[campo.name]) : base.attributes[campo.name]
    } else if (cambios[campo.name] !== undefined && !esDeComando(objeto, campo.name)) salida[campo.name] = vacioANulo(cambios[campo.name])
  }
  return salida
}

// si la persona puede escribir al menos un campo de negocio del objeto. un rol con "u" (security.md §7.1) tiene UPDATE
// con todos los campos de solo lectura: aplica transiciones y vincula, pero no se le ofrece un formulario de edición
export const escribeAlgunCampo = (objeto: string, definicion: ObjectDefinition | undefined): boolean =>
  definicion?.fields.some((f) => f.editable && !esGeometria(f) && !esDerivado(objeto, f.name) && !esDeComando(objeto, f.name)) ?? false

// UPDATE sobre el objeto y al menos un campo escribible: la condición para ofrecer "Editar"
export function usePuedeEditar(objeto: string): boolean {
  const { can } = useAuth()
  const actualiza = can(objeto, 'UPDATE')
  const definicion = useObjectDefinition(objeto)
  return actualiza && escribeAlgunCampo(objeto, definicion.data)
}

// las geometrías que una escritura manda: solo las de campos GEOMETRY que la persona puede escribir (un rol con "u" o un
// campo restringido no las manda; serían un 400)
export function geometriasDeEscritura(
  definicion: ObjectDefinition,
  geometrias?: Record<string, Geometria | null>
): Record<string, Geometria | null> | undefined {
  if (!geometrias) return undefined
  const escribibles = Object.entries(geometrias).filter(([campo]) => {
    const meta = campoDe(definicion, campo)
    return meta !== undefined && esGeometria(meta) && meta.editable
  })
  return escribibles.length > 0 ? Object.fromEntries(escribibles) : undefined
}

// la definición del objeto para quien llama, de la caché o leída: para armar una escritura fuera de useCrear y useActualizar
export async function definicionDe(cliente: QueryClient, pedir: Pedido, objeto: string): Promise<ObjectDefinition> {
  return cliente.ensureQueryData({ queryKey: ['objects', objeto], queryFn: () => pedir<ObjectDefinition>(`/metadata/objects/${objeto}`) })
}

// refresca las listas y los vínculos; con id, también lo de ese registro (con su consulta en seco). conRegistro=false deja quieto ['record', …]
// cuando quien llama ya lo puso con setQueryData (la relectura de una actualización)
function invalidar(cliente: QueryClient, objeto: string, id?: string, conRegistro = true) {
  void cliente.invalidateQueries({ queryKey: ['records', objeto] })
  void cliente.invalidateQueries({ queryKey: ['related'] })
  if (id) {
    if (conRegistro) void cliente.invalidateQueries({ queryKey: ['record', objeto, id] })
    void cliente.invalidateQueries({ queryKey: ['transitions', objeto, id] })
    void cliente.invalidateQueries({ queryKey: ['history', objeto, id] })
    // la consulta en seco depende de los datos del registro: fijar un campo que bloqueaba deja de bloquear sin recargar
    void cliente.invalidateQueries({ queryKey: ['transition-check', objeto, id] })
  }
}

export interface Alta {
  atributos: Record<string, unknown>
  geometrias?: Record<string, Geometria | null>
  motivo?: string | null
}

// el alta genérica honra la cabecera nativa Idempotency-Key desde wasichai 0.6.0 (WAS-ADR-0058, UPS-18, decisión D3): una clave
// por alta, repetida si el mismo pedido se reintenta (un corte de red ya no duplica una interacción o una visita) y renovada al
// terminar bien o si el servidor dice que ya se usó con otro cuerpo. una pantalla que empieza otra alta sin que la anterior
// terminara bien llama a nuevaAccion
export function useCrear(objeto: string, { esperar }: { esperar?: Esperar } = {}) {
  const pedir = usePedir()
  const cliente = useQueryClient()
  const clave = useRef<string>(nuevaClave())
  const mutacion = useMutation({
    mutationFn: async ({ atributos, geometrias, motivo }: Alta) => {
      const definicion = await definicionDe(cliente, pedir, objeto)
      const geometries = geometriasDeEscritura(definicion, geometrias)
      const cuerpo = { attributes: atributosDeEscritura(objeto, definicion, atributos), ...(geometries ? { geometries } : {}) }
      return enviarComando<Registro>(pedir, { ruta: `/objects/${objeto}/records`, json: cuerpo, motivo }, clave.current, esperar)
    },
    onSuccess: () => {
      clave.current = nuevaClave()
      invalidar(cliente, objeto)
    },
    onError: (error) => {
      if (esClaveReusada(error)) clave.current = nuevaClave()
    }
  })
  return {
    ...mutacion,
    nuevaAccion: () => {
      clave.current = nuevaClave()
      mutacion.reset()
    }
  }
}

export interface Cambio {
  registro: Registro
  cambios: Record<string, unknown>
  geometrias?: Record<string, Geometria | null>
  motivo?: string | null
}

// cambia un registro con la precondición de versión (If-Match con el updatedAt leído, api.md §3.6) y lo relee: la
// respuesta del PUT genérico trae los derivados en null, porque wasichai la arma antes de que DerivedFieldsKeeper (plan
// 2.2) devuelva sus valores, así que nunca se pinta; lo que vuelve es el registro tal como quedó
export async function guardarCambio(
  pedir: Pedido,
  definicion: ObjectDefinition,
  objeto: string,
  { registro, cambios, geometrias, motivo }: Cambio
): Promise<Registro> {
  const geometries = geometriasDeEscritura(definicion, geometrias)
  const cuerpo = { attributes: atributosDeEscritura(objeto, definicion, cambios, registro), ...(geometries ? { geometries } : {}) }
  const ruta = `/objects/${objeto}/records/${registro.id}`
  const guardado = await pedir<Registro>(ruta, { metodo: 'PUT', json: cuerpo, version: registro.updatedAt, motivo })
  try {
    return await pedir<Registro>(ruta)
  } catch {
    // el cambio ya se guardó: si la relectura falla, no se reporta un error que invitaría a reintentar con la versión vieja
    // (412). vale la respuesta del PUT; los derivados vendrán bien en la próxima lectura, que la invalidación provoca
    return guardado
  }
}

export function useActualizar(objeto: string) {
  const pedir = usePedir()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async (cambio: Cambio) => guardarCambio(pedir, await definicionDe(cliente, pedir, objeto), objeto, cambio),
    onSuccess: (releido, { registro }) => {
      cliente.setQueryData(['record', objeto, registro.id], releido)
      invalidar(cliente, objeto, registro.id, false)
    }
  })
}

// los vínculos MANY_TO_MANY de la API genérica (engagement_stakeholder, engagement_topic, project_concession…)
export function useRelacionados(objeto: string, id: string | undefined, relacion: string) {
  const pedir = usePedir()
  return useQuery({
    queryKey: ['related', objeto, id, relacion],
    queryFn: () => pedir<Pagina>(`/objects/${objeto}/records/${id}/related/${relacion}?size=200`),
    enabled: Boolean(id)
  })
}
