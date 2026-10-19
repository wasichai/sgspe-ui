import { describe, expect, it } from 'vitest'
import { registro } from '../../test/montar'
import { rutaEnElMapa } from './VerEnElMapa'

// la revisión de UX, etapa 6: «Ver en el mapa» lleva al mapa territorial con el lugar del registro elegido y su proyecto puesto
describe('rutaEnElMapa', () => {
  it('una comunidad o una localidad es su propio lugar', () => {
    expect(rutaEnElMapa('community', registro('c1', { name: 'CC Tunas Pampa' }))).toBe('/territory?selected=community%3Ac1')
    expect(rutaEnElMapa('locality', registro('l1', {}))).toBe('/territory?selected=locality%3Al1')
  })

  it('otro registro va a su comunidad o, sin ella, a su localidad, con su proyecto', () => {
    expect(rutaEnElMapa('commitment', registro('k1', { project: 'p1', community: 'c1', locality: 'l1' }))).toBe('/territory?project=p1&selected=community%3Ac1')
    expect(rutaEnElMapa('engagement', registro('e1', { project: 'p1', locality: 'l1' }))).toBe('/territory?project=p1&selected=locality%3Al1')
  })

  it('sin lugar no se ofrece', () => {
    expect(rutaEnElMapa('social_risk', registro('r1', { project: 'p1' }))).toBeNull()
  })
})
