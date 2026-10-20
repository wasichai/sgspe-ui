import { jsonResponse } from '@wasichai/testing'
import { estaAbierta, plazoQueCorre, OBJETOS_DE_QCS, type GrupoDePlazo, type ObjetoDeQcs } from '../portal/datos/atencion'
import { texto, type Registro } from '../portal/datos/registros'
import type { RutaEspecial } from './red'

// la cola de atención en las pruebas (GET /sgspe/attention/queue), con lo que hace el servidor (AttentionQueueRows de sgspe): las
// vistas, los grupos de plazo, el orden por el plazo que corre, la recepción y el código, los filtros, la página y los conteos. solo
// llegan los tipos legibles. se instala con espiarRed, después de mockFetch
export interface Fila {
  objeto: ObjetoDeQcs
  registro: Registro
}

const enVista = (vista: string, { objeto, registro }: Fila, usuario: string): boolean => {
  const tipo = { grievances: 'grievance', inquiries: 'inquiry', requests: 'stakeholder_request' }[vista]
  if (tipo) return objeto === tipo && estaAbierta(objeto, registro)
  if (vista === 'all') return true
  if (vista === 'mine') return estaAbierta(objeto, registro) && texto(registro, 'owner_user_id') === usuario
  return estaAbierta(objeto, registro)
}

const GRUPOS: GrupoDePlazo[] = ['overdue', 'dueSoon', 'onTime']

const grupoDe = ({ objeto, registro }: Fila): GrupoDePlazo => {
  if (!plazoQueCorre(objeto, registro)) return 'onTime'
  const situacion = texto(registro, 'deadline_status')
  return situacion === 'VENCIDO' ? 'overdue' : situacion === 'POR VENCER' ? 'dueSoon' : 'onTime'
}

const ultimo = (valor: string | null | undefined) => valor || '￿'

const orden = (a: Fila, b: Fila) =>
  GRUPOS.indexOf(grupoDe(a)) - GRUPOS.indexOf(grupoDe(b)) ||
  ultimo(plazoQueCorre(a.objeto, a.registro)?.fecha).localeCompare(ultimo(plazoQueCorre(b.objeto, b.registro)?.fecha)) ||
  ultimo(texto(a.registro, 'received_at')).localeCompare(ultimo(texto(b.registro, 'received_at'))) ||
  texto(a.registro, 'code').localeCompare(texto(b.registro, 'code'))

export function colaDelServidor(
  porTipo: Partial<Record<ObjetoDeQcs, Registro[]>>,
  { usuario = 'u-gvm', legibles = OBJETOS_DE_QCS as readonly ObjetoDeQcs[] }: { usuario?: string; legibles?: readonly ObjetoDeQcs[] } = {}
): RutaEspecial {
  return {
    path: '/sgspe/attention/queue',
    responder: ({ ruta }) => {
      const p = new URLSearchParams(ruta.split('?')[1] ?? '')
      const filas = legibles.flatMap((objeto) => (porTipo[objeto] ?? []).map((registro) => ({ objeto, registro })))
      const igual = (f: Fila, campo: string, param: string) => !p.get(param) || texto(f.registro, campo) === p.get(param)
      const q = (p.get('q') ?? '').toLowerCase()
      const filtradas = filas.filter(
        (f) =>
          igual(f, 'channel', 'channel') &&
          igual(f, 'category', 'category') &&
          igual(f, 'severity', 'severity') &&
          igual(f, 'stakeholder', 'stakeholder') &&
          (!q || texto(f.registro, 'code').toLowerCase().includes(q) || texto(f.registro, 'description').toLowerCase().includes(q))
      )
      const vista = p.get('view') ?? 'attention'
      const enLaVista = filtradas.filter((f) => enVista(vista, f, usuario)).sort(orden)
      const size = Number(p.get('size') ?? 25)
      const page = Number(p.get('page') ?? 0)
      const vistas = ['attention', 'grievances', 'inquiries', 'requests', 'mine', 'all']
      return jsonResponse({
        content: enLaVista.slice(page * size, (page + 1) * size).map((f) => ({ type: f.objeto, group: grupoDe(f), record: f.registro })),
        page,
        size,
        totalElements: enLaVista.length,
        totalPages: Math.ceil(enLaVista.length / size),
        views: Object.fromEntries(vistas.map((v) => [v, filtradas.filter((f) => enVista(v, f, usuario)).length])),
        groups: Object.fromEntries(GRUPOS.map((g) => [g, enLaVista.filter((f) => grupoDe(f) === g).length])),
        unfiltered: filas.filter((f) => enVista(vista, f, usuario)).length,
        openDueSoon: filas.filter((f) => estaAbierta(f.objeto, f.registro) && grupoDe(f) === 'dueSoon').length,
        readable: legibles
      })
    }
  }
}
