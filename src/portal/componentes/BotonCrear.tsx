import { useAuth } from '@wasichai/core'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@wasichai/ui'
import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { nombreDeProyecto, useMisAsignaciones, useProyectos, vigenciaDeAsignacion } from '../contexto/proyectos'
import { atributo, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { Cargando, ErrorDeCarga } from './Estados'
import { useContextFilters } from '../shell/context'

// crear sin depender del selector de proyecto (la revisión de UX, etapa 0): dentro de un proyecto donde la cuenta escribe,
// el botón lleva al alta de ese proyecto; con el alcance global, pide el proyecto entre los que puede escribir (la regla de
// useEscribeEnProyecto: ADMIN en todos, los demás con una asignación vigente), con los suyos primero, y con uno solo va
// directo. «resto» es el trozo fijo de la ruta del alta dentro del proyecto («commitments/new»)
// «objeto» puede ser varios: se ofrece si la cuenta crea alguno (el alta de QCS registra una queja, una consulta o una solicitud).
// un alta que es un diálogo y no una página (el entregable de S49) da alElegir en lugar de resto: recibe el proyecto
export type DestinoDelAlta = { resto: string; alElegir?: never } | { alElegir: (proyecto: string) => void; resto?: never }

export function BotonCrear({ objeto, etiqueta, ...destino }: { objeto: string | readonly string[]; etiqueta: string } & DestinoDelAlta) {
  const { can } = useAuth()
  const { scope } = useContextFilters()
  if (!(typeof objeto === 'string' ? [objeto] : objeto).some((o) => can(o, 'CREATE'))) return null
  return scope.kind === 'project' ? (
    <CrearEnProyecto proyecto={scope.projectId} etiqueta={etiqueta} destino={destino} />
  ) : (
    <CrearEligiendoProyecto etiqueta={etiqueta} destino={destino} />
  )
}

const rutaDeAlta = (proyecto: string, resto: string) => `/projects/${encodeURIComponent(proyecto)}/${resto}`

function CrearEnProyecto({ proyecto, etiqueta, destino }: { proyecto: string; etiqueta: string; destino: DestinoDelAlta }) {
  const escribe = useEscribeEnProyecto(proyecto)
  if (!escribe) return null
  if (destino.alElegir) {
    const { alElegir } = destino
    return (
      <Button size="sm" onClick={() => alElegir(proyecto)}>
        <Plus aria-hidden className="size-4" />
        {etiqueta}
      </Button>
    )
  }
  return (
    <Button asChild size="sm">
      <Link to={rutaDeAlta(proyecto, destino.resto)}>
        <Plus aria-hidden className="size-4" />
        {etiqueta}
      </Link>
    </Button>
  )
}

// los proyectos donde la cuenta escribe: los de sus asignaciones vigentes y, si administra, además todos los demás
function useProyectosParaCrear(): { proyectos: Registro[]; cargando: boolean; fallo: unknown; releer: () => void } {
  const { isAdmin } = useAuth()
  const proyectos = useProyectos()
  const asignaciones = useMisAsignaciones()
  const suyos = new Set((asignaciones.data ?? []).filter((a) => vigenciaDeAsignacion(a) === 'vigente').map((a) => String(atributo(a, 'project'))))
  const todos = proyectos.data ?? []
  const primero = todos.filter((p) => suyos.has(p.id))
  return {
    proyectos: isAdmin ? [...primero, ...todos.filter((p) => !suyos.has(p.id))] : primero,
    cargando: proyectos.isPending || asignaciones.isPending,
    fallo: proyectos.error ?? asignaciones.error,
    releer: () => {
      if (proyectos.isError) void proyectos.refetch()
      if (asignaciones.isError) void asignaciones.refetch()
    }
  }
}

// el último proyecto elegido para crear, de quien mira (tercera pasada de UX, 2.6): el diálogo lo propone la próxima vez, si la
// cuenta sigue escribiendo en él. es una comodidad de este navegador: sin almacenamiento, el diálogo empieza sin proyecto
const claveDelUltimo = (usuario: string | undefined) => `sgspe.crear.ultimoProyecto.${usuario ?? ''}`
function leerUltimo(clave: string): string {
  try {
    return localStorage.getItem(clave) ?? ''
  } catch {
    return ''
  }
}
function guardarUltimo(clave: string, proyecto: string) {
  try {
    localStorage.setItem(clave, proyecto)
  } catch {
    // sin almacenamiento, no se recuerda
  }
}

function CrearEligiendoProyecto({ etiqueta, destino }: { etiqueta: string; destino: DestinoDelAlta }) {
  const { t } = useTranslation(NS)
  const { user } = useAuth()
  const ultimo = claveDelUltimo(user?.id)
  const navegarA = useNavigate()
  const { proyectos, cargando, fallo, releer } = useProyectosParaCrear()
  const [abierto, setAbierto] = useState(false)
  const [elegido, setElegido] = useState('')
  const id = useId()
  const ir = (proyecto: string) => {
    setAbierto(false)
    guardarUltimo(ultimo, proyecto)
    if (destino.alElegir) destino.alElegir(proyecto)
    else navegarA(rutaDeAlta(proyecto, destino.resto))
  }
  const abrir = () => {
    if (!cargando && !fallo && proyectos.length === 1) return ir(proyectos[0].id)
    const anterior = leerUltimo(ultimo)
    setElegido(proyectos.some((p) => p.id === anterior) ? anterior : '')
    setAbierto(true)
  }
  return (
    <>
      {/* mientras se leen los proyectos no se sabe si hay uno solo (que va directo) o varios (que se eligen) */}
      <Button size="sm" onClick={abrir} disabled={cargando} aria-busy={cargando || undefined}>
        <Plus aria-hidden className="size-4" />
        {etiqueta}
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-md space-y-4">
          <DialogTitle className="text-sg-h3 font-semibold">{t('paginas.crear.titulo')}</DialogTitle>
          {fallo ? (
            <ErrorDeCarga error={fallo} alReintentar={releer} />
          ) : cargando ? (
            <Cargando compacto />
          ) : proyectos.length === 0 ? (
            <>
              <DialogDescription>{t('paginas.crear.sinProyectos')}</DialogDescription>
              <div className="flex justify-end">
                <Button size="sm" variant="secondary" onClick={() => setAbierto(false)}>
                  {t('paginas.crear.cancelar')}
                </Button>
              </div>
            </>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (elegido) ir(elegido)
              }}
            >
              <DialogDescription>{t('paginas.crear.texto')}</DialogDescription>
              <div className="space-y-1">
                <label htmlFor={id} className="text-sm font-medium">
                  {t('paginas.crear.proyecto')}
                </label>
                <select
                  id={id}
                  value={elegido}
                  onChange={(e) => setElegido(e.target.value)}
                  className="h-9 w-full rounded-sg-md border border-sg-border-control bg-sg-surface px-2 text-sm"
                >
                  <option value="">{t('paginas.crear.elegir')}</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {nombreDeProyecto(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setAbierto(false)}>
                  {t('paginas.crear.cancelar')}
                </Button>
                <Button type="submit" size="sm" disabled={!elegido}>
                  {t('paginas.crear.continuar')}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
