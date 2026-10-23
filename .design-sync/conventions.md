# SGSPE — convenciones para diseñar con este sistema

SGSPE es el portal de gestión social de proyectos extractivos (comunidades, compromisos, quejas, riesgos, inversión
social). Interfaz en español (es-PE), sobria y densa en datos: dirección «Pino y piedra», neutros de piedra, un único
acento pino, IBM Plex Sans y Mono.

## Raíz obligatoria

Toda composición va dentro de `VistaSgspe`. Sin ella los componentes del portal pierden sus textos (salen claves como
`comun.paso`), el router y los workflows, y `EstadoChip` muestra el código técnico en vez de su etiqueta.

```jsx
<VistaSgspe>            {/* tema="dark" para el oscuro; ruta="/projects/p1" si importa la ruta */}
  <ContenedorDePagina>…</ContenedorDePagina>
</VistaSgspe>
```

## Estilo: clases utilitarias con los tokens `sg-*`

No hay props de estilo: el diseño se arma con clases (Tailwind) sobre los tokens de `_ds/<carpeta>/styles.css`. Lea ese
archivo y `_ds_bundle.css` antes de estilizar: **solo existen las clases compiladas ahí**; una clase inventada o un valor
arbitrario nuevo no se dibuja.

| Familia | Clases reales |
|---|---|
| Fondo | `bg-sg-bg` (página), `bg-sg-surface` (paneles), `bg-sg-surface-sunken`, `hover:bg-sg-surface-hover`, `bg-sg-primary-soft` |
| Texto | `text-sg-text`, `text-sg-text-secondary`, `text-sg-text-muted`, `text-sg-primary-text`, `text-sg-danger` |
| Tono suave | `bg-sg-success-soft`, `bg-sg-warning-soft`, `bg-sg-danger-soft`, `bg-sg-info-soft`; IA: `bg-sg-ai-soft text-sg-ai border-sg-ai-border`; territorio: `bg-sg-territory-soft` |
| Tipografía | `text-sg-h1` `text-sg-h2` `text-sg-h3` `text-sg-body` `text-sg-body-sm` `text-sg-caption` `text-sg-overline` `text-sg-kpi`; `font-sg-mono` para códigos; `tabular-nums` para cifras |
| Bordes y radios | `border border-sg-border`, `border-sg-border-strong`, `rounded-sg-md`, `rounded-sg-lg`; sombra `shadow-sg-sm` |
| Superficies | `Seccion` en lugar de `rounded-sg-lg border … p-4` a mano; nunca una caja dentro de otra (`anidada`, o una `Seccion` dentro de otra) |
| Ritmo | escala de 4 px: `gap-2/3/4`, `p-3/4`, `space-y-2/3/4`; rejillas `grid lg:grid-cols-3` |

## Reglas del producto

- Una sola acción `Button` primaria por contexto; las demás `variant="secondary"` o `"ghost"`, y lo raro o destructivo
  en `MasAcciones`. `variant="danger"` solo para lo irreversible, con `ConfirmDialog`.
- Cabecera de pantalla con `EncabezadoDePagina` (`primaria`, `secundarias`, `mas`, `vistas`; `ficha` + `antetitulo` +
  `chips` en un registro, con dos secundarias a la vista como mucho). Una ficha abre con `PanelDeDecision` (el único lugar
  del estado, con su `camino`) y cierra con `PanelDeTrazabilidad`; sus atributos van en `CamposPlegables`.
- Una lista abre con `BarraDeFiltros` (con `SelectorDeVista` en `vista`) y dibuja sus filas con `TablaPriorizada`
  (columnas `esencial`, `secundaria` u `opcional`); los avisos de un inicio, con `ListaPriorizada`. Las fechas se escriben
  con `CampoFecha` (dd/mm/aaaa, nunca `<input type="date">`), y una sección sin acceso se dice con `EstadoSinAcceso`.
- Estado: `EstadoChip objeto="commitment" estado="in_progress"` (objetos reales: commitment, grievance, inquiry,
  stakeholder_request, agreement, engagement, social_risk, incident, task, social_program, social_contribution, project…);
  plazo: `SituacionDePlazo valor="POR VENCER"`. Nunca solo color.
- Listados tabulares con `TablaPriorizada` o `Table`/`Th`/`Td` (números a la derecha, códigos en mono);
  `ListaEnTarjetas` solo en pantallas pequeñas. Campos de formulario siempre con `Campo` (etiqueta, ayuda y error junto al
  control).
- Estados: `Cargando`, `Vacio` (qué falta y la acción), `ErrorDeCarga`; lo que la persona no puede ver se dice con
  `Restringido`, `Reservado` o `NoDisponible`, nunca en blanco ni en cero; `NotaDeConfidenciales` bajo una cifra que
  excluye confidenciales, sin decir cuántos. Ningún texto muestra códigos del servidor.
- Montos con `Monto` (por moneda, nunca sumados entre monedas), fechas con `Dia`. Datos ficticios: personas por su cargo,
  correos `@sgspe.test`.

## Ejemplo

```jsx
<VistaSgspe>
  <ContenedorDePagina>
    <EncabezadoDePagina titulo="Compromisos" conteo="128 compromisos" primaria={<Button>Nuevo compromiso</Button>} />
    <div className="flex gap-3"><FiltroDeLista etiqueta="Plazo" opciones={[{ valor: 'VENCIDO', etiqueta: 'Vencido' }]} /></div>
    <Table>
      <thead><tr><Th>Código</Th><Th>Compromiso</Th><Th>Estado</Th><Th>Plazo</Th></tr></thead>
      <tbody><tr>
        <Td className="font-sg-mono text-sg-caption">COM-0142</Td><Td>Mejorar el acceso al centro de salud</Td>
        <Td><EstadoChip objeto="commitment" estado="in_progress" /></Td><Td><SituacionDePlazo valor="POR VENCER" /></Td>
      </tr></tbody>
    </Table>
  </ContenedorDePagina>
</VistaSgspe>
```

Cada componente trae su `.prompt.md` (uso y props) en `components/<grupo>/<Nombre>/`.
