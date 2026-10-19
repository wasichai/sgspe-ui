import { describe, expect, it } from 'vitest'
import { seccionDeRuta } from './seccionActual'

// la revisión de UX, etapa 1: dentro de una ficha de proyecto, la barra lateral marca el módulo, no «Proyectos»
describe('seccionDeRuta', () => {
  it('fuera de un proyecto, la sección de la ruta', () => {
    expect(seccionDeRuta('/')).toBe('dashboard')
    expect(seccionDeRuta('/commitments')).toBe('commitments')
    expect(seccionDeRuta('/territory/communities/k1')).toBe('territory')
    expect(seccionDeRuta('/tasks/approvals')).toBe('tasks')
    expect(seccionDeRuta('/projects')).toBe('projects')
    expect(seccionDeRuta('/projects/new')).toBe('projects')
  })

  it('dentro de un proyecto, el módulo abierto; resumen, mapa y equipo son Proyectos', () => {
    expect(seccionDeRuta('/projects/p1/commitments/c1')).toBe('commitments')
    expect(seccionDeRuta('/projects/p1/agreements/a1')).toBe('commitments')
    expect(seccionDeRuta('/projects/p1/grievances/g1')).toBe('attention')
    expect(seccionDeRuta('/projects/p1/contributions/x1')).toBe('programs')
    expect(seccionDeRuta('/projects/p1/field-visits/v1')).toBe('engagements')
    expect(seccionDeRuta('/projects/p1/incidents/i1')).toBe('risks')
    expect(seccionDeRuta('/projects/p1/overview')).toBe('projects')
    expect(seccionDeRuta('/projects/p1/map')).toBe('projects')
    expect(seccionDeRuta('/projects/p1')).toBe('projects')
  })

  it('las fichas de los maestros marcan su sección; los avisos y /r/… ninguna', () => {
    expect(seccionDeRuta('/actors/a1')).toBe('stakeholders')
    expect(seccionDeRuta('/agreements')).toBe('commitments')
    expect(seccionDeRuta('/notifications')).toBeNull()
    expect(seccionDeRuta('/r/commitment/c1')).toBeNull()
  })
})
