import { EnlaceConRastro } from '../contexto/Rastro'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { AvisoDeConflicto, useReleer } from '../componentes/AvisoDeConflicto'
import { BuscadorDeRegistro } from '../componentes/BuscadorDeRegistro'
import { Campo, SelectNativo } from '../componentes/Campo'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Consulta, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useParametrosDeLista, VistasGuardadas } from '../componentes/Lista'
import { RegistroVinculado } from '../componentes/RegistroVinculado'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { rutaDeFicha } from '../datos/fichas'
import { atributo, texto, useActualizar, useRegistro, useTodos, useTodosConTope, type Registro } from '../datos/registros'
import { fechaPe, fechaYHoraPe, NS, numeroPe } from '../i18n'
import { BotonesDeTransicion } from '../transiciones/BotonesDeTransicion'
import { opcion } from '../datos/opciones'

// S41 · centro de alerta temprana (screens.md §9, flujo 14): las alertas del proyecto por vista (por triar, confirmadas, todas,
// cerradas), creadas por JOB-04 o a mano, y la ficha de una alerta: qué la disparó, la regla que la creó (nunca su clave de origen,
// que es de la plataforma), sus señales, «Vincular señal…» y el riesgo vinculado, con las transiciones de WF-J. solo una persona con
// la acción declarada CONFIRM_ALERT confirma o descarta (RN-EWS-001); a las demás se les dice por qué no ven esos botones
const VISTAS = ['triaje', 'activas', 'todas', 'cerradas'] as const
const ESTADOS_DE_VISTA: Record<(typeof VISTAS)[number], readonly string[] | null> = {
  triaje: ['detected', 'in_triage'],
  activas: ['confirmed', 'responding'],
  todas: null,
  cerradas: ['resolved', 'dismissed', 'closed']
}
const CONFIRMAR_ALERTA = 'CONFIRM_ALERT'
const DECISIONES = ['confirm', 'dismiss']

export function AlertasPage() {
  const { t } = useTranslation(NS)
  const { projectId = '' } = useParams()
  const lista = useParametrosDeLista('triaje')
  const alertas = useTodosConTope('early_warning', { project: projectId, sort: 'detected_at', dir: 'desc' })
  const vista = (VISTAS as readonly string[]).includes(lista.vista) ? (lista.vista as (typeof VISTAS)[number]) : 'triaje'
  const estados = ESTADOS_DE_VISTA[vista]
  const visibles = (alertas.data ?? []).filter((a) => !estados || estados.includes(a.state ?? ''))
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <h1 className="text-sg-h1 font-semibold">{t('alertas.titulo')}</h1>
      <VistasGuardadas
        vistas={VISTAS.map((v) => ({ id: v, etiqueta: t(`alertas.vistas.${v}`) }))}
        actual={vista}
        alCambiar={(v) => lista.cambiar({ view: v })}
      />
      {alertas.truncado ? <Alert tone="warning">{t('alertas.truncado', { n: numeroPe(alertas.data?.length ?? 0) })}</Alert> : null}
      {alertas.isPending ? (
        <Cargando />
      ) : alertas.isError && !alertas.data ? (
        <FalloDeLectura error={alertas.error} alReintentar={() => void alertas.refetch()} />
      ) : visibles.length === 0 ? (
        <Vacio titulo={t('alertas.vacio')} />
      ) : (
        <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
          <Table aria-label={t('alertas.tabla')}>
            <thead>
              <tr>
                {(['detectada', 'titulo', 'severidad', 'regla', 'estado'] as const).map((c) => (
                  <Th key={c} scope="col">
                    {t(`alertas.columnas.${c}`)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => (
                <tr key={a.id}>
                  <Td className="text-sm">{texto(a, 'detected_at') ? fechaPe(new Date(texto(a, 'detected_at'))) : '—'}</Td>
                  <Td className="text-sm">
                    <EnlaceConRastro to={rutaDeFicha('early_warning', a) ?? ''} className="text-sg-primary-text underline">
                      {texto(a, 'title')}
                    </EnlaceConRastro>
                  </Td>
                  <Td className="text-sm">{opcion(a, 'severity') || '—'}</Td>
                  <Td className="text-sm">
                    {atributo(a, 'early_warning_rule') ? (
                      <RegistroVinculado objeto="early_warning_rule" id={texto(a, 'early_warning_rule')} />
                    ) : (
                      <span className="text-sg-text-muted">{t('alertas.aMano')}</span>
                    )}
                  </Td>
                  <Td>
                    <EstadoChip objeto="early_warning" estado={a.state} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  )
}

export function FichaAlertaPage() {
  const { t } = useTranslation(NS)
  const { projectId = '', warningId = '' } = useParams()
  const alerta = useRegistro('early_warning', warningId)
  const volver = `/projects/${encodeURIComponent(projectId)}/risks/warnings`
  const noExiste = (
    <div className="space-y-3">
      <Alert tone="warning">{t('alertas.ficha.noExiste')}</Alert>
      <Link to={volver} className="text-sm text-sg-primary-text underline">
        {t('alertas.ficha.volver')}
      </Link>
    </div>
  )
  return (
    <Consulta consulta={alerta} noExiste={noExiste}>
      {(a) => <Ficha key={a.id} alerta={a} volver={volver} />}
    </Consulta>
  )
}

function Ficha({ alerta, volver }: { alerta: Registro; volver: string }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const proyecto = texto(alerta, 'project')
  const escribe = useEscribeEnProyecto(proyecto)
  const decide = can('early_warning', CONFIRMAR_ALERTA)
  const enTriaje = alerta.state === 'in_triage'
  return (
    <article className="mx-auto max-w-[1440px] space-y-4">
      <Link to={volver} className="text-sm text-sg-primary-text underline">
        {t('alertas.ficha.volver')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-sg-h1 font-semibold">{texto(alerta, 'title')}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <EstadoChip objeto="early_warning" estado={alerta.state} />
            <span>
              {t('alertas.ficha.severidad')}: {opcion(alerta, 'severity') || t('alertas.ficha.sinSeveridad')}
            </span>
            {texto(alerta, 'detected_at') ? <span>{t('alertas.ficha.detectada', { fecha: fechaYHoraPe(new Date(texto(alerta, 'detected_at'))) })}</span> : null}
          </div>
        </div>
        <div className="space-y-2">
          <BotonesDeTransicion objeto="early_warning" registro={alerta} proyecto={proyecto} comprobarAntes={DECISIONES} ocultar={decide ? [] : DECISIONES} />
          {enTriaje && !decide ? <p className="max-w-xs text-sg-caption text-sg-text-muted">{t('alertas.ficha.soloGestion')}</p> : null}
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section aria-label={t('alertas.ficha.disparo')} className="space-y-1">
            <h2 className="text-sg-h3 font-semibold">{t('alertas.ficha.disparo')}</h2>
            <p className="whitespace-pre-line text-sm">{texto(alerta, 'trigger_description') || '—'}</p>
          </section>
          <Senales alerta={alerta} escribe={escribe} />
        </div>
        <div className="space-y-4">
          <Regla alerta={alerta} />
          <Riesgo alerta={alerta} escribe={escribe} />
        </div>
      </div>
    </article>
  )
}

// la regla que creó la alerta: su nombre, tipo, umbral y ventana. una alerta con generator_key la creó JOB-04; la clave misma no se
// muestra: es un dato de la plataforma, no de la persona
function Regla({ alerta }: { alerta: Registro }) {
  const { t } = useTranslation(NS)
  const regla = useRegistro('early_warning_rule', atributo<string>(alerta, 'early_warning_rule') || undefined)
  const porRegla = Boolean(atributo(alerta, 'generator_key')) || Boolean(atributo(alerta, 'early_warning_rule'))
  return (
    <section aria-label={t('alertas.ficha.regla')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('alertas.ficha.regla')}</h2>
      <p>{porRegla ? t('alertas.ficha.creadaPorRegla') : t('alertas.ficha.aMano')}</p>
      {atributo(alerta, 'early_warning_rule') ? (
        regla.isPending ? (
          <Cargando compacto />
        ) : regla.isError && !regla.data ? (
          <FalloDeLectura error={regla.error} alReintentar={() => void regla.refetch()} />
        ) : regla.data ? (
          <dl className="space-y-1">
            <Dato termino={t('alertas.ficha.reglaNombre')}>{texto(regla.data, 'name')}</Dato>
            <Dato termino={t('alertas.ficha.reglaTipo')}>{opcion(regla.data, 'rule_kind')}</Dato>
            <Dato termino={t('alertas.ficha.reglaUmbral')}>{texto(regla.data, 'threshold') || '—'}</Dato>
            <Dato termino={t('alertas.ficha.reglaVentana')}>
              {texto(regla.data, 'window_days')
                ? t('alertas.ficha.reglaDias', { n: texto(regla.data, 'window_days'), count: Number(texto(regla.data, 'window_days')) })
                : '—'}
            </Dato>
          </dl>
        ) : null
      ) : null}
    </section>
  )
}

function Dato({ termino, children }: { termino: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-sg-text-muted">{termino}</dt>
      <dd>{children}</dd>
    </div>
  )
}

// el riesgo vinculado y, para quien cambia la alerta en su proyecto, buscarlo entre los riesgos del mismo proyecto (otro proyecto
// responde 409 PROJECT_MISMATCH, que se dice con su texto)
function Riesgo({ alerta, escribe }: { alerta: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const actualizar = useActualizar('early_warning')
  const releer = useReleer()
  const riesgo = atributo<string>(alerta, 'social_risk')
  return (
    <section aria-label={t('alertas.ficha.riesgo')} className="space-y-2 rounded-sg-lg border border-sg-border bg-sg-surface p-4 text-sm">
      <h2 className="text-sg-overline font-semibold uppercase text-sg-text-muted">{t('alertas.ficha.riesgo')}</h2>
      {riesgo ? <RegistroVinculado objeto="social_risk" id={riesgo} /> : <p className="text-sg-text-muted">{t('alertas.ficha.sinRiesgo')}</p>}
      {escribe && can('early_warning', 'UPDATE') ? (
        <BuscadorDeRegistro
          objeto="social_risk"
          etiqueta={t('alertas.ficha.buscarRiesgo')}
          filtros={{ project: texto(alerta, 'project') }}
          rotulo={(r) => [texto(r, 'code'), texto(r, 'title')].filter(Boolean).join(' · ')}
          alElegir={(r) => actualizar.mutate({ registro: alerta, cambios: { social_risk: r.id } })}
        />
      ) : null}
      {actualizar.isSuccess ? (
        <p role="status" className="text-sg-success">
          {t('alertas.ficha.riesgoVinculado')}
        </p>
      ) : null}
      {actualizar.isError ? (
        <AvisoDeConflicto error={actualizar.error} releer={() => releer(['record', 'early_warning', alerta.id])} alRecargar={() => actualizar.reset()} />
      ) : null}
    </section>
  )
}

// las señales que sustentan la alerta y «Vincular señal…»: una señal del mismo proyecto que todavía no tiene alerta. vincular es
// cambiar early_warning en la señal, con su versión leída
function Senales({ alerta, escribe }: { alerta: Registro; escribe: boolean }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const senales = useTodos('early_warning_signal', { early_warning: alerta.id })
  const vincula = escribe && can('early_warning_signal', 'UPDATE')
  return (
    <section aria-label={t('alertas.ficha.senales')} className="space-y-2">
      <h2 className="text-sg-h3 font-semibold">{t('alertas.ficha.senales')}</h2>
      {senales.isPending ? (
        <Cargando compacto />
      ) : senales.isError && !senales.data ? (
        <FalloDeLectura error={senales.error} alReintentar={() => void senales.refetch()} />
      ) : senales.data.length === 0 ? (
        <p className="text-sm text-sg-text-muted">{t('alertas.ficha.sinSenales')}</p>
      ) : (
        <ul className="space-y-2">
          {senales.data.map((s) => (
            <li key={s.id} className="space-y-1 rounded-sg-md border border-sg-border p-3 text-sm">
              <p className="text-sg-caption text-sg-text-muted">
                {opcion(s, 'source_type') || t('alertas.ficha.sinFuente')} · {texto(s, 'received_at') ? fechaYHoraPe(new Date(texto(s, 'received_at'))) : '—'}
              </p>
              <p className="whitespace-pre-line">{texto(s, 'description')}</p>
            </li>
          ))}
        </ul>
      )}
      {vincula ? <VincularSenal alerta={alerta} /> : null}
    </section>
  )
}

function VincularSenal({ alerta }: { alerta: Registro }) {
  const { t } = useTranslation(NS)
  const proyecto = useTodos('early_warning_signal', { project: texto(alerta, 'project') })
  const actualizar = useActualizar('early_warning_signal')
  const releer = useReleer()
  const [elegida, setElegida] = useState('')
  const libres = (proyecto.data ?? []).filter((s) => !atributo(s, 'early_warning'))
  const senal = libres.find((s) => s.id === elegida)
  return (
    <details className="rounded-sg-md border border-sg-border p-3">
      <summary className="cursor-pointer text-sm font-medium text-sg-primary-text">{t('alertas.ficha.vincularSenal')}</summary>
      <div className="mt-2 space-y-2">
        {proyecto.isPending ? (
          <Cargando compacto />
        ) : proyecto.isError && !proyecto.data ? (
          <FalloDeLectura error={proyecto.error} alReintentar={() => void proyecto.refetch()} />
        ) : libres.length === 0 ? (
          <p className="text-sm text-sg-text-muted">{t('alertas.ficha.sinSenalesLibres')}</p>
        ) : (
          <>
            <Campo etiqueta={t('alertas.ficha.senalAVincular')}>
              {(p) => (
                <SelectNativo
                  {...p}
                  value={elegida}
                  onChange={(e) => {
                    setElegida(e.target.value)
                    actualizar.reset()
                  }}
                  opciones={libres.map((s) => ({
                    valor: s.id,
                    etiqueta: `${texto(s, 'received_at') ? fechaPe(new Date(texto(s, 'received_at'))) : '—'} · ${texto(s, 'description')}`
                  }))}
                />
              )}
            </Campo>
            <Button
              size="sm"
              disabled={!senal || actualizar.isPending}
              aria-busy={actualizar.isPending}
              onClick={() =>
                senal &&
                actualizar.mutate(
                  { registro: senal, cambios: { early_warning: alerta.id } },
                  {
                    onSuccess: () => setElegida('')
                  }
                )
              }
            >
              {actualizar.isPending ? t('alertas.ficha.vinculando') : t('alertas.ficha.vincular')}
            </Button>
          </>
        )}
        {actualizar.isSuccess ? (
          <p role="status" className="text-sm text-sg-success">
            {t('alertas.ficha.senalVinculada')}
          </p>
        ) : null}
        {actualizar.isError ? (
          <AvisoDeConflicto error={actualizar.error} releer={() => releer(['records', 'early_warning_signal'])} alRecargar={() => actualizar.reset()} />
        ) : null}
      </div>
    </details>
  )
}
