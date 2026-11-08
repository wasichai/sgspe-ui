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
}

const PANTALLAS: Pantalla[] = [
  { nombre: 'login', ruta: '/login', sesion: false },
  { nombre: 'inicio', ruta: '/' },
  { nombre: 'revision-ejecutiva', ruta: '/dashboards/executive' },
  { nombre: 'proyectos', ruta: '/projects' },
  { nombre: 'p360-resumen', ruta: '/projects/p1/overview' },
  { nombre: 'grupos', ruta: '/projects/p1/stakeholders' },
  { nombre: 'relacionamiento', ruta: '/projects/p1/engagements' },
  { nombre: 'compromisos', ruta: '/projects/p1/commitments' },
  { nombre: 'compromiso-ficha', ruta: '/projects/p1/commitments/k1' },
  { nombre: 'territorio', ruta: '/territory?project=p1' },
  { nombre: 'riesgos', ruta: '/projects/p1/risks' },
  { nombre: 'qcs', ruta: '/attention' },
  { nombre: 'programas', ruta: '/projects/p1/programs' },
  { nombre: 'entregables', ruta: '/projects/p1/reports' },
  { nombre: 'entregable', ruta: '/reports/deliverables/d1' },
  { nombre: 'administracion', ruta: '/administration', admin: true }
]
const PRINCIPALES = ['inicio', 'revision-ejecutiva', 'p360-resumen', 'compromisos', 'territorio', 'riesgos']
const ANGOSTAS = ['inicio', 'p360-resumen', 'compromisos']

interface Variante {
  ancho: number
  alto: number
  tema: Tema
  idioma: Idioma
}
const ESCRITORIO = { ancho: 1440, alto: 900 }
// 1440 claro es en todas; 1440 oscuro es y 1440 claro en en las principales; 1024 y 390 claro es en las angostas
const variantesDe = (nombre: string): Variante[] => [
  { ...ESCRITORIO, tema: 'light', idioma: 'es' },
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
      await prepararEscenario(page, { tema: variante.tema, idioma: variante.idioma, sesion: pantalla.sesion ?? true, admin: pantalla.admin })
      await page.goto(pantalla.ruta)
      await esperarPantallaLista(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', variante.tema)
      await expect(page.locator('html')).toHaveAttribute('lang', variante.idioma === 'es' ? 'es-PE' : 'en')
      await alargarHastaElContenido(page, variante)
      await page.screenshot({ path: join(SALIDA, archivo), fullPage: true, animations: 'disabled' })
    })
  }
