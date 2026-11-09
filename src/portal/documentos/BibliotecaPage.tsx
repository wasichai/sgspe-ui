import { EnlaceDeRegistro } from '../componentes/EnlaceDeRegistro'
import { ContenedorDePagina, EncabezadoDePagina } from '../componentes/Pagina'
import { ProyectoEnLista } from '../componentes/ProyectoEnLista'
import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { BarraDeFiltros } from '../componentes/BarraDeFiltros'
import { FiltroDeLista } from '../componentes/FiltroDeLista'
import { Drawer } from '../componentes/Drawer'
import { Restringido } from '../componentes/Estados'
import { TablaDeRegistros, useParametrosDeLista, VacioDeLista, type Columna } from '../componentes/Lista'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { useProyectos } from '../contexto/proyectos'
import { descriptorDe, tamanoPe } from '../datos/archivos'
import { rutaDeFicha } from '../datos/fichas'
import { atributo, campoDe, useDefinicion, useRegistros, type Registro } from '../datos/registros'
import { diaPe, fechaPe, NS } from '../i18n'
import { useContextFilters } from '../shell/context'
import { useNombreDeEvidencia } from './api'
import { FormularioDeEvidencia } from './FormularioDeEvidencia'
import { opcion, rotuloDeOpcion } from '../datos/opciones'

// S45 · biblioteca de documentos (screens.md §11): las evidencias del alcance (global: todas las de la organización, con la
// columna Proyecto; un proyecto: las suyas), por página desde el servidor, con búsqueda y filtros en la URL. la clasificación
// que la cuenta no lee dice «Restringido», y el nombre del archivo de una restringida, «Archivo reservado» (P59). subir una evidencia aquí la deja sin vínculo: la ficha la vincula después
const POR_PAGINA = 25

export function BibliotecaPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const navegar = useNavigate()
  const nombreDeEvidencia = useNombreDeEvidencia()
  const { scope } = useContextFilters()
  const proyecto = scope.kind === 'project' ? scope.projectId : undefined
  const escribe = useEscribeEnProyecto(proyecto)
  const definicion = useDefinicion('evidence')
  const proyectos = useProyectos()
  const lista = useParametrosDeLista('todas')
  const [subiendo, setSubiendo] = useState(false)
  const sinConsentimiento = lista.filtro('consent') === 'missing'
  const evidencias = useRegistros('evidence', {
    project: proyecto,
    q: lista.filtro('q') || undefined,
    evidence_type: lista.filtro('evidence_type') || undefined,
    classification: lista.filtro('classification') || undefined,
    ...(sinConsentimiento ? { people_identifiable: true, photo_consent_given: false } : {}),
    sort: 'created_at',
    dir: 'desc',
    page: lista.pagina,
    size: POR_PAGINA
  })
  const opciones = (campo: string) => campoDe(definicion.data, campo)?.enumOptions ?? []
  const leeClasificacion = campoDe(definicion.data, 'classification') !== undefined
  // en un proyecto la subida exige la asignación vigente (ProjectScopeGuard); en la organización, solo el permiso
  const sube = can('evidence', 'CREATE') && (proyecto === undefined || escribe)
  const chips = [
    ...(['evidence_type', 'classification', 'q'] as const)
      .filter((f) => lista.filtro(f))
      .map((f) => ({
        clave: f,
        etiqueta:
          f === 'q'
            ? t('comun.contiene', { texto: lista.filtro(f) })
            : `${t(f === 'evidence_type' ? 'documentos.tipo' : 'documentos.clasificacion')}: ${rotuloDeOpcion(lista.filtro(f))}`
      })),
    ...(sinConsentimiento ? [{ clave: 'consent', etiqueta: t('documentos.sinConsentimiento') }] : [])
  ]
  const columnas: Columna[] = [
    // el título es un enlace a la ficha (D12 de la revisión de UX: la fila se abría, pero nada lo decía)
    {
      id: 'evidencia',
      titulo: true,
      encabezado: t('documentos.columnas.evidencia'),
      celda: (e) => <EnlaceDeRegistro titulo={nombreDeEvidencia(e)} ruta={rutaDeFicha('evidence', e)} desde={t('documentos.titulo')} />
    },
    // en el alcance global, de qué proyecto es (o «—» si es de la organización)
    ...(proyecto
      ? []
      : [
          {
            id: 'proyecto',
            encabezado: t('documentos.columnas.proyecto'),
            celda: (e: Registro) => {
              const p = proyectos.data?.find((x) => x.id === atributo(e, 'project'))
              return p ? <ProyectoEnLista proyecto={p} /> : atributo(e, 'project') ? '…' : '—'
            }
          }
        ]),
    { id: 'tipo', encabezado: t('documentos.columnas.tipo'), celda: (e) => opcion(e, 'evidence_type') || '—' },
    {
      id: 'clasificacion',
      encabezado: t('documentos.columnas.clasificacion'),
      celda: (e) => ('classification' in e.attributes ? opcion(e, 'classification') : <Restringido />)
    },
    {
      id: 'tamano',
      numerica: true,
      encabezado: t('documentos.columnas.tamano'),
      celda: (e) => {
        const d = descriptorDe(atributo(e, 'file'))
        return d ? tamanoPe(d.size) : '—'
      }
    },
    {
      id: 'fecha',
      encabezado: t('documentos.columnas.fecha'),
      celda: (e) => {
        const dia = atributo<string>(e, 'document_date')
        return dia ? diaPe(dia) : e.createdAt ? fechaPe(new Date(e.createdAt)) : '—'
      }
    }
  ]
  return (
    <ContenedorDePagina elemento="section">
      <EncabezadoDePagina
        titulo={t('documentos.titulo')}
        descripcion={t('documentos.ayuda')}
        conteo={evidencias.data?.totalElements != null ? t('documentos.conteo', { count: evidencias.data.totalElements }) : undefined}
        primaria={
          sube ? (
            <Button size="sm" onClick={() => setSubiendo(true)}>
              {t('evidencias.subir')}
            </Button>
          ) : undefined
        }
      />
      {/* la barra de filtros de E (DD-04): la búsqueda, el tipo y la clasificación como filtros frecuentes y cada filtro aplicado como
          chip con su «×»; la búsqueda espera a que se deje de escribir */}
      <BarraDeFiltros
        busqueda={{ etiqueta: t('documentos.buscar'), valor: lista.filtro('q'), alCambiar: (q) => lista.cambiar({ q }) }}
        frecuentes={
          <>
            <FiltroDeLista
              etiqueta={t('documentos.tipo')}
              value={lista.filtro('evidence_type')}
              onChange={(e) => lista.cambiar({ evidence_type: e.target.value })}
              opciones={opciones('evidence_type')}
            />
            {leeClasificacion ? (
              <FiltroDeLista
                etiqueta={t('documentos.clasificacion')}
                value={lista.filtro('classification')}
                onChange={(e) => lista.cambiar({ classification: e.target.value })}
                opciones={opciones('classification')}
              />
            ) : null}
            <label className="inline-flex min-h-8 items-center gap-2 text-sm">
              <input type="checkbox" checked={sinConsentimiento} onChange={(e) => lista.cambiar({ consent: e.target.checked ? 'missing' : null })} />
              {t('documentos.sinConsentimiento')}
            </label>
          </>
        }
        aplicados={chips.map((chip) => ({ ...chip, alQuitar: () => lista.cambiar({ [chip.clave]: null }) }))}
        alLimpiar={() => lista.cambiar({ q: null, evidence_type: null, classification: null, consent: null })}
      />
      <TablaDeRegistros
        consulta={evidencias}
        columnas={columnas}
        etiqueta={t('documentos.tabla')}
        vacio={
          <VacioDeLista conFiltros={chips.length > 0} alLimpiar={() => lista.cambiar({ q: null, evidence_type: null, classification: null, consent: null })}>
            {t('documentos.vacioAyuda')}
          </VacioDeLista>
        }
        alPagina={(pagina) => lista.cambiar({ page: String(pagina) })}
        alAbrir={(e) => {
          const ruta = rutaDeFicha('evidence', e)
          if (ruta) navegar(ruta)
        }}
      />
      <Drawer
        titulo={t('evidencias.subirTitulo')}
        descripcion={proyecto ? undefined : t('documentos.subirSinProyecto')}
        abierto={subiendo}
        alCerrar={() => setSubiendo(false)}
      >
        <FormularioDeEvidencia
          proyecto={proyecto}
          alRegistrar={(e) => {
            setSubiendo(false)
            const ruta = rutaDeFicha('evidence', e)
            if (ruta) navegar(ruta)
          }}
          alCancelar={() => setSubiendo(false)}
        />
      </Drawer>
    </ContenedorDePagina>
  )
}
