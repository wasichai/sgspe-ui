import type { ObjectDefinition } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { usePuedeEditar, useDefinicion, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { MOTIVO_EN_TODAS } from '../transiciones/reglas'
import { esCompletable } from './CompletarCampo'
import { Drawer } from './Drawer'
import { FormularioDeRegistro } from './FormularioDeRegistro'
import { CampoDeMotivo, useMotivo } from './Motivo'

// los campos de una sección que se editan en ella: los que la ficha deja editar (su lista de editables) y que el formulario
// completa solo (esCompletable: ni relaciones, ni UUID, ni geometrías, ni derivados)
export function editablesDeSeccion(objeto: string, definicion: ObjectDefinition | undefined, campos: readonly string[], permitidos?: readonly string[]) {
  return campos.filter((c) => (!permitidos || permitidos.includes(c)) && esCompletable(objeto, definicion, c))
}

// tercera pasada de UX (2.10): cada sección de una ficha se edita sola. «Editar» junto a su título abre un cajón con solo sus
// campos y el motivo si el objeto lo pide, en vez del formulario entero; el «Editar» de la cabecera sigue para todo. se ofrece
// como el de la cabecera (usePuedeEditar y la asignación al proyecto) y solo si la sección tiene algún campo que se edite aquí
export function EditarSeccion({
  objeto,
  registro,
  proyecto,
  seccion,
  campos,
  permitidos
}: {
  objeto: string
  registro: Registro
  proyecto?: string
  // el título de la sección, para el nombre del botón y del cajón
  seccion: string
  campos: readonly string[]
  permitidos?: readonly string[]
}) {
  const { t } = useTranslation(NS)
  const definicion = useDefinicion(objeto)
  const puedeEditar = usePuedeEditar(objeto)
  const escribe = useEscribeEnProyecto(proyecto)
  const [abierto, setAbierto] = useState(false)
  const motivo = useMotivo()
  const editables = editablesDeSeccion(objeto, definicion.data, campos, permitidos)
  if (!puedeEditar || (proyecto !== undefined && !escribe) || editables.length === 0) return null
  const titulo = t('comun.editarSeccion.titulo', { seccion })
  const pideMotivo = definicion.data?.requiresReason === true || MOTIVO_EN_TODAS.includes(objeto)
  const cerrar = () => {
    motivo.limpiar()
    setAbierto(false)
  }
  return (
    <>
      <Button size="sm" variant="ghost" aria-label={titulo} onClick={() => setAbierto(true)}>
        <Pencil aria-hidden className="size-3.5" />
        {t('comun.editarSeccion.boton')}
      </Button>
      <Drawer titulo={titulo} abierto={abierto} alCerrar={cerrar}>
        {pideMotivo ? <CampoDeMotivo motivo={motivo} etiqueta={t('comun.motivoObligatorio')} /> : null}
        {abierto ? (
          <FormularioDeRegistro
            objeto={objeto}
            registro={registro}
            campos={editables}
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
