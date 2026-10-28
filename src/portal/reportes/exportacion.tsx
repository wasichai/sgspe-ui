import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Campo, SelectNativo } from '../componentes/Campo'
import { correlacionDe, useMensajeDeError, type MensajesPropios } from '../componentes/errores'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { useLeeTodosLosProyectos, useProyectos } from '../contexto/proyectos'
import { ACEPTAR_REPORTE, guardarArchivo, nuevaClave, usePedir } from '../datos/http'
import { texto } from '../datos/registros'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { rotuloDeOpcion } from '../datos/opciones'

// lo que comparten las exportaciones de Reportes (api.md §4.13): el proyecto, el nivel de divulgación, la lista de verificación
// de una salida fuera de la organización (checklistConfirmed, RQ-REP-033), el pedido con su propia clave y el error. cada
// exportación pone solo sus filtros y sus textos: lo que dice un nivel depende de lo que esa exportación escribe
export const NIVELES = ['INTERNO', 'EXTERNO', 'PUBLICO']

// el proyecto de la URL, salvo que la persona elija otro; '' es «todos mis proyectos» (o «todos los proyectos» para quien los
// lee todos, plan 4.4b). lo elegido vale solo para el proyecto
// de la URL con el que se eligió: si el conmutador del shell cambia de proyecto, manda la URL otra vez
// el proyecto de una exportación es el del alcance de la barra superior (revisión de UX, etapa 7): ninguna exportación tiene su
// propio selector; sin proyecto en la barra, salen todos los que la cuenta lee
export function useProyectoElegido() {
  const { scope } = useContextFilters()
  return { proyecto: scope.kind === 'project' ? scope.projectId : '' }
}

// extra suma las claves propias de una exportación al cuerpo (la geográfica: object, geometry, format y coordinates, spec F6
// §3.5); aceptar cambia el Accept (la geográfica entrega varios formatos) y conClave = false no manda Idempotency-Key (la
// geográfica no crea registros de negocio y el servidor la ignora, api.md §4.2)
export function useExportacion({
  ruta,
  filtros,
  nombre,
  extra,
  aceptar = ACEPTAR_REPORTE,
  conClave = true
}: {
  ruta: string
  filtros: () => Record<string, unknown>
  nombre: string | (() => string)
  extra?: () => Record<string, unknown>
  aceptar?: string
  conClave?: boolean
}) {
  const pedir = usePedir()
  const cliente = useQueryClient()
  const [nivel, setNivel] = useState('INTERNO')
  const [checklist, setChecklist] = useState(false)
  const [intentado, setIntentado] = useState(false)
  // lo último que se descargó, con su nivel: la descarga del navegador no lo dice en la página (tercera pasada de UX, 4.5)
  const [descargado, setDescargado] = useState<{ archivo: string; nivel: string } | null>(null)
  const externo = nivel !== 'INTERNO'
  const exportar = useMutation({
    // una clave por exportación pedida: una segunda de la misma sesión no se confunde con un reintento de la primera (§3.5)
    mutationFn: () =>
      pedir.archivo(ruta, {
        json: { ...(extra?.() ?? {}), filters: filtros(), disclosureLevel: nivel, checklistConfirmed: externo ? checklist : false },
        clave: conClave ? nuevaClave() : null,
        aceptar
      }),
    onSuccess: (archivo) => {
      const elNombre = typeof nombre === 'function' ? nombre() : nombre
      guardarArchivo(archivo, elNombre)
      setDescargado({ archivo: archivo.nombre ?? elNombre, nivel })
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
    descargado,
    pedirExportacion: () => {
      setIntentado(true)
      setDescargado(null)
      if (externo && !checklist) return
      exportar.mutate()
    },
    // otro nivel pide de nuevo la lista de verificación
    cambiarNivel: (valor: string) => {
      setNivel(valor)
      setChecklist(false)
      setIntentado(false)
      setDescargado(null)
      exportar.reset()
    },
    // un filtro nuevo no arrastra el error del pedido anterior ni la confirmación de la descarga anterior
    reiniciar: () => {
      setDescargado(null)
      exportar.reset()
    }
  }
}

export type Exportacion = ReturnType<typeof useExportacion>

// el alcance de una exportación, dicho: el proyecto de la barra superior o todos los que la cuenta lee
export function AlcanceDeLaExportacion({ proyecto }: { proyecto: string }) {
  const { t } = useTranslation(NS)
  const proyectos = useProyectos()
  const leeTodo = useLeeTodosLosProyectos()
  const elegido = proyectos.data?.find((x) => x.id === proyecto)
  const nombre = elegido ? `${texto(elegido, 'code')} · ${texto(elegido, 'name')}` : t('reportes.proyectoDeLaPagina')
  return (
    <p className="text-sm text-sg-text-secondary">
      {proyecto ? t('reportes.alcance.proyecto', { proyecto: nombre }) : leeTodo ? t('reportes.alcance.todos') : t('reportes.alcance.mios')}
    </p>
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
          opciones={niveles.map((n) => ({ valor: n, etiqueta: `${rotuloDeOpcion(n)} · ${t(`${descripciones}.${n}`, { defaultValue: n })}` }))}
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
  const { exportar, pedirExportacion, descargado } = exportacion
  const correlacion = correlacionDe(exportar.error)
  return (
    <>
      {descargado ? (
        <p role="status" className="text-sm text-sg-success">
          {t('reportes.descargado', { archivo: descargado.archivo, nivel: rotuloDeOpcion(descargado.nivel) })}
        </p>
      ) : null}
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

// un filtro de varios valores como casillas (los tipos, los estados, las categorías, los niveles): sin ninguna marcada, todos.
// cambiar una casilla quita el error del pedido anterior
export function CasillasDeFiltro({
  leyenda,
  ayuda,
  opciones,
  elegidas,
  alCambiar
}: {
  leyenda: string
  ayuda?: string
  opciones: { valor: string; etiqueta: string }[]
  elegidas: ReadonlySet<string>
  alCambiar: (elegidas: Set<string>) => void
}) {
  return (
    <fieldset className="space-y-1 text-sm">
      <legend className="font-medium">{leyenda}</legend>
      {ayuda ? <p className="text-sg-caption text-sg-text-muted">{ayuda}</p> : null}
      <div className="flex flex-wrap gap-3">
        {opciones.map((o) => (
          <label key={o.valor} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={elegidas.has(o.valor)}
              onChange={(e) => {
                const siguiente = new Set(elegidas)
                if (e.target.checked) siguiente.add(o.valor)
                else siguiente.delete(o.valor)
                alCambiar(siguiente)
              }}
            />
            {o.etiqueta}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
