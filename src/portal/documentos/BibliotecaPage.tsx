import { useAuth } from '@wasichai/core'
import { Button } from '@wasichai/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { CONTROL, SelectNativo } from '../componentes/Campo'
import { Drawer } from '../componentes/Drawer'
import { Restringido } from '../componentes/Estados'
import { ChipsDeFiltro, TablaDeRegistros, useParametrosDeLista, VacioDeLista, type Columna } from '../componentes/Lista'
import { useEscribeEnProyecto } from '../contexto/ProyectoLayout'
import { nombreDeProyecto, useProyectos } from '../contexto/proyectos'
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
      .map((f) => ({ clave: f, etiqueta: f === 'q' ? lista.filtro(f) : rotuloDeOpcion(lista.filtro(f)) })),
    ...(sinConsentimiento ? [{ clave: 'consent', etiqueta: t('documentos.sinConsentimiento') }] : [])
  ]
  const columnas: Columna[] = [
    { id: 'evidencia', encabezado: t('documentos.columnas.evidencia'), celda: (e) => nombreDeEvidencia(e) },
    // en el alcance global, de qué proyecto es (o «—» si es de la organización)
    ...(proyecto
      ? []
      : [
          {
            id: 'proyecto',
            encabezado: t('documentos.columnas.proyecto'),
            celda: (e: Registro) => {
              const p = proyectos.data?.find((x) => x.id === atributo(e, 'project'))
              return p ? nombreDeProyecto(p) : atributo(e, 'project') ? '…' : '—'
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
    <section className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sg-h1 font-semibold">{t('documentos.titulo')}</h1>
        {sube ? <Button onClick={() => setSubiendo(true)}>{t('evidencias.subir')}</Button> : null}
      </div>
      <p className="text-sm text-sg-text-secondary">{t('documentos.ayuda')}</p>
      <div role="group" aria-label={t('comun.filtros')} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="space-y-1">
          <span className="block">{t('documentos.buscar')}</span>
          <input type="search" className={CONTROL} value={lista.filtro('q')} onChange={(e) => lista.cambiar({ q: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="block">{t('documentos.tipo')}</span>
          <SelectNativo
            textoVacio={t('comun.todos')}
            value={lista.filtro('evidence_type')}
            onChange={(e) => lista.cambiar({ evidence_type: e.target.value })}
            opciones={opciones('evidence_type')}
          />
        </label>
        {leeClasificacion ? (
          <label className="space-y-1">
            <span className="block">{t('documentos.clasificacion')}</span>
            <SelectNativo
              textoVacio={t('comun.todos')}
              value={lista.filtro('classification')}
              onChange={(e) => lista.cambiar({ classification: e.target.value })}
              opciones={opciones('classification')}
            />
          </label>
        ) : null}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={sinConsentimiento} onChange={(e) => lista.cambiar({ consent: e.target.checked ? 'missing' : null })} />
          {t('documentos.sinConsentimiento')}
        </label>
      </div>
      <ChipsDeFiltro
        chips={chips}
        alQuitar={(clave) => lista.cambiar({ [clave]: null })}
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
    </section>
  )
}
