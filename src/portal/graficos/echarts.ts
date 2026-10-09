import { BarChart, LineChart, ScatterChart } from 'echarts/charts'
import { AriaComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'

// ECharts 6 por módulos (dashboards.md §9.1): solo los tipos de gráfico que usan los tableros de F2 y el renderizador
// SVG. este módulo baja con la primera pantalla que dibuja un gráfico, nunca con el portal
echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
  AriaComponent,
  SVGRenderer
])

export { echarts }
