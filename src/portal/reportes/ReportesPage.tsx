import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@wasichai/core'
import { Alert, Button, Table, Td, Th } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Campo, SelectNativo } from '../componentes/Campo'
import { correlacionDe, useMensajeDeError } from '../componentes/errores'
import { Cargando, Vacio } from '../componentes/Estados'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useProyectos } from '../contexto/proyectos'
import { ACEPTAR_REPORTE, guardarArchivo, nuevaClave, usePedir } from '../datos/http'
import { atributo, texto, useDefinicion, useRegistros } from '../datos/registros'
import { fechaPe, NS, numeroPe } from '../i18n'
import { useContextFilters } from '../shell/context'

// S49 en F2 · reportes y exportaciones: el registro de grupos de interés en XLSX (api.md §4.13) con el nivel de divulgación
// elegido; una salida fuera de la organización exige confirmar la lista de verificación (checklistConfirmed, RQ-REP-033).
// EXTERNO cita a las personas por cargo o por código GI- (un seudónimo, deliverables.md §9.1); PUBLICO marca «reservado»
// todo conteo menor que 5 y advierte no publicar dos salidas que difieran en pocas personas (ASM-088). con un solo proyecto
// sin asignación vigente, 403 NOT_ASSIGNED; pasarse del tope, 400 TOO_MANY_RECORDS; un catálogo vacío en PUBLICO, 409
// CATALOGUE_UNAVAILABLE con el campo.
// toda exportación queda en export_log (RQ-AUD-011). export_log es un objeto reservado: exportar pide EXPORT y CREATE
// sobre él, pero el registro de exportaciones solo se ofrece a quien lo lee (security.md §7.8: SOCIAL_MANAGER y AUDITOR);
// quien no lo lee exporta igual y no ve el historial
const NIVELES = ['INTERNO', 'EXTERNO', 'PUBLICO']
const EXPORTACIONES_A_LA_VISTA = 20

export function ReportesPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const { scope } = useContextFilters()
  const pedir = usePedir()
  const cliente = useQueryClient()
  const mensaje = useMensajeDeError()
  const proyectos = useProyectos()
  const verHistorial = can('export_log', 'READ')
  // export_log es un objeto reservado: quien no lo lee no pide su definición (los niveles tienen respaldo en NIVELES)
  const definicion = useDefinicion(verHistorial ? 'export_log' : undefined)
  // el proyecto de la URL, salvo que la persona elija otro; '' es «todos mis proyectos». lo elegido vale solo para el
  // proyecto de la URL con el que se eligió: si el conmutador del shell cambia de proyecto, manda la URL otra vez
  const delaUrl = scope.kind === 'project' ? scope.projectId : ''
  const [elegido, setElegido] = useState<{ valor: string; desde: string } | null>(null)
  const proyecto = elegido && elegido.desde === delaUrl ? elegido.valor : delaUrl
  const historial = useRegistros(
    'export_log',
    { project: proyecto || undefined, sort: 'exported_at', dir: 'desc', size: EXPORTACIONES_A_LA_VISTA, count: false },
    verHistorial
  )
  const [nivel, setNivel] = useState('INTERNO')
  const [checklist, setChecklist] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const niveles = definicion.data?.fields.find((f) => f.name === 'disclosure_level')?.enumOptions ?? NIVELES
  const externo = nivel !== 'INTERNO'
  const exportar = useMutation({
    // una clave por exportación pedida: una segunda de la misma sesión no se confunde con un reintento de la primera (§3.5)
    mutationFn: () =>
      pedir.archivo('/sgspe/exports/stakeholder-register', {
        json: { filters: { project: proyecto ? [proyecto] : [] }, disclosureLevel: nivel, checklistConfirmed: externo ? checklist : false },
        clave: nuevaClave(),
        aceptar: ACEPTAR_REPORTE
      }),
    onSuccess: (archivo) => {
      guardarArchivo(archivo, 'registro-de-grupos-de-interes.xlsx')
      void cliente.invalidateQueries({ queryKey: ['records', 'export_log'] })
    }
  })
  const pedirExportacion = () => {
    setIntentado(true)
    if (externo && !checklist) return
    exportar.mutate()
  }
  // un pedido nuevo no arrastra el error del anterior
  const cambiarProyecto = (id: string) => {
    setElegido({ valor: id, desde: delaUrl })
    exportar.reset()
  }
  const cambiarNivel = (valor: string) => {
    setNivel(valor)
    setChecklist(false)
    setIntentado(false)
    exportar.reset()
  }
  const lista = proyectos.data ?? []
  // mientras la lista carga (o si falla), el proyecto de la URL sigue a la vista en el selector
  const faltaEnLista = proyecto !== '' && !lista.some((x) => x.id === proyecto)
  const correlacion = correlacionDe(exportar.error)

  return (
    <section className="mx-auto max-w-[1100px] space-y-4">
      <h1 className="text-sg-h1 font-semibold">{t('reportes.titulo')}</h1>
      <section aria-label={t('reportes.registroDeGrupos')} className="space-y-3 rounded-sg-lg border border-sg-border bg-sg-surface p-4">
        <h2 className="text-sg-h3 font-semibold">{t('reportes.registroDeGrupos')}</h2>
        <p className="text-sm text-sg-text-secondary">{t('reportes.registroAyuda')}</p>
        {can('stakeholder', 'EXPORT') ? (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Campo etiqueta={t('reportes.proyecto')}>
                {(p) => (
                  <select
                    {...p}
                    className="h-9 w-full rounded-sg-md border border-sg-border-strong bg-sg-surface px-2.5 text-sm"
                    value={proyecto}
                    onChange={(e) => cambiarProyecto(e.target.value)}
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
              <Campo etiqueta={t('reportes.nivel')}>
                {(p) => (
                  <SelectNativo
                    {...p}
                    vacio={false}
                    value={nivel}
                    onChange={(e) => cambiarNivel(e.target.value)}
                    opciones={niveles.map((n) => ({ valor: n, etiqueta: `${n} · ${t(`reportes.niveles.${n}`, { defaultValue: n })}` }))}
                  />
                )}
              </Campo>
            </div>
            {proyectos.isError ? <FalloDeLectura error={proyectos.error} alReintentar={() => void proyectos.refetch()} /> : null}
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
                <p>{mensaje(exportar.error, { NOT_ASSIGNED: t('reportes.errores.NOT_ASSIGNED'), TOO_MANY_RECORDS: t('reportes.errores.TOO_MANY_RECORDS') })}</p>
                {correlacion ? <p className="font-sg-mono text-sg-caption">{t('comun.correlacion', { id: correlacion })}</p> : null}
              </Alert>
            ) : null}
            <Button onClick={pedirExportacion} disabled={exportar.isPending} aria-busy={exportar.isPending}>
              {exportar.isPending ? t('reportes.exportando') : t('reportes.exportar')}
            </Button>
          </>
        ) : (
          <Alert tone="notice">{t('reportes.sinPermiso')}</Alert>
        )}
      </section>
      {verHistorial ? (
        <section aria-label={t('reportes.historial')} className="space-y-2">
          <h2 className="text-sg-h3 font-semibold">{t('reportes.historial')}</h2>
          <p className="text-sm text-sg-text-muted">{t('reportes.historialAyuda')}</p>
          {historial.isPending ? (
            <Cargando compacto />
          ) : historial.isError && !historial.data ? (
            <FalloDeLectura error={historial.error} alReintentar={() => void historial.refetch()} />
          ) : historial.data && historial.data.content.length === 0 ? (
            <Vacio titulo={t('reportes.historialVacio')} />
          ) : (
            <Table aria-label={t('reportes.historial')}>
              <thead>
                <tr>
                  {(['fecha', 'quien', 'objeto', 'nivel', 'filas'] as const).map((c) => (
                    <Th key={c} scope="col">
                      {t(`reportes.columnas.${c}`)}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(historial.data?.content ?? []).map((e) => (
                  <tr key={e.id}>
                    <Td className="text-sm">{atributo(e, 'exported_at') ? fechaPe(new Date(String(atributo(e, 'exported_at')))) : '—'}</Td>
                    <Td className="text-sm">{texto(e, 'exporter_user_email') || '—'}</Td>
                    <Td className="text-sm">{texto(e, 'object_name')}</Td>
                    <Td className="text-sm">{texto(e, 'disclosure_level')}</Td>
                    <Td className="text-sm tabular-nums">
                      {atributo(e, 'row_count') === null || atributo(e, 'row_count') === undefined ? '—' : numeroPe(Number(atributo(e, 'row_count')))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      ) : null}
      <p className="text-sm text-sg-text-muted">{t('reportes.otrasLlegan')}</p>
    </section>
  )
}
