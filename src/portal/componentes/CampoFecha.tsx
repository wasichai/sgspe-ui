import { Button, Input } from '@wasichai/ui'
import { CalendarDays } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { diaDeTexto, horaDeTexto, instanteDeLima, textoDeDia } from '../datos/fechas'
import { NS } from '../i18n'
import { CalendarioDeFecha } from './CalendarioDeFecha'
import { Campo } from './Campo'

// un campo de fecha que muestra y lee el día como dd/mm/aaaa y, con conHora, la hora de 24 h, en los dos idiomas (hallazgo
// U-07, decisión DD-07): un <input type="date"> lo dibuja el navegador con su configuración regional (mm/dd/yyyy, AM/PM).
// el valor es el día AAAA-MM-DD o, con hora, la hora de Lima como la escribía un datetime-local (AAAA-MM-DDTHH:mm): el
// formulario lo convierte al instante que manda con instanteDeLima, igual que antes. null mientras no hay una fecha válida
// dentro de min y max (en el mismo formato del valor). el botón de calendario abre una grilla de mes (CalendarioDeFecha) que
// escribe el día elegido en el campo como si se hubiera tecleado; con hora, conserva la hora escrita
export interface PropsDeCampoFecha {
  valor: string | null
  alCambiar: (valor: string | null) => void
  etiqueta: string
  conHora?: boolean
  id?: string
  requerido?: boolean
  min?: string
  max?: string
  // el error que pone el formulario (obligatorio, el del servidor); el del formato o el rango del campo va antes
  error?: string
  deshabilitado?: boolean
  // la ayuda bajo el campo, enlazada por aria-describedby
  ayuda?: string
  // inválido por una regla de la pantalla (un periodo con «desde» después de «hasta»), que dice su error aparte
  invalido?: boolean
}

type Motivo = 'formato' | 'formatoHora' | 'antesDe' | 'despuesDe'

// lo escrito como valor, o por qué no lo es
function leer(textoDia: string, textoHora: string, conHora: boolean, min?: string, max?: string): { valor: string | null; motivo?: Motivo } {
  if (textoDia.trim() === '' && (!conHora || textoHora.trim() === '')) return { valor: null }
  const dia = diaDeTexto(textoDia)
  if (!dia) return { valor: null, motivo: 'formato' }
  let valor = dia
  if (conHora) {
    const hora = horaDeTexto(textoHora)
    if (!hora || instanteDeLima(`${dia}T${hora}`) === '') return { valor: null, motivo: 'formatoHora' }
    valor = `${dia}T${hora}`
  }
  if (min && valor < min) return { valor: null, motivo: 'antesDe' }
  if (max && valor > max) return { valor: null, motivo: 'despuesDe' }
  return { valor }
}

const horaDe = (valor: string | null): string => /T(\d{2}:\d{2})/.exec(valor ?? '')?.[1] ?? ''

export function CampoFecha({ valor, alCambiar, etiqueta, conHora = false, id, requerido, min, max, error, deshabilitado, ayuda, invalido }: PropsDeCampoFecha) {
  const { t } = useTranslation(NS)
  const [textoDia, setTextoDia] = useState(textoDeDia(valor ?? ''))
  const [textoHora, setTextoHora] = useState(horaDe(valor))
  // el último valor avisado: el formulario lo devuelve como valor y no debe pisar lo que se está escribiendo
  const [avisado, setAvisado] = useState(valor)
  const [previo, setPrevio] = useState(valor)
  // los campos por los que ya se pasó: el error se dice al salir, no al empezar a escribir
  const [tocados, setTocados] = useState({ dia: false, hora: false })
  if (valor !== previo) {
    setPrevio(valor)
    if (valor !== avisado) {
      // un valor nuevo que llega del formulario (otro registro, un reinicio)
      setAvisado(valor)
      setTextoDia(textoDeDia(valor ?? ''))
      setTextoHora(horaDe(valor))
    }
  }

  const lectura = leer(textoDia, textoHora, conHora, min, max)
  // el formato del día se dice al salir del día, el de la hora al salir de la hora, y el rango al salir de cualquiera
  const visible: Record<Motivo, boolean> = {
    formato: tocados.dia,
    formatoHora: tocados.hora,
    antesDe: tocados.dia || tocados.hora,
    despuesDe: tocados.dia || tocados.hora
  }
  const motivo = lectura.motivo && visible[lectura.motivo] ? lectura.motivo : undefined
  const rotulo = (v?: string) => (v ? `${textoDeDia(v)}${conHora && horaDe(v) ? ` ${horaDe(v)}` : ''}` : '')
  const propio = motivo ? t(`comun.campoFecha.${motivo}`, { min: rotulo(min), max: rotulo(max) }) : undefined

  const cambiar = (dia: string, hora: string) => {
    setTextoDia(dia)
    setTextoHora(hora)
    const nuevo = leer(dia, hora, conHora, min, max).valor
    if (nuevo !== avisado) {
      setAvisado(nuevo)
      alCambiar(nuevo)
    }
  }
  // al salir, lo escrito se normaliza: 20102026 → 20/10/2026, 1015 → 10:15
  const salirDelDia = () => {
    const dia = diaDeTexto(textoDia)
    if (dia) setTextoDia(textoDeDia(dia))
    setTocados((x) => ({ ...x, dia: true }))
  }
  // el calendario: Esc lo cierra sin elegir y devuelve el foco al botón, un clic fuera lo cierra
  const [abierto, setAbierto] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)
  const contenedor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    // en la fase de captura de window, antes que la de document: un Dialog de Radix que contiene el campo no se cierra
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      setAbierto(false)
      boton.current?.focus()
    }
    const alApuntar = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false)
    }
    window.addEventListener('keydown', alTeclear, { capture: true })
    document.addEventListener('pointerdown', alApuntar)
    return () => {
      window.removeEventListener('keydown', alTeclear, { capture: true })
      document.removeEventListener('pointerdown', alApuntar)
    }
  }, [abierto])
  const elegirDia = (dia: string) => {
    cambiar(textoDeDia(dia), textoHora)
    setTocados((x) => ({ ...x, dia: true }))
    setAbierto(false)
    boton.current?.focus()
  }

  const salirDeLaHora = () => {
    const hora = horaDeTexto(textoHora)
    if (hora) setTextoHora(hora)
    setTocados((x) => ({ ...x, hora: true }))
  }

  return (
    <Campo etiqueta={etiqueta} error={propio ?? error} ayuda={ayuda} id={id}>
      {(p) => (
        <div
          ref={contenedor}
          className="relative flex flex-wrap gap-2"
          onBlur={(e) => {
            // el foco que sale del campo y del calendario (con Tab) lo cierra; dentro de él, no
            if (abierto && e.relatedTarget && !contenedor.current?.contains(e.relatedTarget)) setAbierto(false)
          }}
        >
          <Input
            {...p}
            className="w-36"
            inputMode="numeric"
            autoComplete="off"
            placeholder={t('comun.campoFecha.marcador')}
            maxLength={10}
            aria-required={requerido || undefined}
            aria-invalid={(p['aria-invalid'] && motivo !== 'formatoHora') || invalido ? true : undefined}
            disabled={deshabilitado}
            value={textoDia}
            onChange={(e) => cambiar(e.target.value, textoHora)}
            onBlur={salirDelDia}
          />
          <Button
            ref={boton}
            type="button"
            variant="secondary"
            size="icon"
            aria-label={t('comun.campoFecha.abrir', { etiqueta })}
            aria-haspopup="dialog"
            aria-expanded={abierto}
            disabled={deshabilitado}
            onClick={() => setAbierto((a) => !a)}
          >
            <CalendarDays aria-hidden="true" className="size-4" />
          </Button>
          {conHora ? (
            <Input
              className="w-24"
              aria-label={t('comun.campoFecha.hora', { etiqueta })}
              aria-describedby={p['aria-describedby']}
              aria-invalid={motivo === 'formatoHora' || (error && !propio) ? true : undefined}
              aria-required={requerido || undefined}
              inputMode="numeric"
              autoComplete="off"
              placeholder={t('comun.campoFecha.marcadorHora')}
              maxLength={5}
              disabled={deshabilitado}
              value={textoHora}
              onChange={(e) => cambiar(textoDia, e.target.value)}
              onBlur={salirDeLaHora}
            />
          ) : null}
          {abierto ? <CalendarioDeFecha elegido={diaDeTexto(textoDia)} etiqueta={etiqueta} min={min} max={max} alElegir={elegirDia} /> : null}
        </div>
      )}
    </Campo>
  )
}
