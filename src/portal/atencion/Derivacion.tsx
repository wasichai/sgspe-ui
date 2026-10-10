import { useAuth } from '@wasichai/core'
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Textarea } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AvisoDeConflicto } from '../componentes/AvisoDeConflicto'
import { Campo, SelectNativo } from '../componentes/Campo'
import { rutaDeQcs, type ObjetoDeQcs } from '../datos/atencion'
import { campoDe, texto, useDefinicion, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useDerivarPregunta } from './comandos'

// derivar una pregunta pendiente de una reunión a una QCS (S23, RF-ENG-006, api.md §4.4): el tipo (entre los que la cuenta puede
// crear), el código de la QCS que nace, qué plantea (la pregunta, para que se pueda ajustar), su categoría y el motivo. el servidor
// pone el proyecto, la interacción y la pregunta de origen, el canal REUNION y la recepción igual al momento de la reunión, y marca
// la pregunta con referred_at: queda atendida para el cierre sin que la regla lea la QCS, que puede ser confidencial. un reintento
// repite la misma Idempotency-Key; una pregunta que otra persona ya derivó dice ALREADY_REFERRED con su texto, y una ya respondida
// (STATE_MISMATCH sobre record, plan 4.2a) lo dice distinto de la interacción fuera de estado (sobre engagement)
export function DialogoDeDerivacion({
  pregunta,
  destinos,
  alDerivar,
  alCerrar
}: {
  pregunta: Registro
  destinos: readonly ObjetoDeQcs[]
  alDerivar: () => void
  alCerrar: () => void
}) {
  const { t } = useTranslation(NS)
  const derivar = useDerivarPregunta()
  const [destino, setDestino] = useState<ObjetoDeQcs>(destinos[0])
  const definicion = useDefinicion(destino)
  const categorias = campoDe(definicion.data, 'category')?.enumOptions ?? []
  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState(texto(pregunta, 'question_text'))
  const [categoria, setCategoria] = useState('')
  const [motivo, setMotivo] = useState('')
  const [intentado, setIntentado] = useState(false)
  const falta = (valor: string) => (intentado && valor.trim() === '' ? t('relacionamiento.derivacion.falta') : undefined)
  const confirmar = () => {
    setIntentado(true)
    if ([codigo, descripcion, motivo].some((v) => v.trim() === '')) return
    derivar.mutate(
      {
        pregunta,
        destino,
        atributos: { code: codigo.trim(), description: descripcion.trim(), ...(categoria ? { category: categoria } : {}) },
        motivo: motivo.trim()
      },
      {
        onSuccess: () => {
          alDerivar()
          alCerrar()
        }
      }
    )
  }
  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-sg-h3 font-semibold">{t('relacionamiento.derivacion.titulo')}</DialogTitle>
        <DialogDescription className="text-sm text-sg-text-secondary">{t('relacionamiento.derivacion.descripcion')}</DialogDescription>
        <div className="mt-4 space-y-3">
          <fieldset className="space-y-1">
            <legend className="text-sg-body-sm font-medium">{t('relacionamiento.derivacion.destino')}</legend>
            {destinos.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="destino-de-la-pregunta"
                  checked={destino === o}
                  onChange={() => {
                    // la categoría es de la definición del tipo: otro tipo empieza sin ella
                    setDestino(o)
                    setCategoria('')
                  }}
                />
                {t(`comun.qcs.${o}`)}
              </label>
            ))}
          </fieldset>
          <Campo etiqueta={t('relacionamiento.derivacion.codigo')} error={falta(codigo)}>
            {(p) => <Input {...p} value={codigo} maxLength={60} onChange={(e) => setCodigo(e.target.value)} />}
          </Campo>
          <Campo etiqueta={t('relacionamiento.derivacion.quePlantea')} error={falta(descripcion)}>
            {(p) => <Textarea {...p} value={descripcion} maxLength={4000} onChange={(e) => setDescripcion(e.target.value)} />}
          </Campo>
          <Campo etiqueta={t('relacionamiento.derivacion.categoria')}>
            {(p) => <SelectNativo {...p} value={categoria} opciones={categorias} onChange={(e) => setCategoria(e.target.value)} />}
          </Campo>
          <Campo etiqueta={t('comun.motivoObligatorio')} error={intentado && motivo.trim() === '' ? t('comun.motivoFalta') : undefined}>
            {(p) => <Textarea {...p} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />}
          </Campo>
          {derivar.isError ? (
            <AvisoDeConflicto
              error={derivar.error}
              propios={{ STATE_MISMATCH: t('relacionamiento.derivacion.fueraDeEstado'), 'STATE_MISMATCH:record': t('relacionamiento.derivacion.yaRespondida') }}
              releer={async () => alDerivar()}
              alRecargar={() => derivar.reset()}
            />
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={alCerrar}>
            {t('comun.cancelar')}
          </Button>
          <Button onClick={confirmar} disabled={derivar.isPending} aria-busy={derivar.isPending}>
            {derivar.isPending ? t('relacionamiento.derivacion.derivando') : t('relacionamiento.derivacion.confirmar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// la QCS que nació de una pregunta derivada, si la cuenta la lee: se busca por origin_question en los tres tipos que lee. una
// confidencial que no lee no aparece (RecordReadScope) y la fila solo dice que se derivó: nunca se insinúa que existe
export function QcsDeLaPregunta({ pregunta }: { pregunta: Registro }) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const filtro = { origin_question: pregunta.id }
  const lecturas = [
    { objeto: 'grievance' as const, lista: useTodos('grievance', filtro, can('grievance', 'READ')) },
    { objeto: 'inquiry' as const, lista: useTodos('inquiry', filtro, can('inquiry', 'READ')) },
    { objeto: 'stakeholder_request' as const, lista: useTodos('stakeholder_request', filtro, can('stakeholder_request', 'READ')) }
  ]
  const encontradas = lecturas.flatMap(({ objeto, lista }) => (lista.data ?? []).map((r) => ({ objeto, r })))
  if (encontradas.length === 0) return null
  return (
    <ul className="text-sg-caption">
      {encontradas.map(({ objeto, r }) => (
        <li key={r.id}>
          <Link to={rutaDeQcs(texto(r, 'project'), objeto, r.id)} className="text-sg-primary-text underline">
            {t(`comun.qcs.${objeto}`)} {texto(r, 'code')}
          </Link>
        </li>
      ))}
    </ul>
  )
}
