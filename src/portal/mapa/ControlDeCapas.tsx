import { Lock, ZoomIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'
import type { EstadoDeCapa } from './api'
import { CAPAS, GRUPOS } from './capas'

// el MapLayerControl de screens.md S09: las capas en cuatro grupos, con candado en las sensibles y en las que la cuenta no
// puede ver (con su razón), y el aviso de acercar el mapa en una capa recortada al tope (truncated). es una lista de
// casillas: se opera con teclado y no depende del mapa
export function ControlDeCapas({
  ids,
  encendidas,
  estados,
  alCambiar
}: {
  ids: readonly string[]
  encendidas: ReadonlySet<string>
  estados: EstadoDeCapa[]
  alCambiar: (id: string, encendida: boolean) => void
}) {
  const { t } = useTranslation(NS)
  const estado = (id: string) => estados.find((e) => e.id === id)
  return (
    <section aria-label={t('mapa.capas')} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-3 text-sm">
      {GRUPOS.map((grupo) => {
        const delGrupo = CAPAS.filter((c) => c.grupo === grupo && ids.includes(c.id))
        if (grupo === 'gestion')
          return (
            <fieldset key={grupo}>
              <legend className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t(`mapa.grupos.${grupo}`)}</legend>
              <p className="text-sg-caption text-sg-text-muted">{t('mapa.gestionLlega')}</p>
            </fieldset>
          )
        if (delGrupo.length === 0) return null
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
                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: `var(${c.color})` }} aria-hidden />
                    <span>{t(`mapa.capasNombre.${c.id}`)}</span>
                    {bloqueada || c.sensible ? (
                      <Lock aria-label={bloqueada ? t('mapa.bloqueada') : t('mapa.sensible')} className="size-3.5 text-sg-text-muted" />
                    ) : null}
                  </label>
                  {truncada ? (
                    <p role="status" className="ml-6 flex items-center gap-1 text-sg-caption text-sg-warning">
                      <ZoomIn aria-hidden className="size-3.5" />
                      {t('mapa.truncada')}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </fieldset>
        )
      })}
    </section>
  )
}
