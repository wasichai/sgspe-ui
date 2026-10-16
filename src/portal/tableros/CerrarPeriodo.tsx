import { useAuth } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMensajeDeError } from '../componentes/errores'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { atributo, type Registro } from '../datos/registros'
import { diaPe, NS, numeroPe } from '../i18n'
import { razonDeCierre, useCerrarPeriodo, type FilaDeMonitoreo } from './contratoF8'

// «Cerrar periodo» (dashboards.md §10, api.md §4.11): congela la cifra del mes como la oficial, una vez y sin deshacer. el
// alcance es el proyecto del filtro o, sin proyecto, toda la organización, que solo cierra la administración (isAdmin; decisión 3
// del plan: IndicatorMeasurements pide ADMIN). cada rechazo del servidor se dice en su texto: el 409 por su razón (reason del
// cuerpo), el periodo abierto, el ya cerrado y el alcance sin permiso
export function CerrarPeriodo({
  fila,
  indicador,
  proyecto,
  nombreDelProyecto,
  desde,
  hasta,
  alCerrar
}: {
  fila: FilaDeMonitoreo
  indicador: string
  proyecto: string
  nombreDelProyecto: string
  desde: string
  hasta: string
  alCerrar: () => void
}) {
  const { t } = useTranslation(NS)
  const { isAdmin } = useAuth()
  const escribe = useEscribeEnProyecto(proyecto || undefined)
  const cerrar = useCerrarPeriodo()
  const mensaje = useMensajeDeError()
  const [hecho, setHecho] = useState<Registro | null>(null)
  const delTenant = proyecto === ''
  const puede = delTenant ? isAdmin : escribe
  const razon = cerrar.isError ? razonDeCierre(cerrar.error) : null
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-sg-h3 font-semibold">{t('tablerosF8.cierre.titulo', { indicador: fila.label })}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">{t('tablerosF8.cierre.ayuda')}</DialogDescription>
        <div className="mt-4 space-y-3 text-sm">
          <p>{t('tablerosF8.cierre.periodo', { desde: diaPe(desde), hasta: diaPe(hasta) })}</p>
          <p>
            <span className="font-medium">{t('tablerosF8.cierre.alcance')}: </span>
            {delTenant ? t('tablerosF8.cierre.delTenant') : t('tablerosF8.cierre.delProyecto', { proyecto: nombreDelProyecto })}
          </p>
          {delTenant && !isAdmin ? <Alert tone="notice">{t('tablerosF8.cierre.soloAdministracion')}</Alert> : null}
          {!delTenant && !escribe ? <Alert tone="notice">{t('tablerosF8.cierre.sinAsignacion')}</Alert> : null}
          {hecho ? (
            <p role="status" className="text-sg-success">
              {t('tablerosF8.cierre.hecho', { valor: numeroPe(Number(atributo(hecho, 'measured_value') ?? 0)) })}
            </p>
          ) : null}
          {cerrar.isError ? (
            <Alert tone="danger">
              {razon
                ? t(`tablerosF8.cierre.razones.${razon}`)
                : mensaje(cerrar.error, { 'ACTION_REQUIRED:project': t('tablerosF8.cierre.soloAdministracion') })}
            </Alert>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {hecho ? t('tablerosF8.cierre.listo') : t('comun.cancelar')}
          </Button>
          {hecho ? null : (
            <Button
              disabled={!puede || cerrar.isPending}
              aria-busy={cerrar.isPending}
              onClick={() => cerrar.mutate({ indicador, proyecto: delTenant ? null : proyecto, desde, hasta }, { onSuccess: (r) => setHecho(r) })}
            >
              {cerrar.isPending ? t('tablerosF8.cierre.cerrando') : t('tablerosF8.cierre.confirmar')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
