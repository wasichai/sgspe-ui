import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuth, useObjectDefinition, type FieldMeta, type ObjectDefinition, type RecordItem } from '@wasichai/core'
import { esDerivado } from './derivados'
import { usePedir, type Pedido } from './http'

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

// todos los registros de una consulta, por cursor y sin conteo (api.md §3.4), hasta un tope: para conjuntos acotados
// (las interacciones de un mes, los miembros de un área, las asignaciones de un proyecto)
export async function leerTodos(pedir: Pedido, objeto: string, parametros: Parametros, tope = 1000): Promise<Registro[]> {
  const todos: Registro[] = []
  let despues: string | null | undefined = undefined
  do {
    const pagina: Pagina = await pedir<Pagina>(`/objects/${objeto}/records?${consulta({ ...parametros, size: 200, count: false, after: despues })}`)
    todos.push(...pagina.content)
    despues = pagina.nextCursor
  } while (despues && todos.length < tope)
  return todos
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
export const useDefinicion = (objeto: string) => useObjectDefinition(objeto)

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
// los campos que la persona puede escribir y que el formulario trae
export function atributosDeEscritura(objeto: string, definicion: ObjectDefinition, cambios: Record<string, unknown>, base?: Registro): Record<string, unknown> {
  const salida: Record<string, unknown> = {}
  for (const campo of definicion.fields) {
    if (!campo.editable || esGeometria(campo) || esDerivado(objeto, campo.name)) continue
    if (base) {
      if (!(campo.name in base.attributes)) continue
      // un valor undefined (un opcional que el formulario no registró) no es un cambio: sale lo leído
      salida[campo.name] = cambios[campo.name] !== undefined ? vacioANulo(cambios[campo.name]) : base.attributes[campo.name]
    } else if (cambios[campo.name] !== undefined) salida[campo.name] = vacioANulo(cambios[campo.name])
  }
  return salida
}

// si la persona puede escribir al menos un campo de negocio del objeto. un rol con "u" (security.md §7.1) tiene UPDATE
// con todos los campos de solo lectura: aplica transiciones y vincula, pero no se le ofrece un formulario de edición
export const escribeAlgunCampo = (objeto: string, definicion: ObjectDefinition | undefined): boolean =>
  definicion?.fields.some((f) => f.editable && !esGeometria(f) && !esDerivado(objeto, f.name)) ?? false

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

async function definicionDe(cliente: QueryClient, pedir: Pedido, objeto: string): Promise<ObjectDefinition> {
  return cliente.ensureQueryData({ queryKey: ['objects', objeto], queryFn: () => pedir<ObjectDefinition>(`/metadata/objects/${objeto}`) })
}

// refresca las listas y los vínculos; con id, también lo de ese registro. conRegistro=false deja quieto ['record', …]
// cuando quien llama ya lo puso con setQueryData (la relectura de una actualización)
function invalidar(cliente: QueryClient, objeto: string, id?: string, conRegistro = true) {
  void cliente.invalidateQueries({ queryKey: ['records', objeto] })
  void cliente.invalidateQueries({ queryKey: ['related'] })
  if (id) {
    if (conRegistro) void cliente.invalidateQueries({ queryKey: ['record', objeto, id] })
    void cliente.invalidateQueries({ queryKey: ['transitions', objeto, id] })
    void cliente.invalidateQueries({ queryKey: ['history', objeto, id] })
  }
}

export interface Alta {
  atributos: Record<string, unknown>
  geometrias?: Record<string, Geometria | null>
  motivo?: string | null
}

export function useCrear(objeto: string) {
  const pedir = usePedir()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: async ({ atributos, geometrias, motivo }: Alta) => {
      const definicion = await definicionDe(cliente, pedir, objeto)
      const geometries = geometriasDeEscritura(definicion, geometrias)
      const cuerpo = { attributes: atributosDeEscritura(objeto, definicion, atributos), ...(geometries ? { geometries } : {}) }
      return pedir<Registro>(`/objects/${objeto}/records`, { json: cuerpo, motivo })
    },
    onSuccess: () => invalidar(cliente, objeto)
  })
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

export function useBorrar(objeto: string) {
  const pedir = usePedir()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ registro, motivo }: { registro: Registro; motivo?: string | null }) =>
      pedir<void>(`/objects/${objeto}/records/${registro.id}`, { metodo: 'DELETE', version: registro.updatedAt, motivo }),
    onSuccess: (_r, { registro }) => {
      // el registro borrado no se relee (sería un 404 con un observador activo): se quita de la caché
      invalidar(cliente, objeto)
      for (const clave of ['record', 'transitions', 'history']) cliente.removeQueries({ queryKey: [clave, objeto, registro.id] })
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

export function useVincular(objeto: string, relacion: string) {
  const pedir = usePedir()
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, otro, quitar }: { id: string; otro: string; quitar?: boolean }) =>
      quitar
        ? pedir<void>(`/objects/${objeto}/records/${id}/related/${relacion}/${otro}`, { metodo: 'DELETE' })
        : pedir<void>(`/objects/${objeto}/records/${id}/related/${relacion}`, { json: { otherId: otro } }),
    onSuccess: (_r, { id }) => void cliente.invalidateQueries({ queryKey: ['related', objeto, id, relacion] })
  })
}
