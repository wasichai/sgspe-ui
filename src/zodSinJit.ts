import { config } from 'zod/v4/core'

// zod 4 prueba si puede compilar sus validadores con Function('') la primera vez que valida: con la CSP de security.md §3.2
// (script-src sin 'unsafe-eval') esa prueba es una violación de script-src en cada pantalla, también en /login, y lo que se
// prueba en desarrollo no es lo que corre en producción. sin JIT, zod salta la prueba y valida igual (revisión final, M9).
// la configuración es global (globalThis), así que vale para el zod de @wasichai/* y de @hookform/resolvers; main.tsx la
// importa antes que todo
config({ jitless: true })
