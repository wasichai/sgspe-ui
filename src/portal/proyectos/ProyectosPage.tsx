import { useAuth } from '@wasichai/core'
import { Button, Table, Td, Th } from '@wasichai/ui'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { SelectNativo } from '../componentes/Campo'
import { EstadoChip } from '../componentes/EstadoChip'
import { Cargando, ErrorDeCarga } from '../componentes/Estados'
import { ChipsDeFiltro, useParametrosDeLista, VacioDeLista, VistasGuardadas } from '../componentes/Lista'
import { ROL_DE_JEFATURA } from '../config'
import { useMisProyectos } from '../contexto/proyectos'
import { atributo, texto, useDefinicion, useTodos, type Registro } from '../datos/registros'
import { NS } from '../i18n'

// S06 · lista de proyectos (screens.md §3): vistas "Mis proyectos", "Activos", "En revisión" y "Todos"; filtros por tipo,
// etapa y fase en la URL; la jefatura son las asignaciones activas con el rol de jefatura (ASM-080) y la campaña en curso,
// la que está EN EJECUCION. los proyectos de un tenant son pocos: se leen todos y se filtran aquí
const VISTAS = ['mine', 'active', 'in_review', 'all'] as const
const FILTROS = [
  ['project_type', 'tipo'],
  ['stage', 'etapa'],
  ['exploration_phase', 'fase']
] as const

export function ProyectosPage() {
  const { t } = useTranslation(NS)
  const { can } = useAuth()
  const navegar = useNavigate()
  const lista = useParametrosDeLista('mine')
  const proyectos = useTodos('project', { sort: 'name', dir: 'asc' })
  const definicion = useDefinicion('project')
  const mios = useMisProyectos()
  const jefaturas = useTodos('project_assignment', { role_name: ROL_DE_JEFATURA, active: true })
  const campanas = useTodos('exploration_campaign', { campaign_status: 'EN EJECUCION' })

  const porProyecto = (registros: Registro[] | undefined, campo: string) => {
    const mapa = new Map<string, string[]>()
    for (const r of registros ?? []) {
      const proyecto = String(atributo(r, 'project'))
      mapa.set(proyecto, [...(mapa.get(proyecto) ?? []), texto(r, campo)])
    }
    return mapa
  }
  const jefes = porProyecto(jefaturas.data, 'member_user_email')
  const enCurso = porProyecto(campanas.data, 'name')

  const filtrados = (proyectos.data ?? []).filter((p) => {
    if (lista.vista === 'mine' && !mios.has(p.id)) return false
    if ((lista.vista === 'active' || lista.vista === 'in_review') && p.state !== lista.vista) return false
    return FILTROS.every(([campo]) => !lista.filtro(campo) || atributo(p, campo) === lista.filtro(campo))
  })
  const chips = FILTROS.filter(([campo]) => lista.filtro(campo)).map(([campo, clave]) => ({
    clave: campo,
    etiqueta: `${t(`proyectos.filtros.${clave}`)}: ${lista.filtro(campo)}`
  }))
  const opciones = (campo: string) => definicion.data?.fields.find((f) => f.name === campo)?.enumOptions ?? []

  return (
    <div className="mx-auto max-w-[1440px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-sg-h1 font-semibold text-sg-text">{t('proyectos.titulo')}</h1>
          <p className="text-sm text-sg-text-muted">{t('proyectos.conteo', { n: filtrados.length })}</p>
        </div>
        {can('project', 'CREATE') ? (
          <Button asChild>
            <Link to="/projects/new">{t('proyectos.nuevo')}</Link>
          </Button>
        ) : null}
      </div>
      <VistasGuardadas
        vistas={VISTAS.map((id) => ({ id, etiqueta: t(`proyectos.vistas.${id}`) }))}
        actual={lista.vista}
        alCambiar={(id) => lista.cambiar({ view: id })}
      />
      <div className="flex flex-wrap gap-3">
        {FILTROS.map(([campo, clave]) => (
          <SelectNativo
            key={campo}
            aria-label={t(`proyectos.filtros.${clave}`)}
            className="w-auto"
            opciones={opciones(campo)}
            value={lista.filtro(campo)}
            onChange={(e) => lista.cambiar({ [campo]: e.target.value })}
          />
        ))}
      </div>
      <ChipsDeFiltro
        chips={chips}
        alQuitar={(clave) => lista.cambiar({ [clave]: null })}
        alLimpiar={() => lista.cambiar(Object.fromEntries(FILTROS.map(([c]) => [c, null])))}
      />
      {proyectos.isPending ? (
        <Cargando />
      ) : proyectos.isError ? (
        <ErrorDeCarga error={proyectos.error} alReintentar={() => void proyectos.refetch()} />
      ) : filtrados.length === 0 ? (
        <VacioDeLista
          conFiltros={chips.length > 0 || lista.vista !== 'all'}
          alLimpiar={() => lista.cambiar({ view: 'all', ...Object.fromEntries(FILTROS.map(([c]) => [c, null])) })}
        >
          {t('proyectos.vacio')}
        </VacioDeLista>
      ) : (
        <div className="overflow-x-auto rounded-sg-lg border border-sg-border bg-sg-surface">
          <Table aria-label={t('proyectos.titulo')}>
            <thead>
              <tr>
                {(['codigo', 'nombre', 'tipo', 'etapa', 'estado', 'jefatura', 'campana'] as const).map((c) => (
                  <Th key={c} scope="col">
                    {t(`proyectos.columnas.${c}`)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-sg-surface-hover" onClick={() => navegar(`/projects/${p.id}/overview`)}>
                  <Td className="font-sg-mono text-sg-caption">{texto(p, 'code')}</Td>
                  <Td>
                    <Link to={`/projects/${p.id}/overview`} className="font-medium text-sg-primary-text" onClick={(e) => e.stopPropagation()}>
                      {texto(p, 'name')}
                    </Link>
                  </Td>
                  <Td className="text-sm">{texto(p, 'project_type')}</Td>
                  <Td className="text-sm">{texto(p, 'stage')}</Td>
                  <Td>
                    <EstadoChip objeto="project" estado={p.state} />
                  </Td>
                  <Td className="text-sm">{jefes.get(p.id)?.join(', ') ?? <span className="text-sg-warning">{t('proyectos.sinJefatura')}</span>}</Td>
                  <Td className="text-sm">{enCurso.get(p.id)?.join(', ') ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}
