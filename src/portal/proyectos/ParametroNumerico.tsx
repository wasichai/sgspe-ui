import { Input } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NS } from '../i18n'

// el campo de un parámetro numérico de project, el mismo en el asistente (S07) y en S11
// un número tecleado: acepta la coma decimal y no toma un texto vacío o de espacios por cero
export const aNumero = (texto: string): number => (texto.trim() === '' ? Number.NaN : Number(texto.trim().replace(',', '.')))

// el valor de un parámetro numérico tecleado: vacío es el valor por defecto (dashboards.md §3.3); un texto que no es un número
// mayor o igual a 0, o un decimal en un parámetro entero, es NaN, que el esquema rechaza: nunca se guarda un valor distinto
// del que muestra el campo
export const convertir = (escrito: string, porDefecto: number, entero: boolean): number => {
  if (escrito.trim() === '') return porDefecto
  const n = aNumero(escrito)
  return Number.isFinite(n) && n >= 0 && (!entero || Number.isInteger(n)) ? n : Number.NaN
}

// un parámetro numérico conserva el texto tecleado (un decimal a medias, el campo vacío) y lleva cada cambio al formulario;
// el error de un texto inválido sale junto al campo al salir de él o al intentar guardar
export function ParametroNumerico({
  id,
  descritoPor,
  valor,
  porDefecto,
  entero,
  intentoDeGuardar,
  disabled,
  textoInicial,
  alEscribir,
  alCambiar
}: {
  id: string
  // el id de un texto de ayuda que describe el campo
  descritoPor?: string
  valor: number
  porDefecto: number
  entero: boolean
  intentoDeGuardar: boolean
  disabled?: boolean
  // el texto tecleado antes de que el campo se desmontara (un cambio de paso): un valor inválido es NaN y no se puede
  // reconstruir del número, así que quien lo monta lo guarda con alEscribir y lo devuelve aquí
  textoInicial?: string
  alEscribir?: (texto: string) => void
  alCambiar: (n: number) => void
}) {
  const { t } = useTranslation(NS)
  // el texto guardado vale solo si todavía dice el valor del formulario (Object.is: NaN es el mismo NaN)
  const vigenteElTexto = textoInicial !== undefined && Object.is(convertir(textoInicial, porDefecto, entero), valor)
  const [escrito, setEscrito] = useState(() => (vigenteElTexto ? textoInicial : Number.isNaN(valor) ? String(porDefecto) : String(valor)))
  // un texto inválido que se recupera al volver ya fue visto: su error sigue a la vista
  const [tocado, setTocado] = useState(() => vigenteElTexto && Number.isNaN(valor))
  const invalido = Number.isNaN(convertir(escrito, porDefecto, entero))
  const error = invalido && (tocado || intentoDeGuardar) ? t(entero ? 'proyectos.asistente.enteroInvalido' : 'proyectos.asistente.numeroInvalido') : undefined
  return (
    <div className="flex flex-col items-end gap-1">
      <Input
        id={id}
        inputMode="decimal"
        className="w-24"
        disabled={disabled}
        value={escrito}
        aria-invalid={error ? true : undefined}
        aria-describedby={[descritoPor, error ? `${id}-error` : undefined].filter(Boolean).join(' ') || undefined}
        onChange={(e) => {
          setEscrito(e.target.value)
          alEscribir?.(e.target.value)
          alCambiar(convertir(e.target.value, porDefecto, entero))
        }}
        onBlur={() => {
          setTocado(true)
          if (escrito.trim() === '') {
            setEscrito(String(porDefecto))
            alEscribir?.(String(porDefecto))
          }
        }}
      />
      {error ? (
        <p id={`${id}-error`} className="max-w-xs text-right text-sg-caption text-sg-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
