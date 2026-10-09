import { Alert, Button } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMensajeDeError } from '../componentes/errores'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import {
  sinBandeja,
  TIPOS_DE_AVISO,
  useGuardarPreferencias,
  usePreferenciasDeAvisos,
  type PreferenciasDeAvisos as Preferencias,
  type TipoDeAviso
} from '../datos/avisos'
import { NS } from '../i18n'

// qué tipos de aviso llegan por cada canal (WAS-ADR-0060): la bandeja recibe todos; el correo, los que la persona elija.
// GET y PUT /api/auth/me/notification-preferences ({ email: ['ACTION', …] }); un canal sin tipos se apaga. sin canales
// configurados en la instalación, la respuesta viene vacía y se dice
export function PreferenciasDeAvisos() {
  const { t } = useTranslation(NS)
  const preferencias = usePreferenciasDeAvisos()
  const guardar = useGuardarPreferencias()
  const mensaje = useMensajeDeError()
  const [cambios, setCambios] = useState<Preferencias | null>(null)
  if (preferencias.isError && sinBandeja(preferencias.error)) return null
  const vigentes = cambios ?? preferencias.data ?? {}
  const canales = Object.keys(preferencias.data ?? {}).sort()
  const alternar = (canal: string, tipo: TipoDeAviso, marcado: boolean) => {
    const actuales = vigentes[canal] ?? []
    setCambios({ ...vigentes, [canal]: marcado ? [...actuales, tipo] : actuales.filter((x) => x !== tipo) })
    guardar.reset()
  }
  return (
    <section aria-label={t('avisos.preferencias.titulo')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <h2 className="text-sg-h3 font-semibold">{t('avisos.preferencias.titulo')}</h2>
      <p className="text-sg-text-secondary">{t('avisos.preferencias.ayuda')}</p>
      {preferencias.isPending ? (
        <Cargando compacto />
      ) : preferencias.isError && !preferencias.data ? (
        <FalloDeLectura error={preferencias.error} alReintentar={() => void preferencias.refetch()} />
      ) : canales.length === 0 ? (
        <p className="text-sg-text-muted">{t('avisos.preferencias.sinCanales')}</p>
      ) : (
        <>
          {canales.map((canal) => (
            <fieldset key={canal} className="space-y-1">
              <legend className="font-medium">{t(`avisos.preferencias.canal.${canal}`, { defaultValue: canal })}</legend>
              {TIPOS_DE_AVISO.map((tipo) => (
                <label key={tipo} className="flex items-center gap-2">
                  <input type="checkbox" checked={(vigentes[canal] ?? []).includes(tipo)} onChange={(e) => alternar(canal, tipo, e.target.checked)} />
                  {t(`avisos.tipos.${tipo}`)}
                </label>
              ))}
            </fieldset>
          ))}
          {guardar.isError ? <Alert tone="danger">{mensaje(guardar.error)}</Alert> : null}
          {guardar.isSuccess ? (
            <p role="status" className="text-sg-success">
              {t('avisos.preferencias.guardadas')}
            </p>
          ) : null}
          <Button
            size="sm"
            disabled={!cambios || guardar.isPending}
            aria-busy={guardar.isPending}
            onClick={() => cambios && guardar.mutate(cambios, { onSuccess: () => setCambios(null) })}
          >
            {guardar.isPending ? t('avisos.preferencias.guardando') : t('avisos.preferencias.guardar')}
          </Button>
        </>
      )}
    </section>
  )
}
