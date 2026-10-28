import { useAuth, type ObjectDefinition } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { esDeComando, esDerivado } from '../datos/derivados'
import { campoDe, useDefinicion, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { MOTIVO_EN_TODAS } from '../transiciones/reglas'
import { Drawer } from './Drawer'
import { FormularioDeRegistro } from './FormularioDeRegistro'
import { CampoDeMotivo, useMotivo } from './Motivo'

// tercera pasada de UX (1.1): lo que bloquea la siguiente acción se resuelve donde se informa. si una regla de transition-checks la
// bloquea por un campo del registro que quien mira puede escribir, «Completar ‹campo›» abre un cajón con solo ese campo (y el motivo,
// si el objeto lo exige); al guardar, useActualizar invalida la consulta en seco y el bloqueo se vuelve a comprobar sin recargar
const NO_COMPLETABLES: ReadonlySet<string> = new Set(['GEOMETRY', 'RELATION', 'MANY_TO_MANY', 'UUID', 'FILE'])

// un campo que el formulario completa solo: legible y escribible por quien mira, ni derivado ni de comando, y que no sea una
// geometría (se edita en el mapa), una relación o un UUID (el formulario de wasichai pide el identificador; el responsable se elige
// en «Editar») ni un archivo (va como evidencia)
export function esCompletable(objeto: string, definicion: ObjectDefinition | undefined, campo: string): boolean {
  const f = campoDe(definicion, campo)
  return Boolean(f?.editable && f.visible !== false && !NO_COMPLETABLES.has(f.type)) && !esDerivado(objeto, campo) && !esDeComando(objeto, campo)
}

export function CompletarCampo({
  objeto,
  registro,
  proyecto,
  campo,
  accion
}: {
  objeto: string
  registro: Registro
  proyecto?: string
  // el nombre del campo en la API (el field de la regla que bloquea)
  campo: string
  // la etiqueta de la acción bloqueada («Resolver»)
  accion: string
}) {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const definicion = useDefinicion(objeto)
  const escribe = useEscribeEnProyecto(proyecto)
  const [abierto, setAbierto] = useState(false)
  const motivo = useMotivo()
  if (!can(objeto, 'UPDATE') || (proyecto !== undefined && !escribe) || !esCompletable(objeto, definicion.data, campo)) return null
  const titulo = t('transiciones.completar', { campo: campoDe(definicion.data, campo)?.label || campo })
  const pideMotivo = definicion.data?.requiresReason === true || MOTIVO_EN_TODAS.includes(objeto)
  const cerrar = () => {
    motivo.limpiar()
    setAbierto(false)
  }
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setAbierto(true)}>
        {titulo}
      </Button>
      <Drawer titulo={titulo} descripcion={t('transiciones.completarAyuda', { accion })} abierto={abierto} alCerrar={cerrar}>
        {pideMotivo ? <CampoDeMotivo motivo={motivo} etiqueta={t('comun.motivoObligatorio')} /> : null}
        {abierto ? (
          <FormularioDeRegistro
            objeto={objeto}
            registro={registro}
            campos={[campo]}
            motivo={motivo.recortado}
            antesDeEnviar={motivo.exigir}
            alGuardar={cerrar}
            alCancelar={cerrar}
          />
        ) : null}
      </Drawer>
    </>
  )
}
