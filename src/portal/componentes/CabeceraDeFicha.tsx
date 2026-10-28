import { cloneElement, Fragment, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useTransicionesOfrecidas } from '../transiciones/BotonesDeTransicion'
import { CompletarCampo } from './CompletarCampo'
import { EncabezadoDePagina } from './Pagina'

// la cabecera de la ficha de un registro con la regla de la acción principal (DD-02 y DD-06 del rediseño de UX; U-02, U-03,
// U-15, U-25 y U-27): una sola primaria, la siguiente acción del flujo (la misma del panel de decisión), con lo que la impide
// dicho debajo; a la vista, dos secundarias como mucho (las de la ficha y después las demás transiciones); el resto y lo
// destructivo (cancelar, anular, retirar, terminar), en «Más acciones». el orden visual y de foco es secundarias, «Más
// acciones», primaria. el estado del flujo no va en los chips: vive en el panel de decisión. si lo que falta es un campo que
// quien mira puede escribir, junto al bloqueo va «Completar ‹campo›» (tercera pasada de UX, 1.1)
export interface AccionDeFicha {
  clave: string
  nodo: ReactNode
}

const SECUNDARIAS_A_LA_VISTA = 2

// un título que dice qué es (U-27 del rediseño de UX), sacado de un texto del registro (lo que plantea una QCS, el propósito de un
// aporte): su primera línea, cortada en una palabra si es larga; sin texto, el tipo y el código
const LARGO_DEL_TITULO = 120
export function tituloQueDiceQueEs(textoDelRegistro: string, porCodigo: string): string {
  const linea = textoDelRegistro.split('\n')[0].trim()
  if (!linea) return porCodigo
  if (linea.length <= LARGO_DEL_TITULO) return linea
  const corte = linea.slice(0, LARGO_DEL_TITULO)
  const espacio = corte.lastIndexOf(' ')
  return `${corte.slice(0, espacio > 0 ? espacio : LARGO_DEL_TITULO)}…`
}

// la acción propia se dibuja con el peso que le toca: primaria si no hay una transición del camino, secundaria si la hay
function conVariante(nodo: ReactNode, variante: 'primary' | 'secondary'): ReactNode {
  return isValidElement(nodo) ? cloneElement(nodo as ReactElement<{ variant?: string }>, { variant: variante }) : nodo
}

export function CabeceraDeFicha({
  antetitulo,
  titulo,
  tituloDelDocumento,
  chips,
  objeto,
  registro,
  proyecto,
  comprobarAntes,
  secundarias = [],
  primariaPropia,
  falta,
  faltaCampo
}: {
  // «Tipo · código · categoría», en la letra del texto
  antetitulo: string
  titulo: string
  tituloDelDocumento?: string
  // la situación de plazo, el nivel, el monto…; nunca el estado del flujo
  chips?: ReactNode
  objeto: string
  registro: Registro
  proyecto?: string
  comprobarAntes?: readonly string[]
  secundarias?: readonly AccionDeFicha[]
  // una acción de la ficha que no es una transición («Nueva revisión» de un riesgo): primaria solo sin transición del camino
  primariaPropia?: ReactNode
  // lo que impide la siguiente acción (useSiguienteAccion(...).falta)
  falta?: string
  // el campo que la bloquea (useSiguienteAccion(...).campo): se ofrece completarlo ahí mismo
  faltaCampo?: string
}) {
  const { t } = useTranslation(NS)
  const idDeFalta = useId()
  const transiciones = useTransicionesOfrecidas({
    objeto,
    registro,
    proyecto,
    comprobarAntes,
    primariaSoloDelCamino: primariaPropia != null,
    faltaDeLaPrimaria: falta ? { id: idDeFalta, texto: falta } : undefined
  })
  const deTransicion = transiciones.primaria
  const primaria = deTransicion ? deTransicion.nodo : primariaPropia != null ? conVariante(primariaPropia, 'primary') : null
  const propiaComoSecundaria: AccionDeFicha[] =
    deTransicion && primariaPropia != null ? [{ clave: 'propia', nodo: conVariante(primariaPropia, 'secondary') }] : []
  const candidatas = [...propiaComoSecundaria, ...secundarias, ...transiciones.otras]
  const aLaVista = candidatas.slice(0, SECUNDARIAS_A_LA_VISTA)
  const enMenu = [...candidatas.slice(SECUNDARIAS_A_LA_VISTA), ...transiciones.destructivas]
  const lista = (acciones: readonly AccionDeFicha[]) => acciones.map((a) => <Fragment key={a.clave}>{a.nodo}</Fragment>)
  // lo que falta solo se dice si hay una primaria que lo necesite
  const dichoFalta = falta && deTransicion ? falta : null
  const pie =
    dichoFalta || transiciones.confirmacion || transiciones.dialogo ? (
      <>
        {dichoFalta ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
            <p id={idDeFalta} className="text-sg-caption text-sg-text-secondary">
              {dichoFalta}
            </p>
            {faltaCampo && deTransicion ? (
              <CompletarCampo objeto={objeto} registro={registro} proyecto={proyecto} campo={faltaCampo} accion={deTransicion.etiqueta} />
            ) : null}
          </div>
        ) : null}
        {transiciones.confirmacion}
        {transiciones.dialogo}
      </>
    ) : null
  return (
    <EncabezadoDePagina
      ficha
      antetitulo={antetitulo}
      antetituloEnSans
      titulo={titulo}
      tituloDelDocumento={tituloDelDocumento}
      chips={chips}
      etiquetaDeAcciones={t('transiciones.acciones')}
      secundarias={aLaVista.length > 0 ? lista(aLaVista) : undefined}
      mas={enMenu.length > 0 ? lista(enMenu) : undefined}
      primaria={primaria ?? undefined}
      pieDeAcciones={pie}
    />
  )
}
