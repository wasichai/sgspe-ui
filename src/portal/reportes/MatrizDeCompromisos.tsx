import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Campo, SelectNativo } from '../componentes/Campo'
import { useEtiquetasDeEstado } from '../componentes/EstadoChip'
import { correlacionDe, useMensajeDeError } from '../componentes/errores'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useProyectos } from '../contexto/proyectos'
import { ACEPTAR_REPORTE, guardarArchivo, nuevaClave, usePedir } from '../datos/http'
import { texto, useTodos } from '../datos/registros'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'

// S49 en F3 · la matriz de compromisos (POST /api/sgspe/exports/commitment-matrix, api.md §4.13; deliverables.md §10): el
// proyecto (o «todos mis proyectos»), la campaña, los estados de WF-D y el nivel de divulgación, con la lista de verificación
// para una salida fuera de la organización (RQ-REP-033). queda en export_log como las demás exportaciones. los errores son los
// del registro de grupos de interés más INVALID_FILTER sobre filters.state
const NIVELES = ['INTERNO', 'EXTERNO', 'PUBLICO']

export function MatrizDeCompromisos() {
  const { t } = useTranslation(NS)
  const { scope } = useContextFilters()
  const pedir = usePedir()
  const cliente = useQueryClient()
  const mensaje = useMensajeDeError()
  const proyectos = useProyectos()
  const etiquetas = useEtiquetasDeEstado('commitment')
  const delaUrl = scope.kind === 'project' ? scope.projectId : ''
  const [elegido, setElegido] = useState<{ valor: string; desde: string } | null>(null)
  const proyecto = elegido && elegido.desde === delaUrl ? elegido.valor : delaUrl
  const campanas = useTodos('exploration_campaign', { project: proyecto || undefined }, proyecto !== '')
  const [campana, setCampana] = useState('')
  const [estados, setEstados] = useState<Set<string>>(new Set())
  const [nivel, setNivel] = useState('INTERNO')
  const [checklist, setChecklist] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const externo = nivel !== 'INTERNO'
  const exportar = useMutation({
    // una clave por exportación pedida, como el registro de grupos de interés (§3.5)
    mutationFn: () =>
      pedir.archivo('/sgspe/exports/commitment-matrix', {
        json: {
          filters: { project: proyecto ? [proyecto] : [], ...(campana ? { explorationCampaign: campana } : {}), state: [...estados] },
          disclosureLevel: nivel,
          checklistConfirmed: externo ? checklist : false
        },
        clave: nuevaClave(),
        aceptar: ACEPTAR_REPORTE
      }),
    onSuccess: (archivo) => {
      guardarArchivo(archivo, 'matriz-de-compromisos.xlsx')
      void cliente.invalidateQueries({ queryKey: ['records', 'export_log'] })
    }
  })
  const pedirExportacion = () => {
    setIntentado(true)
    if (externo && !checklist) return
    exportar.mutate()
  }
  const cambiarNivel = (valor: string) => {
    setNivel(valor)
    setChecklist(false)
    setIntentado(false)
    exportar.reset()
  }
  const lista = proyectos.data ?? []
  const faltaEnLista = proyecto !== '' && !lista.some((x) => x.id === proyecto)
  const correlacion = correlacionDe(exportar.error)
  return (
    <section aria-label={t('reportes.matriz.titulo')} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
      <h2 className="text-sg-h3 font-semibold">{t('reportes.matriz.titulo')}</h2>
      <p className="text-sm text-sg-text-secondary">{t('reportes.matriz.ayuda')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Campo etiqueta={t('reportes.proyecto')}>
          {(p) => (
            <select
              {...p}
              className="h-9 w-full rounded-sg-md border border-sg-border-strong bg-sg-surface px-2.5 text-sm"
              value={proyecto}
              onChange={(e) => {
                setElegido({ valor: e.target.value, desde: delaUrl })
                setCampana('')
                exportar.reset()
              }}
            >
              <option value="">{t('reportes.todosMisProyectos')}</option>
              {faltaEnLista ? (
                <option value={proyecto}>{proyectos.isPending ? t('reportes.proyectosCargando') : t('reportes.proyectoDeLaPagina')}</option>
              ) : null}
              {lista.map((x) => (
                <option key={x.id} value={x.id}>
                  {texto(x, 'code')} · {texto(x, 'name')}
                </option>
              ))}
            </select>
          )}
        </Campo>
        {proyecto ? (
          <Campo etiqueta={t('reportes.matriz.campana')}>
            {(p) => (
              <select
                {...p}
                className="h-9 w-full rounded-sg-md border border-sg-border-strong bg-sg-surface px-2.5 text-sm"
                value={campana}
                onChange={(e) => setCampana(e.target.value)}
              >
                <option value="">{t('reportes.matriz.todas')}</option>
                {(campanas.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {texto(c, 'name')}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        ) : null}
        <Campo etiqueta={t('reportes.nivel')}>
          {(p) => (
            <SelectNativo
              {...p}
              vacio={false}
              value={nivel}
              onChange={(e) => cambiarNivel(e.target.value)}
              opciones={NIVELES.map((n) => ({ valor: n, etiqueta: `${n} · ${t(`reportes.niveles.${n}`, { defaultValue: n })}` }))}
            />
          )}
        </Campo>
      </div>
      {proyectos.isError ? <FalloDeLectura error={proyectos.error} alReintentar={() => void proyectos.refetch()} /> : null}
      {campanas.isError && !campanas.data ? <FalloDeLectura error={campanas.error} alReintentar={() => void campanas.refetch()} /> : null}
      <fieldset className="space-y-1 text-sm">
        <legend className="font-medium">{t('reportes.matriz.estados')}</legend>
        <p className="text-sg-caption text-sg-text-muted">{t('reportes.matriz.estadosAyuda')}</p>
        <p className="text-sg-caption text-sg-text-muted">{t('reportes.matriz.plazo')}</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(etiquetas).map(([estado, etiqueta]) => (
            <label key={estado} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={estados.has(estado)}
                onChange={(e) => {
                  const siguiente = new Set(estados)
                  if (e.target.checked) siguiente.add(estado)
                  else siguiente.delete(estado)
                  setEstados(siguiente)
                }}
              />
              {etiqueta}
            </label>
          ))}
        </div>
      </fieldset>
      {nivel === 'EXTERNO' ? <p className="text-sg-caption text-sg-text-muted">{t('reportes.externoAyuda')}</p> : null}
      {nivel === 'PUBLICO' ? (
        <>
          <p className="text-sg-caption text-sg-text-muted">{t('reportes.publicoAyuda')}</p>
          <Alert tone="warning">{t('reportes.publicoAdvertencia')}</Alert>
        </>
      ) : null}
      {externo ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={checklist} onChange={(e) => setChecklist(e.target.checked)} className="mt-1" />
          {t('reportes.checklist')}
        </label>
      ) : null}
      {intentado && externo && !checklist ? (
        <p role="alert" className="text-sg-caption text-sg-danger">
          {t('reportes.checklistFalta')}
        </p>
      ) : null}
      {exportar.isError ? (
        <Alert tone="danger">
          <p>
            {mensaje(exportar.error, {
              NOT_ASSIGNED: t('reportes.errores.NOT_ASSIGNED'),
              TOO_MANY_RECORDS: t('reportes.matriz.errores.TOO_MANY_RECORDS'),
              INVALID_FILTER: t('reportes.matriz.errores.INVALID_FILTER')
            })}
          </p>
          {correlacion ? <p className="font-sg-mono text-sg-caption">{t('comun.correlacion', { id: correlacion })}</p> : null}
        </Alert>
      ) : null}
      <Button onClick={pedirExportacion} disabled={exportar.isPending} aria-busy={exportar.isPending}>
        {exportar.isPending ? t('reportes.exportando') : t('reportes.matriz.exportar')}
      </Button>
    </section>
  )
}
