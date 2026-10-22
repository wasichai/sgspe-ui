import { useAuth } from '@wasichai/core'
import { useTranslation } from 'react-i18next'
import { ListaPriorizada, type EntradaPriorizada } from '../componentes/ListaPriorizada'
import { Seccion } from '../componentes/Seccion'
import { SEVERIDADES_GRAVES } from '../datos/atencion'
import { FUENTE_DE_APROBACIONES, type Aviso } from '../datos/avisos'
import { destinoDeAviso, rutaDeFicha } from '../datos/fichas'
import { estados, texto, useTodos } from '../datos/registros'
import { rotuloDeOpcion } from '../datos/opciones'
import { fechaPe, NS } from '../i18n'
import { rutaDeDecision, useAprobacionesPendientes } from '../tareas/AprobacionesPage'

// «Esperan su decisión», lo segundo del inicio (P-01 del rediseño de UX, DD-01): las aprobaciones que le llegaron (los avisos de
// aprobación, como S48), las alertas por triar a quien puede confirmarlas o descartarlas (la acción declarada de WF-J, como S41) y
// los demás avisos ACTION sin leer, cada grupo con lo más urgente, su motivo y su enlace. sin nada que decidir, o sin la bandeja de
// avisos ni la acción, el bloque no se dibuja
const CONFIRMAR_ALERTA = 'CONFIRM_ALERT'
const POR_TRIAR = ['detected', 'in_triage']

// una fecha que falta o no es válida no tumba el inicio (Intl lanza RangeError con una fecha inválida): se omite
const fechaSiValida = (valor: string | null | undefined): string | null => {
  const fecha = new Date(valor ?? '')
  return Number.isNaN(fecha.getTime()) ? null : fechaPe(fecha)
}

export function EsperanSuDecision() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { avisos, pendientes, truncado } = useAprobacionesPendientes()
  const triaje = can('early_warning', 'READ') && can('early_warning', CONFIRMAR_ALERTA)
  const alertas = useTodos('early_warning', { state: estados(POR_TRIAR), sort: 'detected_at', dir: 'desc' }, triaje)
  const desde = (a: Aviso) => {
    const fecha = fechaSiValida(a.publishAt)
    return fecha ? t('miDia.decision.desde', { fecha }) : undefined
  }
  const aprobaciones: EntradaPriorizada[] = pendientes.map((a) => ({
    clave: a.id,
    titulo: a.title,
    a: rutaDeDecision(a) ?? destinoDeAviso(a.link) ?? '/tasks/approvals',
    motivo: a.body || t('miDia.decision.aprobacionPendiente'),
    cuando: desde(a),
    tono: a.overdue ? 'peligro' : 'aviso'
  }))
  const porTriar: EntradaPriorizada[] = (alertas.data ?? []).map((r) => {
    const severidad = texto(r, 'severity')
    const detectada = fechaSiValida(texto(r, 'detected_at'))
    return {
      clave: r.id,
      titulo: texto(r, 'title') || r.id,
      a: rutaDeFicha('early_warning', r) ?? '/notifications',
      motivo: severidad ? t('miDia.decision.severidad', { valor: rotuloDeOpcion(severidad) }) : t('miDia.decision.sinSeveridad'),
      cuando: detectada ? t('miDia.decision.detectada', { fecha: detectada }) : undefined,
      tono: SEVERIDADES_GRAVES.includes(severidad) ? 'peligro' : 'aviso'
    }
  })
  const otros: EntradaPriorizada[] = (avisos.data?.content ?? [])
    .filter((a) => a.kind === 'ACTION' && !a.read && a.source !== FUENTE_DE_APROBACIONES)
    .map((a) => ({
      clave: a.id,
      titulo: a.title,
      a: destinoDeAviso(a.link) ?? '/notifications',
      motivo: a.body || t('miDia.decision.pideAccion'),
      cuando: desde(a),
      tono: a.overdue ? 'peligro' : 'aviso'
    }))
  if (aprobaciones.length + porTriar.length + otros.length === 0) return null
  return (
    <Seccion titulo={t('miDia.decision.titulo')}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* las aprobaciones y los avisos se leen de los primeros de la bandeja: si tiene más, su total no se afirma */}
        <ListaPriorizada
          titulo={t('miDia.decision.aprobaciones')}
          total={truncado ? null : aprobaciones.length}
          entradas={aprobaciones}
          verTodos={{ a: '/tasks/approvals' }}
        />
        <ListaPriorizada titulo={t('miDia.decision.alertas')} total={porTriar.length} entradas={porTriar} />
        <ListaPriorizada titulo={t('miDia.decision.avisos')} total={truncado ? null : otros.length} entradas={otros} verTodos={{ a: '/notifications' }} />
      </div>
    </Seccion>
  )
}
