import { Button } from '@wasichai/ui'
import { useAvailableTransitions, type AvailableTransition } from '@wasichai/workflow'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useComprobacion } from './api'
import { DialogoDeTransicion } from './DialogoDeTransicion'
import { esDeComando } from './reglas'

// las transiciones del estado actual para quien mira (GET …/transitions, de @wasichai/workflow). las que su rol no tiene
// no aparecen (design-system.md §6.2); las de comando tampoco: tienen su propia pantalla. la primera es la primaria. las
// de comprobarAntes consultan transition-checks al dibujarse y, si una regla las bloquea, salen deshabilitadas con la razón
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
  const visibles = (transiciones.data ?? []).filter((tr) => tr.allowed && !esDeComando(objeto, tr.name) && !ocultar.includes(tr.name))
  if (visibles.length === 0) return null
  return (
    <div role="group" aria-label={t('transiciones.acciones')} className="flex flex-wrap gap-2">
      {visibles.map((tr, i) => (
        <BotonDeTransicion
          key={tr.name}
          objeto={objeto}
          registro={registro}
          transicion={tr}
          primaria={i === 0}
          comprobar={comprobarAntes.includes(tr.name)}
          alAbrir={() => setAbierta(tr)}
        />
      ))}
      {abierta ? <DialogoDeTransicion objeto={objeto} registro={registro} transicion={abierta} alCerrar={() => setAbierta(null)} /> : null}
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
  const razon = comprobacion.data?.blocking[0]?.message
  return (
    <>
      <Button
        variant={primaria ? 'primary' : 'secondary'}
        size="sm"
        onClick={alAbrir}
        disabled={Boolean(razon)}
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
