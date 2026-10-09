import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Campo, SelectNativo } from '../componentes/Campo'
import { correlacionDe, useMensajeDeError, type MensajesPropios } from '../componentes/errores'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useProyectos } from '../contexto/proyectos'
import { ACEPTAR_REPORTE, guardarArchivo, nuevaClave, usePedir } from '../datos/http'
import { texto } from '../datos/registros'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'

// lo que comparten las exportaciones de Reportes (api.md §4.13): el proyecto, el nivel de divulgación, la lista de verificación
// de una salida fuera de la organización (checklistConfirmed, RQ-REP-033), el pedido con su propia clave y el error. cada
// exportación pone solo sus filtros y sus textos: lo que dice un nivel depende de lo que esa exportación escribe
export const NIVELES = ['INTERNO', 'EXTERNO', 'PUBLICO']

// el proyecto de la URL, salvo que la persona elija otro; '' es «todos mis proyectos». lo elegido vale solo para el proyecto
// de la URL con el que se eligió: si el conmutador del shell cambia de proyecto, manda la URL otra vez
export function useProyectoElegido() {
  const { scope } = useContextFilters()
  const delaUrl = scope.kind === 'project' ? scope.projectId : ''
  const [elegido, setElegido] = useState<{ valor: string; desde: string } | null>(null)
  const proyecto = elegido && elegido.desde === delaUrl ? elegido.valor : delaUrl
  return { proyecto, elegir: (id: string) => setElegido({ valor: id, desde: delaUrl }) }
}

export function useExportacion({ ruta, filtros, nombre }: { ruta: string; filtros: () => Record<string, unknown>; nombre: string }) {
  const pedir = usePedir()
  const cliente = useQueryClient()
  const [nivel, setNivel] = useState('INTERNO')
  const [checklist, setChecklist] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const externo = nivel !== 'INTERNO'
  const exportar = useMutation({
    // una clave por exportación pedida: una segunda de la misma sesión no se confunde con un reintento de la primera (§3.5)
    mutationFn: () =>
      pedir.archivo(ruta, {
        json: { filters: filtros(), disclosureLevel: nivel, checklistConfirmed: externo ? checklist : false },
        clave: nuevaClave(),
        aceptar: ACEPTAR_REPORTE
      }),
    onSuccess: (archivo) => {
      guardarArchivo(archivo, nombre)
      void cliente.invalidateQueries({ queryKey: ['records', 'export_log'] })
    }
  })
  return {
    nivel,
    externo,
    checklist,
    setChecklist,
    intentado,
    exportar,
    pedirExportacion: () => {
      setIntentado(true)
      if (externo && !checklist) return
      exportar.mutate()
    },
    // otro nivel pide de nuevo la lista de verificación
    cambiarNivel: (valor: string) => {
      setNivel(valor)
      setChecklist(false)
      setIntentado(false)
      exportar.reset()
    },
    // un filtro nuevo no arrastra el error del pedido anterior
    reiniciar: () => exportar.reset()
  }
}

export type Exportacion = ReturnType<typeof useExportacion>

export function SelectorDeProyecto({ proyecto, alCambiar }: { proyecto: string; alCambiar: (id: string) => void }) {
  const { t } = useTranslation(NS)
  const proyectos = useProyectos()
  const lista = proyectos.data ?? []
  // mientras la lista carga (o si falla), el proyecto de la URL sigue a la vista en el selector
  const faltaEnLista = proyecto !== '' && !lista.some((x) => x.id === proyecto)
  return (
    <Campo etiqueta={t('reportes.proyecto')}>
      {(p) => (
        <select
          {...p}
          className="h-9 w-full rounded-sg-md border border-sg-border-strong bg-sg-surface px-2.5 text-sm"
          value={proyecto}
          onChange={(e) => alCambiar(e.target.value)}
        >
          <option value="">{t('reportes.todosMisProyectos')}</option>
          {faltaEnLista ? <option value={proyecto}>{proyectos.isPending ? t('reportes.proyectosCargando') : t('reportes.proyectoDeLaPagina')}</option> : null}
          {lista.map((x) => (
            <option key={x.id} value={x.id}>
              {texto(x, 'code')} · {texto(x, 'name')}
            </option>
          ))}
        </select>
      )}
    </Campo>
  )
}

export function FalloDeProyectos() {
  const proyectos = useProyectos()
  return proyectos.isError ? <FalloDeLectura error={proyectos.error} alReintentar={() => void proyectos.refetch()} /> : null
}

// `descripciones` son los textos de cada nivel para esta exportación (lo que su archivo lleva en ese nivel)
export function SelectorDeNivel({ exportacion, niveles, descripciones }: { exportacion: Exportacion; niveles: string[]; descripciones: string }) {
  const { t } = useTranslation(NS)
  return (
    <Campo etiqueta={t('reportes.nivel')}>
      {(p) => (
        <SelectNativo
          {...p}
          vacio={false}
          value={exportacion.nivel}
          onChange={(e) => exportacion.cambiarNivel(e.target.value)}
          opciones={niveles.map((n) => ({ valor: n, etiqueta: `${n} · ${t(`${descripciones}.${n}`, { defaultValue: n })}` }))}
        />
      )}
    </Campo>
  )
}

// la ayuda de EXTERNO y PUBLICO, la advertencia de PUBLICO y la lista de verificación, con los textos de cada exportación
export function SalidaFueraDeLaOrganizacion({
  exportacion,
  textos
}: {
  exportacion: Exportacion
  textos: { externoAyuda: string; publicoAyuda: string; checklist: string }
}) {
  const { t } = useTranslation(NS)
  const { nivel, externo, checklist, setChecklist, intentado } = exportacion
  return (
    <>
      {nivel === 'EXTERNO' ? <p className="text-sg-caption text-sg-text-muted">{textos.externoAyuda}</p> : null}
      {nivel === 'PUBLICO' ? (
        <>
          <p className="text-sg-caption text-sg-text-muted">{textos.publicoAyuda}</p>
          <Alert tone="warning">{t('reportes.publicoAdvertencia')}</Alert>
        </>
      ) : null}
      {externo ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={checklist} onChange={(e) => setChecklist(e.target.checked)} className="mt-1" />
          {textos.checklist}
        </label>
      ) : null}
      {intentado && externo && !checklist ? (
        <p role="alert" className="text-sg-caption text-sg-danger">
          {t('reportes.checklistFalta')}
        </p>
      ) : null}
    </>
  )
}

export function ErrorYBotonDeExportar({
  exportacion,
  propios,
  etiqueta
}: {
  exportacion: Exportacion
  propios: (error: unknown) => MensajesPropios
  etiqueta: string
}) {
  const { t } = useTranslation(NS)
  const mensaje = useMensajeDeError()
  const { exportar, pedirExportacion } = exportacion
  const correlacion = correlacionDe(exportar.error)
  return (
    <>
      {exportar.isError ? (
        <Alert tone="danger">
          <p>{mensaje(exportar.error, propios(exportar.error))}</p>
          {correlacion ? <p className="font-sg-mono text-sg-caption">{t('comun.correlacion', { id: correlacion })}</p> : null}
        </Alert>
      ) : null}
      <Button onClick={pedirExportacion} disabled={exportar.isPending} aria-busy={exportar.isPending}>
        {exportar.isPending ? t('reportes.exportando') : etiqueta}
      </Button>
    </>
  )
}
