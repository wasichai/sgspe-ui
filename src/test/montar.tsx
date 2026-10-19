import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createRegistry, resolveConfig, WasichaiProviders, type AuthUser, type CallerPermissions } from '@wasichai/core'
import type { ReactElement } from 'react'
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes, useLocation } from 'react-router'
import { client } from '../portal/api'
import { ZONA_DE_LIMA } from '../portal/datos/fechas'
import { crearI18n, IDIOMAS } from '../portal/i18n'
import { RELACIONISTA } from './portal'

// monta un componente del portal con los mismos proveedores de PortalApp (sesión, i18n con los textos del portal,
// TanStack Query sin reintentos) sobre un MemoryRouter, sin pedir los permisos: llegan ya resueltos
export interface OpcionesDeMontaje {
  ruta?: string
  camino?: string
  usuario?: AuthUser
  permisos?: CallerPermissions
  // sobre un data router (createMemoryRouter), como el de PortalApp: lo pide una pantalla que usa useBlocker
  datos?: boolean
}

// la ubicación actual, para ver a dónde navegó un componente
export const ubicacion = { actual: '' }
function Ubicacion() {
  const { pathname, search } = useLocation()
  ubicacion.actual = pathname + search
  return null
}

export function montar(
  ui: ReactElement,
  { ruta = '/', camino = '*', usuario = RELACIONISTA, permisos = { admin: true, objects: {} }, datos = false }: OpcionesDeMontaje = {}
) {
  localStorage.setItem('sgspe.token', 't')
  const config = resolveConfig({ apiBaseUrl: '/api', storagePrefix: 'sgspe', appName: 'SGSPE', languages: IDIOMAS, timeZone: ZONA_DE_LIMA })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const rutas = (
    <>
      <Ubicacion />
      <Routes>
        <Route path={camino} element={ui} />
      </Routes>
    </>
  )
  return render(
    <WasichaiProviders
      config={config}
      registry={createRegistry([])}
      apiClient={client}
      i18n={crearI18n()}
      queryClient={queryClient}
      initialUser={usuario}
      initialPermissions={permisos}
    >
      {datos ? (
        <RouterProvider router={createMemoryRouter([{ path: '*', element: rutas }], { initialEntries: [ruta] })} />
      ) : (
        <MemoryRouter initialEntries={[ruta]}>{rutas}</MemoryRouter>
      )}
    </WasichaiProviders>
  )
}

// los registros como los devuelve la API genérica
export const registro = (id: string, attributes: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id,
  createdAt: '2026-10-01T15:00:00Z',
  updatedAt: '2026-10-05T15:00:00Z',
  attributes,
  geometries: {},
  ...extra
})

export const pagina = (content: unknown[], extra: Record<string, unknown> = {}) => ({
  content,
  page: 0,
  size: 25,
  totalElements: content.length,
  totalPages: 1,
  ...extra
})

// la definición de un objeto para quien llama: los campos que puede leer, editable según puede escribir
export function definicion(objeto: string, campos: (string | [string, Record<string, unknown>])[]) {
  return {
    id: `o-${objeto}`,
    name: objeto,
    label: objeto,
    pluralLabel: objeto,
    description: null,
    enabled: true,
    fields: campos.map((c, position) => {
      const [name, extra] = typeof c === 'string' ? [c, {}] : c
      return {
        id: `${objeto}.${name}`,
        name,
        label: name,
        type: 'TEXT',
        required: false,
        unique: false,
        defaultValue: null,
        description: null,
        position,
        enumOptions: null,
        relationTarget: null,
        visible: true,
        editable: true,
        ...extra
      }
    })
  }
}

// un workflow con sus estados y etiquetas, como GET /api/objects/{object}/workflow
export function workflow(objeto: string, estados: [string, string][], transiciones: [string, string, string, string][] = []) {
  return {
    id: `wf-${objeto}`,
    objectName: objeto,
    name: objeto,
    label: objeto,
    enabled: true,
    definition: {
      states: estados.map(([name, label], i) => ({ name, label, type: i === 0 ? 'INITIAL' : 'INTERMEDIATE' })),
      transitions: transiciones.map(([name, label, from, to]) => ({ name, label, from, to, roles: [] }))
    }
  }
}
