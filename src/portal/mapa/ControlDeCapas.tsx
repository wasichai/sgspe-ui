import { Lock, ZoomIn } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { campoDelError, codigoDelError } from '../datos/http'
import { NS } from '../i18n'
import type { EstadoDeCapa } from './api'
import { CAPAS, CAPAS_DE_GESTION, GRUPOS } from './capas'

const TODAS = [...CAPAS, ...CAPAS_DE_GESTION]
const DEL_PERIODO = new Set(['periodStart', 'periodEnd'])

// el MapLayerControl de screens.md S09 y S12: las capas en cuatro grupos (Gestión son las capas de gestión de S12 que el backend
// sirve y el calor), con candado en las sensibles y en las que la cuenta no puede ver (con su razón), y el aviso de acercar el
// mapa en una capa recortada al tope (truncated). una capa encendida dice además si el periodo no la filtra, si la cuenta no lee
// parte de ella o si se le ocultan QCS confidenciales. es una lista de casillas: se opera con teclado y no depende del mapa
export function ControlDeCapas({
  ids,
  encendidas,
  estados,
  alCambiar,
  gestion
}: {
  ids: readonly string[]
  encendidas: ReadonlySet<string>
  estados: EstadoDeCapa[]
  alCambiar: (id: string, encendida: boolean) => void
  // el contenido propio del grupo Gestión (el calor de S12); sin él ni capas de gestión en ids, el grupo no se dibuja
  gestion?: ReactNode
}) {
  const { t } = useTranslation(NS)
  const estado = (id: string) => estados.find((e) => e.id === id)
  // un periodo que el servidor rechaza (400 OUT_OF_RANGE o INVALID_VALUE sobre periodStart o periodEnd) se dice con su texto
  const textoDelError = (error: unknown) =>
    codigoDelError(error) && DEL_PERIODO.has(campoDelError(error) ?? '') ? t('mapa.periodoFueraDeRango') : t('mapa.errorDeCapa')
  return (
    <section aria-label={t('mapa.capas')} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
      {GRUPOS.map((grupo) => {
        const delGrupo = TODAS.filter((c) => c.grupo === grupo && ids.includes(c.id))
        const propio = grupo === 'gestion' ? gestion : null
        if (delGrupo.length === 0 && !propio) return null
        return (
          <fieldset key={grupo} className="space-y-1">
            <legend className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t(`mapa.grupos.${grupo}`)}</legend>
            {delGrupo.map((c) => {
              const bloqueada = estado(c.id)?.bloqueada ?? false
              const truncada = encendidas.has(c.id) && (estado(c.id)?.truncada ?? false)
              return (
                <div key={c.id}>
                  <label className="flex items-center gap-2" title={bloqueada ? t('mapa.bloqueada') : undefined}>
                    <input
                      type="checkbox"
                      disabled={bloqueada}
                      checked={encendidas.has(c.id) && !bloqueada}
                      onChange={(e) => alCambiar(c.id, e.target.checked)}
                    />
                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                    <span>{t(`mapa.capasNombre.${c.id}`)}</span>
                    {bloqueada || c.sensible ? (
                      <Lock aria-label={bloqueada ? t('mapa.bloqueada') : t('mapa.sensible')} className="size-3.5 text-sg-text-muted" />
                    ) : null}
                  </label>
                  {encendidas.has(c.id) && !bloqueada && estado(c.id)?.cargando ? (
                    <p role="status" className="ml-6 text-sg-caption text-sg-text-muted">
                      {t('mapa.cargandoCapa')}
                    </p>
                  ) : null}
                  {encendidas.has(c.id) && !bloqueada && estado(c.id)?.error ? (
                    <p role="alert" className="ml-6 text-sg-caption text-sg-danger">
                      {textoDelError(estado(c.id)!.error)}
                    </p>
                  ) : null}
                  {encendidas.has(c.id) && !bloqueada
                    ? notasDe(estado(c.id)).map((nota) => (
                        <p key={nota} className="ml-6 text-sg-caption text-sg-text-muted">
                          {t(`mapa.notas.${nota}`)}
                        </p>
                      ))
                    : null}
                  {truncada ? (
                    <p role="status" className="ml-6 flex items-center gap-1 text-sg-caption text-sg-warning">
                      <ZoomIn aria-hidden className="size-3.5" />
                      {t('mapa.truncada')}
                    </p>
                  ) : null}
                </div>
              )
            })}
            {propio}
          </fieldset>
        )
      })}
    </section>
  )
}

// lo que la respuesta de una capa encendida dice de sí misma (H1 bis del plan 6.3): nunca un vacío que parezca completo
function notasDe(estado: EstadoDeCapa | undefined): ('incompleta' | 'periodoNoAplicado' | 'confidencialesOcultas')[] {
  const datos = estado?.datos
  if (!datos) return []
  return [
    ...(datos.available === false ? (['incompleta'] as const) : []),
    ...((datos.periodNotApplied?.length ?? 0) > 0 ? (['periodoNoAplicado'] as const) : []),
    ...(datos.confidentialHidden === true ? (['confidencialesOcultas'] as const) : [])
  ]
}
