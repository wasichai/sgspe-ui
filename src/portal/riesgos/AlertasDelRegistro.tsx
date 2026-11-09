import { useAuth } from '@wasichai/core'
import { Alert, Button } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { Nivel } from '../componentes/Nivel'
import { Seccion } from '../componentes/Seccion'
import { EnlaceConRastro } from '../contexto/Rastro'
import { rutaDeFicha } from '../datos/fichas'
import { opcion } from '../datos/opciones'
import { atributo, estados, texto, useRegistro, useRegistros, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// la alerta temprana dentro del registro de riesgos de un proyecto (S10): la alerta por triar como aviso sobre la matriz, con
// «Triar alerta», y las alertas activas en una lista junto a ella, con «Todas las alertas». las dos son lecturas del servidor
// (early_warning del proyecto por estado), nunca un conteo del portal. una alerta no cambia el nivel de un riesgo: lo dice su
// nota. triar es abrir su ficha, donde solo quien tiene CONFIRM_ALERT confirma o descarta (RN-EWS-001)
export const EN_TRIAJE = ['detected', 'in_triage'] as const
const ACTIVAS = ['detected', 'in_triage', 'confirmed', 'responding'] as const
const CONFIRMAR_ALERTA = 'CONFIRM_ALERT'
const POR_LISTA = 5

const enTriaje = (a: Registro) => (EN_TRIAJE as readonly string[]).includes(a.state ?? '')

// la alerta por triar más reciente, como aviso; con más de una, cuántas más hay. sin ninguna (o sin leerlas), nada
export function AvisoDeTriaje({ proyecto }: { proyecto: string }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const lectura = useRegistros(
    'early_warning',
    { project: proyecto, state: estados(EN_TRIAJE), sort: 'detected_at', dir: 'desc', size: 1 },
    can('early_warning', 'READ')
  )
  const alerta = lectura.data?.content[0]
  if (!alerta) return null
  const ruta = rutaDeFicha('early_warning', alerta)
  const otras = (lectura.data?.totalElements ?? 1) - 1
  const severidad = opcion(alerta, 'severity')
  return (
    <Alert tone="warning" title={t('riesgos.porTriar.titulo', { titulo: texto(alerta, 'title') })}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          {severidad ? `${t('riesgos.porTriar.severidad', { severidad })} ` : null}
          {atributo(alerta, 'early_warning_rule') || atributo(alerta, 'generator_key') ? t('riesgos.porTriar.regla') : t('riesgos.porTriar.aMano')}
          {atributo(alerta, 'social_risk') ? (
            <>
              {' '}
              <RiesgoDeLaAlerta id={atributo<string>(alerta, 'social_risk')} />
            </>
          ) : null}
          {otras > 0 ? ` ${t('riesgos.porTriar.otras', { count: otras })}` : null}
        </p>
        {ruta ? (
          <Button asChild size="sm">
            <EnlaceConRastro to={ruta}>{t('riesgos.porTriar.triar')}</EnlaceConRastro>
          </Button>
        ) : null}
      </div>
    </Alert>
  )
}

// «Está relacionada con R-001»: el código del riesgo vinculado, si se lee
function RiesgoDeLaAlerta({ id }: { id: string | undefined }) {
  const { t } = useTranslation(NS)
  const riesgo = useRegistro('social_risk', id)
  const codigo = texto(riesgo.data, 'code') || texto(riesgo.data, 'title')
  return codigo ? <>{t('riesgos.porTriar.riesgo', { riesgo: codigo })}</> : null
}

// las alertas activas del proyecto, las más recientes primero: cada una con su estado, su severidad con barras y su origen, y
// «Triar» (las por triar) o «Ver», que abren su ficha
export function AlertasActivas({ proyecto }: { proyecto: string }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const lectura = useRegistros('early_warning', { project: proyecto, state: estados(ACTIVAS), sort: 'detected_at', dir: 'desc', size: POR_LISTA })
  const total = lectura.data?.totalElements
  const tria = can('early_warning', CONFIRMAR_ALERTA) || can('early_warning', 'UPDATE')
  return (
    <Seccion
      titulo={
        <span className="inline-flex flex-wrap items-center gap-2">
          {t('riesgos.alertas.titulo')}
          {typeof total === 'number' ? (
            <span className="rounded-sg-sm border border-sg-border-strong px-1.5 text-sg-caption font-bold text-sg-text-secondary">
              {t('riesgos.alertas.activas', { count: total })}
            </span>
          ) : null}
        </span>
      }
      acciones={
        <Link to={`/projects/${encodeURIComponent(proyecto)}/risks/warnings`} className="text-sm font-semibold text-sg-primary-text underline">
          {t('riesgos.alertas.todas')}
        </Link>
      }
    >
      {lectura.isPending ? (
        <Cargando compacto />
      ) : lectura.isError && !lectura.data ? (
        <FalloDeLectura error={lectura.error} alReintentar={() => void lectura.refetch()} />
      ) : (lectura.data?.content ?? []).length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('riesgos.alertas.vacio')}</p>
      ) : (
        <ul className="-mx-4 divide-y divide-sg-border border-y border-sg-border sm:-mx-5">
          {(lectura.data?.content ?? []).map((a) => {
            const ruta = rutaDeFicha('early_warning', a)
            const porTriar = enTriaje(a) && tria
            return (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm font-bold text-sg-text">{texto(a, 'title')}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-sg-text-secondary">
                    <EstadoChip objeto="early_warning" estado={a.state} />
                    <Nivel valor={texto(a, 'severity')} nombre={t('alertas.columnas.severidad')} />
                    <span>
                      {atributo(a, 'early_warning_rule') || atributo(a, 'generator_key') ? t('riesgos.alertas.origenRegla') : t('riesgos.alertas.origenAMano')}
                    </span>
                  </div>
                </div>
                {ruta ? (
                  <Button asChild size="sm" variant={porTriar ? 'secondary' : 'ghost'}>
                    <EnlaceConRastro
                      to={ruta}
                      aria-label={t(porTriar ? 'riesgos.alertas.triarAlerta' : 'riesgos.alertas.verAlerta', { titulo: texto(a, 'title') })}
                    >
                      {porTriar ? t('riesgos.alertas.triar') : t('riesgos.alertas.ver')}
                    </EnlaceConRastro>
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <p className="pt-1 text-sm text-sg-text-secondary">{t('riesgos.alertas.nota')}</p>
    </Seccion>
  )
}
