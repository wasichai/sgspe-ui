import { ListaEnTarjetas, useEsTelefono } from '../componentes/ListaEnTarjetas'
import { PaginasDeCompromisos } from './PaginasDeCompromisos'
import { BotonCrear } from '../componentes/BotonCrear'
import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { EncabezadoDePagina } from '../componentes/Pagina'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { TablaPriorizada, type ColumnaPriorizada, type OrdenDeTabla } from '../componentes/TablaPriorizada'
import { useRutaDeVistaPrevia } from '../componentes/VistaPrevia'
import { useSiguientePaso } from '../contexto/Rastro'
import { Drawer } from '../componentes/Drawer'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, Vacio } from '../componentes/Estados'
import { FormularioDeRegistro } from '../componentes/FormularioDeRegistro'
import { FalloDeLectura } from '../componentes/LecturaConEstados'
import { SituacionDePlazo } from '../componentes/SituacionDePlazo'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyectos } from '../contexto/proyectos'
import { atributo, texto, useRegistros, type Registro } from '../datos/registros'
import { NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { ordenEnUrl, PaginacionDelServidor, useParametrosDeLista, VacioDeLista } from '../componentes/Lista'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { opcion } from '../datos/opciones'
import { Dia } from '../componentes/Dia'
import { CampoDeMotivo, useMotivo } from '../componentes/Motivo'
import { conHecho } from '../componentes/AvisoDeExito'

// S33, la lista: los acuerdos del alcance (global con la columna Proyecto, o de un proyecto) con su tipo, su estado de WF-I y su
// vigencia (validity_status, de JOB-01: vencer no concluye el acuerdo), paginados en el servidor (D10 de la revisión de UX). el alta va en un drawer con los campos de la ficha y
// el motivo, porque agreement es requiresReason (un alta sin motivo es 400)
const POR_PAGINA = 25
// las columnas que el servidor ordena (05-especificacion §1.6): el acuerdo por su código (el orden que la lista ya pedía) y el
// vencimiento. el tipo, el estado y la vigencia no: su código no dice su orden
const CAMPO_DE_ORDEN: Record<string, string> = { acuerdo: 'code', vence: 'expiry_date' }
const ORDEN_INICIAL: OrdenDeTabla = { columna: 'acuerdo', dir: 'asc' }

export const CAMPOS_DEL_ACUERDO = [
  'code',
  'title',
  'agreement_type',
  'summary',
  'signed_date',
  'effective_date',
  'expiry_date',
  'amount',
  'currency',
  'community',
  'assembly_engagement'
] as const

export function AcuerdosPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const navegar = useNavigate()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const escribe = useEscribeEnProyecto(proyecto)
  const parametros = useParametrosDeLista('todos')
  // el orden viaja en la URL (ordenEnUrl, DD-37): volver de una ficha lo conserva, y otro orden vuelve a la primera página
  const [orden, ordenar] = ordenEnUrl(parametros, ORDEN_INICIAL, ['acuerdo', 'vence'])
  // la búsqueda (?q=) en el servidor, por los textos del acuerdo (tercera pasada de UX, 3.7); el conteo dice lo encontrado
  const q = parametros.filtro('q').trim()
  const acuerdos = useRegistros('agreement', {
    project: proyecto,
    q: q || undefined,
    sort: CAMPO_DE_ORDEN[orden.columna],
    dir: orden.dir,
    page: parametros.pagina,
    size: POR_PAGINA
  })
  const proyectos = useProyectos()
  const telefono = useEsTelefono()
  const lista = acuerdos.data?.content ?? []
  // ?nuevo=1 abre el alta: así llega BotonCrear desde lo global, ya con el proyecto elegido
  const [busqueda] = useSearchParams()
  const [creando, setCreando] = useState(busqueda.get('nuevo') === '1')
  const motivo = useMotivo()
  const fijos = proyecto ? { project: proyecto } : undefined
  // Enter en una fila abre su ficha y Espacio su vista previa (05-especificacion §1.6), como el enlace y el ojo de la fila
  const previa = useRutaDeVistaPrevia()
  const paso = useSiguientePaso()
  const rutaDe = (a: Registro) => `/projects/${encodeURIComponent(texto(a, 'project'))}/agreements/${encodeURIComponent(a.id)}`
  const enlace = (a: Registro) => (
    <EnlaceDeRegistro
      codigo={texto(a, 'code')}
      titulo={texto(a, 'title')}
      ruta={rutaDe(a)}
      desde={t('acuerdos.titulo')}
      previa={{ objeto: 'agreement', id: a.id }}
    />
  )
  const proyectoDe = (a: Registro) => <ProyectoEnLista proyecto={proyectos.data?.find((x) => x.id === texto(a, 'project'))} />
  // la tabla con prioridad de columnas (hallazgo U-06, DD-05): esenciales el acuerdo, el proyecto (en lo global), el estado, la
  // vigencia y el vencimiento; secundario, desde xl, el tipo
  const columnas: ColumnaPriorizada[] = [
    { id: 'acuerdo', encabezado: t('acuerdos.columnas.acuerdo'), prioridad: 'esencial', claseDeCelda: 'min-w-64 text-sm', ordenable: true },
    ...(proyecto ? [] : [{ id: 'proyecto', encabezado: t('acuerdos.columnas.proyecto'), prioridad: 'esencial' as const, claseDeCelda: 'text-sm' }]),
    { id: 'tipo', encabezado: t('acuerdos.columnas.tipo'), prioridad: 'secundaria', claseDeCelda: 'text-sm' },
    { id: 'estado', encabezado: t('acuerdos.columnas.estado'), prioridad: 'esencial' },
    { id: 'vigencia', encabezado: t('acuerdos.columnas.vigencia'), prioridad: 'esencial' },
    { id: 'vence', encabezado: t('acuerdos.columnas.vence'), prioridad: 'esencial', claseDeCelda: 'text-sm whitespace-nowrap', ordenable: true }
  ]
  const celda = (a: Registro, columna: string): ReactNode => {
    switch (columna) {
      case 'acuerdo':
        return enlace(a)
      case 'proyecto':
        return proyectoDe(a)
      case 'tipo':
        return opcion(a, 'agreement_type')
      case 'estado':
        return <EstadoChip objeto="agreement" estado={a.state} />
      case 'vigencia':
        return <SituacionDePlazo valor={atributo(a, 'validity_status')} vigencia />
      default:
        return <Dia valor={texto(a, 'expiry_date')} />
    }
  }
  return (
    <section className="mx-auto max-w-[1440px] space-y-4">
      <EncabezadoDePagina
        titulo={t('acuerdos.titulo')}
        vistas={<PaginasDeCompromisos actual="agreements" />}
        conteo={acuerdos.data?.totalElements != null ? t('acuerdos.conteo', { count: acuerdos.data.totalElements }) : undefined}
        primaria={
          proyecto ? (
            escribe && can('agreement', 'CREATE') ? (
              <Button size="sm" onClick={() => setCreando(true)}>
                {t('acuerdos.nuevo')}
              </Button>
            ) : undefined
          ) : (
            <BotonCrear objeto="agreement" etiqueta={t('acuerdos.nuevo')} resto="agreements?nuevo=1" />
          )
        }
      />
      <BarraDeFiltros
        busqueda={{ etiqueta: t('acuerdos.buscar'), valor: parametros.filtro('q'), alCambiar: (valor) => parametros.cambiar({ q: valor }) }}
        aplicados={q ? [{ clave: 'q', etiqueta: t('comun.contiene', { texto: q }), alQuitar: () => parametros.cambiar({ q: null }) }] : []}
        alLimpiar={() => parametros.cambiar({ q: null })}
      />
      {acuerdos.isPending ? (
        <Cargando />
      ) : acuerdos.isError && !acuerdos.data ? (
        <FalloDeLectura error={acuerdos.error} alReintentar={() => void acuerdos.refetch()} />
      ) : lista.length === 0 ? (
        q ? (
          <VacioDeLista conFiltros alLimpiar={() => parametros.cambiar({ q: null })} />
        ) : (
          <Vacio titulo={t('acuerdos.vacio')}>{t('acuerdos.vacioAyuda')}</Vacio>
        )
      ) : telefono ? (
        // en el teléfono, tarjetas con el título, el estado, la vigencia y el proyecto (revisión de UX, etapa 8)
        <ListaEnTarjetas
          etiqueta={t('acuerdos.tabla')}
          total={acuerdos.data?.totalElements ?? null}
          tarjetas={lista.map((a) => ({
            id: a.id,
            titulo: enlace(a),
            estado: <EstadoChip objeto="agreement" estado={a.state} />,
            plazo: (
              <>
                <SituacionDePlazo valor={atributo(a, 'validity_status')} vigencia />
                <Dia valor={texto(a, 'expiry_date')} />
              </>
            ),
            proyecto: proyecto ? undefined : proyectoDe(a),
            detalle: opcion(a, 'agreement_type') || undefined
          }))}
        />
      ) : (
        <TablaPriorizada<Registro>
          etiqueta={t('acuerdos.tabla')}
          total={acuerdos.data?.totalElements ?? null}
          columnas={columnas}
          filas={lista}
          clave={(a) => a.id}
          celda={celda}
          orden={orden}
          alOrdenar={ordenar}
          alAbrir={(a) => navegar(rutaDe(a), { state: paso(t('acuerdos.titulo'), rutaDe(a)) })}
          alPrevisualizar={(a) => navegar(previa('agreement', a.id))}
        />
      )}
      <PaginacionDelServidor datos={acuerdos.data} alPagina={(p) => parametros.cambiar({ page: String(p) })} />
      {proyecto && fijos ? (
        <Drawer titulo={t('acuerdos.nuevoTitulo')} abierto={creando} alCerrar={() => setCreando(false)}>
          <CampoDeMotivo motivo={motivo} etiqueta={t('acuerdos.motivo')} ayuda={t('acuerdos.motivoAyuda')} />
          <FormularioDeRegistro
            objeto="agreement"
            fijos={fijos}
            campos={CAMPOS_DEL_ACUERDO}
            motivo={motivo.recortado}
            antesDeEnviar={motivo.exigir}
            alGuardar={(a) => {
              setCreando(false)
              motivo.limpiar()
              navegar(`/projects/${encodeURIComponent(proyecto)}/agreements/${encodeURIComponent(a.id)}`, {
                state: conHecho(null, t('acuerdos.hecho', { codigo: texto(a, 'code') || texto(a, 'title') }))
              })
            }}
            alCancelar={() => setCreando(false)}
          />
        </Drawer>
      ) : null}
    </section>
  )
}
