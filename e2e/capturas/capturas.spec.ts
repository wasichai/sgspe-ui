import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { prepararEscenario, type Idioma, type Tema } from './escenario'

// las capturas del rediseño (wasichai/sgspe-ui#88, fase 1): fotos de página completa de las pantallas representativas, para
// comparar el «antes» con el «después». no son pruebas de regresión visual (nada se compara aquí) ni corren con yarn e2e: solo
// con yarn capturas (proyecto «capturas» de playwright.config.ts). salen en SGSPE_CAPTURAS (por defecto capturas/ en la raíz)
// con el nombre <pantalla>-<ancho>-<tema>-<idioma>.png
const SALIDA = resolve(process.env.SGSPE_CAPTURAS ?? join(import.meta.dirname, '..', '..', 'capturas'))

const SIN_SIMULAR = /^\/api\/(auth\/me\/notifications\/stream|sgspe\/territory\/wms)$/

interface Pantalla {
  nombre: string
  ruta: string
  sesion?: boolean
  admin?: boolean
  // con la IA activada para la organización
  ia?: boolean
  // el botón que se pulsa antes de la foto (la fila abierta de la cola de QCS)
  abrir?: string
}

const PANTALLAS: Pantalla[] = [
  { nombre: 'login', ruta: '/login', sesion: false },
  { nombre: 'inicio', ruta: '/' },
  { nombre: 'revision-ejecutiva', ruta: '/dashboards/executive' },
  { nombre: 'proyectos', ruta: '/projects' },
  { nombre: 'proyectos-previa', ruta: '/projects?view=all&peek=project%3Ap1' },
  // «Tabla · Mapa» del portafolio (wasichai/sgspe-ui#123): la lista junto al mapa con Pukaqaqa elegido y su vista previa
  { nombre: 'proyectos-mapa', ruta: '/projects?view=mapa&selected=project%3Ap1' },
  { nombre: 'p360-resumen', ruta: '/projects/p1/overview' },
  { nombre: 'grupos', ruta: '/projects/p1/stakeholders' },
  { nombre: 'grupos-previa', ruta: '/projects/p1/stakeholders?peek=stakeholder%3As1' },
  { nombre: 'grupo-ficha', ruta: '/projects/p1/stakeholders/s1' },
  { nombre: 'grupos-matriz', ruta: '/projects/p1/stakeholders/matrix' },
  { nombre: 'relacionamiento', ruta: '/projects/p1/engagements' },
  { nombre: 'relacionamiento-previa', ruta: '/projects/p1/engagements?peek=engagement%3Ae1' },
  { nombre: 'relacionamiento-semana', ruta: '/projects/p1/engagements?view=semana&day=2026-10-16' },
  { nombre: 'interaccion-ficha', ruta: '/projects/p1/engagements/e1' },
  { nombre: 'compromisos', ruta: '/projects/p1/commitments' },
  { nombre: 'compromisos-previa', ruta: '/projects/p1/commitments?peek=commitment%3Ak4' },
  { nombre: 'compromiso-ficha', ruta: '/projects/p1/commitments/k1' },
  { nombre: 'compromiso-bloqueado', ruta: '/projects/p1/commitments/k4' },
  // los estados de E18 sobre Compromisos: el vacío por filtros y el error al cargar (la carga se ve en las pruebas)
  { nombre: 'compromisos-vacio', ruta: '/projects/p1/commitments?q=sin-resultados&view=vencidos' },
  { nombre: 'compromisos-error', ruta: '/projects/p1/commitments?q=falla-de-prueba' },
  { nombre: 'territorio', ruta: '/territory?project=p1' },
  // fase 9: el lugar elegido con su ficha y la lista sincronizada, y la vista «Lista + mapa» de Compromisos y Grupos de interés
  { nombre: 'territorio-lugar', ruta: '/territory?project=p1&selected=locality%3Al1' },
  { nombre: 'compromisos-mapa', ruta: '/projects/p1/commitments?view=mapa&selected=commitment%3Ak4' },
  { nombre: 'grupos-mapa', ruta: '/projects/p1/stakeholders?view=mapa&selected=stakeholder%3As1' },
  { nombre: 'riesgos', ruta: '/projects/p1/risks' },
  { nombre: 'riesgo-ficha', ruta: '/projects/p1/risks/r1?tab=revisiones' },
  { nombre: 'alertas', ruta: '/projects/p1/risks/warnings?view=todas' },
  { nombre: 'alerta-ficha', ruta: '/projects/p1/risks/warnings/w1' },
  { nombre: 'qcs', ruta: '/projects/p1/attention' },
  // fase 9: la vista «Lista + mapa» de Riesgos y QCS
  { nombre: 'riesgos-mapa', ruta: '/projects/p1/risks/register?view=mapa&selected=social_risk%3Ar1' },
  { nombre: 'qcs-mapa', ruta: '/projects/p1/attention?view=mapa&selected=inquiry%3Ai1' },
  { nombre: 'qcs-fila', ruta: '/projects/p1/attention', abrir: 'Ver el ciclo de vida de Q-001' },
  { nombre: 'programas', ruta: '/projects/p1/programs' },
  // fase 11: programas e inversión, documentos, tareas y aprobaciones (escenarioF11.ts)
  { nombre: 'aportes', ruta: '/projects/p1/programs?view=todos' },
  { nombre: 'programa-ficha', ruta: '/projects/p1/programs/sp1' },
  { nombre: 'programa-presupuesto', ruta: '/projects/p1/programs/sp1?tab=presupuesto' },
  { nombre: 'aporte-ficha', ruta: '/projects/p1/contributions/ap1' },
  { nombre: 'aporte-entregado', ruta: '/projects/p1/contributions/ap2?tab=entrega' },
  { nombre: 'documentos', ruta: '/projects/p1/documents' },
  { nombre: 'evidencia-ficha', ruta: '/projects/p1/documents/ev1' },
  { nombre: 'evidencia-restringida', ruta: '/projects/p1/documents/ev3' },
  { nombre: 'tareas', ruta: '/tasks' },
  { nombre: 'tareas-tablero', ruta: '/tasks?view=tablero' },
  { nombre: 'tareas-calendario', ruta: '/tasks?view=calendario' },
  { nombre: 'aprobaciones', ruta: '/tasks/approvals' },
  // con una elegida, en el teléfono el detalle ocupa la pantalla sin el título de la bandeja: solo en escritorio
  { nombre: 'aprobaciones-detalle', ruta: '/tasks/approvals?selected=social_contribution%3Aap1' },
  { nombre: 'aprobacion-compromiso', ruta: '/tasks/approvals/commitment/k7' },
  { nombre: 'entregables', ruta: '/projects/p1/reports' },
  { nombre: 'entregable', ruta: '/reports/deliverables/d1?seccion=antecedentes', admin: true, ia: true },
  { nombre: 'administracion', ruta: '/administration', admin: true },
  // fase 12: reportes y entregables, IA, avisos, la consola de la plataforma y la ruta que no existe
  { nombre: 'entregables-global', ruta: '/reports' },
  { nombre: 'plantillas', ruta: '/reports/templates', admin: true },
  { nombre: 'bandeja-ia', ruta: '/projects/p1/ai-review', ia: true },
  { nombre: 'avisos', ruta: '/notifications' },
  { nombre: 'admin-consola', ruta: '/admin', admin: true },
  // el cajón de /admin abierto en el teléfono (wasichai/sgspe-ui#121, @wasichai/core 1.8.2): solo a 390, donde está el botón
  { nombre: 'admin-menu', ruta: '/admin', admin: true, abrir: 'Abrir el menú' },
  { nombre: 'no-encontrada', ruta: '/reports/no-existe' }
]
// las de la fase 12 (wasichai/sgspe-ui#111): 1440 en claro y oscuro y 390 en claro
const FASE_12 = ['entregables', 'entregable', 'bandeja-ia', 'avisos', 'administracion', 'admin-consola', 'no-encontrada']
const PRINCIPALES = [
  'login',
  'inicio',
  'revision-ejecutiva',
  'proyectos',
  'proyectos-mapa',
  'p360-resumen',
  'grupos',
  'relacionamiento',
  'compromisos',
  'compromisos-previa',
  'compromiso-ficha',
  'compromiso-bloqueado',
  'compromisos-vacio',
  'compromisos-error',
  'territorio',
  'territorio-lugar',
  'riesgos',
  'qcs',
  'programas',
  'aportes',
  'programa-ficha',
  'aporte-ficha',
  'documentos',
  'evidencia-ficha',
  'tareas',
  'aprobaciones',
  'aprobaciones-detalle',
  'aprobacion-compromiso'
]
const ANGOSTAS = [
  'login',
  'inicio',
  'revision-ejecutiva',
  'proyectos',
  'p360-resumen',
  'grupos',
  'relacionamiento',
  'compromisos',
  'compromiso-ficha',
  'compromiso-bloqueado',
  'compromisos-vacio',
  'compromisos-error',
  'riesgos',
  'qcs',
  'territorio',
  'territorio-lugar',
  'programas',
  'aportes',
  'programa-ficha',
  'aporte-ficha',
  'documentos',
  'evidencia-ficha',
  'tareas',
  'aprobaciones',
  'aprobacion-compromiso'
]

interface Variante {
  ancho: number
  alto: number
  tema: Tema
  idioma: Idioma
}
const ESCRITORIO = { ancho: 1440, alto: 900 }
// 1440 claro es en todas; 1440 oscuro es y 1440 claro en en las principales; 1024 y 390 claro es en las angostas
// las que solo existen en el teléfono (un control que desde md no se dibuja): 390 claro es y nada más
const SOLO_390 = ['admin-menu']
const variantesDe = (nombre: string): Variante[] =>
  SOLO_390.includes(nombre) ? [{ ancho: 390, alto: 844, tema: 'light', idioma: 'es' }] : variantesComunes(nombre)
const variantesComunes = (nombre: string): Variante[] => [
  { ...ESCRITORIO, tema: 'light', idioma: 'es' },
  ...(FASE_12.includes(nombre)
    ? [
        { ...ESCRITORIO, tema: 'dark' as const, idioma: 'es' as const },
        { ancho: 390, alto: 844, tema: 'light' as const, idioma: 'es' as const }
      ]
    : []),
  ...(PRINCIPALES.includes(nombre)
    ? [
        { ...ESCRITORIO, tema: 'dark' as const, idioma: 'es' as const },
        { ...ESCRITORIO, tema: 'light' as const, idioma: 'en' as const }
      ]
    : []),
  ...(ANGOSTAS.includes(nombre)
    ? [
        { ancho: 1024, alto: 768, tema: 'light' as const, idioma: 'es' as const },
        { ancho: 390, alto: 844, tema: 'light' as const, idioma: 'es' as const }
      ]
    : [])
]

// la pantalla terminó de cargar: sin «Cargando…» ni esqueletos (Estados.tsx), cada mapa en reposo (MapaImpl.tsx, data-reposo),
// cada gráfico con su SVG dibujado (GraficoImpl.tsx), las fuentes listas y la red quieta
async function esperarPantallaLista(page: Page): Promise<void> {
  await expect(page.locator('#root h1, #root form').first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-busy="true"], [data-esqueleto]')).toHaveCount(0)
  await expect(page.locator('[data-testid="mapa"]:not([data-reposo="si"])')).toHaveCount(0)
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[role="group"][aria-label] > div[style*="height"]')].every((caja) => caja.querySelector('svg path'))
  )
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')
}

// el contenido se desplaza dentro de <main> (AppShell.tsx), no en la página: fullPage solo vería la ventana. se alarga la ventana
// hasta que <main> ya no se desplace (unas pocas vueltas: alargarla puede cambiar alturas) y se vuelve a esperar lo dibujado
async function alargarHastaElContenido(page: Page, variante: Variante): Promise<void> {
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const sobra = await page.evaluate(() => {
      const main = document.querySelector('main')
      return main ? main.scrollHeight - main.clientHeight : 0
    })
    if (sobra <= 0) break
    const actual = page.viewportSize()!
    await page.setViewportSize({ width: variante.ancho, height: actual.height + sobra })
    await esperarPantallaLista(page)
  }
}

test.beforeAll(() => mkdirSync(SALIDA, { recursive: true }))

for (const pantalla of PANTALLAS)
  for (const variante of variantesDe(pantalla.nombre)) {
    const archivo = `${pantalla.nombre}-${variante.ancho}-${variante.tema}-${variante.idioma}.png`
    test(archivo, async ({ page }) => {
      // lo que la API simulada no contesta queda anotado: una captura con un 404 inesperado no muestra la pantalla entera. el
      // flujo de avisos y el WMS no se simulan a propósito
      page.on('response', (r) => {
        const ruta = new URL(r.url()).pathname
        if (ruta.startsWith('/api/') && r.status() === 404 && !SIN_SIMULAR.test(ruta))
          test.info().annotations.push({ type: 'api-sin-simular', description: ruta })
      })
      await page.setViewportSize({ width: variante.ancho, height: variante.alto })
      await page.emulateMedia({ colorScheme: variante.tema })
      await prepararEscenario(page, { tema: variante.tema, idioma: variante.idioma, sesion: pantalla.sesion ?? true, admin: pantalla.admin, ia: pantalla.ia })
      await page.goto(pantalla.ruta)
      await esperarPantallaLista(page)
      if (pantalla.abrir) {
        await page.getByRole('button', { name: pantalla.abrir }).click()
        await esperarPantallaLista(page)
      }
      await expect(page.locator('html')).toHaveAttribute('data-theme', variante.tema)
      await expect(page.locator('html')).toHaveAttribute('lang', variante.idioma === 'es' ? 'es-PE' : 'en')
      await alargarHastaElContenido(page, variante)
      await page.screenshot({ path: join(SALIDA, archivo), fullPage: true, animations: 'disabled' })
    })
  }
