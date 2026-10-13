import { useQueries } from '@tanstack/react-query'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { usePedir } from '../datos/http'
import { consulta, leerTodos, texto, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { VistaMarkdown } from '../relacionamiento/markdown'
import { partirMarcadores } from './marcadores'

// cómo se dice una persona citada por la IA, con los permisos de quien mira (security.md §7.8, decisión 9 del plan): sus
// nombres; sin ellos, su cargo vigente; sin cargo legible, «persona». nombre es null si no se leen los nombres: el texto que
// se prellena en un formulario no lleva el cargo, que no es su nombre
export interface NombreDePersona {
  nombre: string | null
  visible: string
}

const nombreDe = (persona: Registro | undefined): string | null => [texto(persona, 'given_names'), texto(persona, 'surnames')].filter(Boolean).join(' ') || null

export function useNombresDePersonas(ids: readonly string[]): { nombres: Map<string, NombreDePersona>; listo: boolean } {
  const { t } = useTranslation(NS)
  const pedir = usePedir()
  // la misma clave que useRegistro: lo que ya se leyó no se pide otra vez
  const personas = useQueries({
    queries: ids.map((id) => ({ queryKey: ['record', 'person', id], queryFn: () => pedir<Registro>(`/objects/person/records/${id}`) }))
  })
  const sinNombre = ids.filter((_, i) => personas[i] !== undefined && !personas[i].isPending && !nombreDe(personas[i].data))
  // la misma clave que useTodos('position', { person })
  const cargos = useQueries({
    queries: sinNombre.map((id) => ({
      queryKey: ['records', 'position', 'todos', consulta({ person: id })],
      queryFn: () => leerTodos(pedir, 'position', { person: id })
    }))
  })
  const nombres = new Map<string, NombreDePersona>()
  let listo = true
  ids.forEach((id, i) => {
    const persona = personas[i]
    if (!persona || persona.isPending) {
      listo = false
      nombres.set(id, { nombre: null, visible: '…' })
      return
    }
    const nombre = nombreDe(persona.data)
    if (nombre) {
      nombres.set(id, { nombre, visible: nombre })
      return
    }
    const lectura = cargos[sinNombre.indexOf(id)]
    if (!lectura || lectura.isPending) {
      listo = false
      nombres.set(id, { nombre: null, visible: '…' })
      return
    }
    const lista = lectura.data ?? []
    const cargo = lista.find((c) => texto(c, 'position_status') === 'VIGENTE') ?? lista[0]
    const titulo = texto(cargo, 'position_title')
    nombres.set(id, { nombre: null, visible: titulo ? t('ia.marcadores.cargo', { cargo: titulo }) : t('ia.marcadores.PERSONA') })
  })
  return { nombres, listo }
}

// los nombres que se pueden escribir en un formulario: solo los legibles
export function nombresReales(nombres: ReadonlyMap<string, NombreDePersona>): Map<string, string> {
  const reales = new Map<string, string>()
  for (const [id, n] of nombres) if (n.nombre) reales.set(id, n.nombre)
  return reales
}

function Reservado({ children }: { children: ReactNode }) {
  const { t } = useTranslation(NS)
  return (
    <span className="rounded-sg-md bg-sg-surface-sunken px-1 text-sg-text-secondary" title={t('ia.marcadores.ayuda')}>
      {children}
    </span>
  )
}

// una línea de una salida de la IA con sus marcadores dichos como corresponde; todo es texto de React, nunca HTML
function EnLinea({ texto: contenido }: { texto: string }) {
  const { t } = useTranslation(NS)
  const segmentos = partirMarcadores(contenido)
  const { nombres } = useNombresDePersonas([...new Set(segmentos.flatMap((s) => (s.tipo === 'persona' ? [s.id] : [])))])
  return (
    <>
      {segmentos.map((s, i) => {
        if (s.tipo === 'texto') return <Fragment key={i}>{s.texto}</Fragment>
        if (s.tipo === 'reservado') return <Reservado key={i}>{t(`ia.marcadores.${s.clase}`)}</Reservado>
        const nombre = nombres.get(s.id)
        return nombre?.nombre ? <span key={i}>{nombre.nombre}</span> : <Reservado key={i}>{nombre?.visible ?? '…'}</Reservado>
      })}
    </>
  )
}

// una salida de la IA (respuesta, cita, propuesta, resumen o borrador): como texto o, si es Markdown, con VistaMarkdown
export function TextoDeIa({ texto: contenido, markdown = false }: { texto: string; markdown?: boolean }) {
  if (markdown) return <VistaMarkdown texto={contenido} enLinea={(linea) => <EnLinea texto={linea} />} />
  return (
    <span className="whitespace-pre-line">
      <EnLinea texto={contenido} />
    </span>
  )
}
