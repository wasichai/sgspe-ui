import { Button } from '@wasichai/ui'
import { useAvailableTransitions, type AvailableTransition } from '@wasichai/workflow'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useComprobacion } from './api'
import { DialogoDeTransicion } from './DialogoDeTransicion'
import { esDeComando } from './reglas'

// las transiciones del estado actual para quien mira (GET …/transitions, de @wasichai/workflow). las que su rol no tiene
// no aparecen (design-system.md §6.2); las de comando tampoco: tienen su propia pantalla. la primera es la primaria. las
// de comprobarAntes consultan transition-checks al dibujarse y, si una regla las bloquea, salen deshabilitadas con la razón
const DURACION_DE_LA_CONFIRMACION = 6000

export function BotonesDeTransicion({
  objeto,
  registro,
  ocultar = [],
  comprobarAntes = []
}: {
  objeto: string
  registro: Registro
  ocultar?: readonly string[]
  comprobarAntes?: readonly string[]
}) {
  const { t } = useTranslation(NS)
  const transiciones = useAvailableTransitions(objeto, registro.id)
  const [abierta, setAbierta] = useState<AvailableTransition | null>(null)
  // el estado al que llevó la última transición aplicada: se confirma aunque el estado nuevo ya no ofrezca botones
  const [hecha, setHecha] = useState<string | null>(null)
  // la confirmación se va sola a los pocos segundos, o al abrir otra transición (re-revisión, menor 3)
  useEffect(() => {
    if (!hecha) return
    const plazo = setTimeout(() => setHecha(null), DURACION_DE_LA_CONFIRMACION)
    return () => clearTimeout(plazo)
  }, [hecha])
  const visibles = (transiciones.data ?? []).filter((tr) => tr.allowed && !esDeComando(objeto, tr.name) && !ocultar.includes(tr.name))
  if (visibles.length === 0 && !hecha) return null
  return (
    <div className="space-y-2">
      {visibles.length > 0 ? (
        <div role="group" aria-label={t('transiciones.acciones')} className="flex flex-wrap gap-2">
          {visibles.map((tr, i) => (
            <BotonDeTransicion
              key={tr.name}
              objeto={objeto}
              registro={registro}
              transicion={tr}
              primaria={i === 0}
              comprobar={comprobarAntes.includes(tr.name)}
              alAbrir={() => {
                setHecha(null)
                setAbierta(tr)
              }}
            />
          ))}
        </div>
      ) : null}
      {hecha ? (
        <p role="status" className="text-sm text-sg-success">
          {t('transiciones.hecho', { a: hecha })}
        </p>
      ) : null}
      {abierta ? (
        <DialogoDeTransicion
          objeto={objeto}
          registro={registro}
          transicion={abierta}
          alCerrar={() => setAbierta(null)}
          alAplicar={() => setHecha(abierta.toLabel)}
        />
      ) : null}
    </div>
  )
}

function BotonDeTransicion({
  objeto,
  registro,
  transicion,
  primaria,
  comprobar,
  alAbrir
}: {
  objeto: string
  registro: Registro
  transicion: AvailableTransition
  primaria: boolean
  comprobar: boolean
  alAbrir: () => void
}) {
  const id = useId()
  const comprobacion = useComprobacion(objeto, registro.id, comprobar ? transicion.name : null)
  // un bloqueo deshabilita el botón aunque su mensaje venga vacío; la razón se dice solo si existe
  const bloqueado = (comprobacion.data?.blocking.length ?? 0) > 0
  const razon = comprobacion.data?.blocking.find((b) => b.message)?.message
  return (
    <>
      <Button
        variant={primaria ? 'primary' : 'secondary'}
        size="sm"
        onClick={alAbrir}
        disabled={bloqueado}
        title={razon}
        aria-describedby={razon ? id : undefined}
      >
        {transicion.label}
      </Button>
      {razon ? (
        <span id={id} className="sr-only">
          {razon}
        </span>
      ) : null}
    </>
  )
}
