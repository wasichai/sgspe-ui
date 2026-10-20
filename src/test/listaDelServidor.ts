import { jsonResponse } from '@wasichai/testing'
import type { Registro } from '../portal/datos/registros'
import type { RutaEspecial } from './red'

// la lista genérica de wasichai en las pruebas, con lo que hace el servidor (api.md §3.4): igualdad por atributo, el estado del
// workflow en state y state_not (separados por comas; state_not conserva los registros sin estado), el rango [range_from, range_to)
// sobre el primer campo con valor de range_field, los campos vacíos de empty, q sobre los textos, orden, página y conteo. se instala con espiarRed, después de mockFetch
const RESERVADOS = new Set(['page', 'size', 'sort', 'dir', 'q', 'count', 'after', 'state', 'state_not', 'range_field', 'range_from', 'range_to', 'empty'])

// los registros pueden ser una función: el conjunto que ve el servidor en cada pedido (una tarea que alguien toma)
export function listaDelServidor(objeto: string, conjunto: Registro[] | (() => Registro[])): RutaEspecial {
  return {
    path: `/objects/${objeto}/records`,
    responder: ({ ruta }) => {
      const registros = typeof conjunto === 'function' ? conjunto() : conjunto
      const p = new URLSearchParams(ruta.split('?')[1] ?? '')
      const estados = (clave: string) => (p.get(clave) ?? '').split(',').filter(Boolean)
      const valor = (r: Registro, campo: string) => {
        const v = r.attributes[campo]
        return v === undefined || v === null || v === '' ? null : String(v)
      }
      const rango = (r: Registro) => {
        const campos = estados('range_field')
        if (campos.length === 0) return true
        const v = campos.map((c) => valor(r, c)).find((x) => x !== null)
        const desde = p.get('range_from')
        const hasta = p.get('range_to')
        return v !== undefined && (!desde || v >= desde) && (!hasta || v < hasta)
      }
      const dentro = estados('state')
      const fuera = estados('state_not')
      const q = (p.get('q') ?? '').toLowerCase()
      const iguales = [...p.keys()].filter((clave) => !RESERVADOS.has(clave) && p.get(clave) !== '')
      const orden = p.get('sort')
      const filas = registros
        .filter(
          (r) =>
            (dentro.length === 0 || dentro.includes(r.state ?? '')) &&
            (!r.state || !fuera.includes(r.state)) &&
            iguales.every((clave) => String(r.attributes[clave] ?? '') === p.get(clave)) &&
            estados('empty').every((campo) => valor(r, campo) === null) &&
            rango(r) &&
            (!q || Object.values(r.attributes).some((v) => typeof v === 'string' && v.toLowerCase().includes(q)))
        )
        .sort((a, b) => (orden ? String(a.attributes[orden] ?? '').localeCompare(String(b.attributes[orden] ?? '')) : 0) * (p.get('dir') === 'desc' ? -1 : 1))
      const size = Number(p.get('size') ?? 25)
      const page = Number(p.get('page') ?? 0)
      const contar = p.get('count') !== 'false'
      return jsonResponse({
        content: filas.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: contar ? filas.length : null,
        totalPages: contar ? Math.ceil(filas.length / size) : null,
        nextCursor: null
      })
    }
  }
}

// la ficha de cada registro del mismo conjunto: GET /objects/:objeto/records/:id, o 404 si no está
export function fichaDelServidor(objeto: string, conjunto: Registro[] | (() => Registro[])): RutaEspecial {
  return {
    path: new RegExp(`^/objects/${objeto}/records/[^/?]+$`),
    responder: ({ ruta }) => {
      const id = decodeURIComponent(ruta.split('/').pop() ?? '')
      const registro = (typeof conjunto === 'function' ? conjunto() : conjunto).find((r) => r.id === id)
      return registro ? jsonResponse(registro) : jsonResponse({ title: 'Not Found', status: 404 }, 404)
    }
  }
}
