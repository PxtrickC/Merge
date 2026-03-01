import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
} from 'echarts/components'

echarts.use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
])

// Shared tooltip style matching site design
export const TOOLTIP = {
  backgroundColor: 'rgba(10,10,10,0.95)',
  borderColor: '#222',
  borderWidth: 1,
  textStyle: { color: '#ccc', fontFamily: "'HND', sans-serif", fontSize: 12 },
  padding: [8, 12],
}

// Shared dataZoom slider — modern minimal style
export const DATA_ZOOM = [
  {
    type: 'slider',
    bottom: 4,
    height: 20,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.04)',
    fillerColor: 'rgba(255,255,255,0.10)',
    borderRadius: 4,
    handleIcon: 'circle',
    handleSize: '110%',
    handleStyle: {
      color: '#666',
      borderColor: '#666',
      borderWidth: 2,
      shadowBlur: 4,
      shadowColor: 'rgba(0,0,0,0.4)',
    },
    moveHandleSize: 0,
    emphasis: {
      handleStyle: { color: '#999', borderColor: '#999' },
    },
    textStyle: { color: '#666', fontSize: 10, fontFamily: "'HND', sans-serif" },
    dataBackground: {
      lineStyle: { color: 'rgba(255,255,255,0.08)', width: 0.5 },
      areaStyle: { color: 'rgba(255,255,255,0.03)' },
    },
    selectedDataBackground: {
      lineStyle: { color: 'rgba(255,255,255,0.2)', width: 0.5 },
      areaStyle: { color: 'rgba(255,255,255,0.05)' },
    },
    brushSelect: false,
  },
]

// Shared axis styles
export const AXIS_STYLE = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: '#555', fontFamily: "'HND', sans-serif", fontSize: 11 },
  splitLine: { lineStyle: { color: '#1a1a1a' } },
}

// mass.black event: 2022-04-01 ~ 2022-04-30
export const MASS_BLACK_AREA = {
  silent: true,
  data: [[
    { xAxis: '2022-04-01', itemStyle: { color: 'rgba(255,255,255,0.08)' } },
    { xAxis: '2022-04-30' },
  ]],
}

export const MASS_BLACK_LINES = [
  {
    xAxis: '2022-04-01',
    label: { show: false },
    lineStyle: { color: '#333', type: 'dashed', width: 1 },
  },
  {
    xAxis: '2022-04-15',
    label: { formatter: 'mass.black', color: '#fff', fontFamily: "'HND', sans-serif", fontSize: 10, position: 'end' },
    lineStyle: { color: 'transparent' },
  },
  {
    xAxis: '2022-04-30',
    label: { show: false },
    lineStyle: { color: '#333', type: 'dashed', width: 1 },
  },
]

export function useChart(containerRef) {
  let chart = null
  let pendingOption = null
  let resizeHandler = null

  onMounted(() => {
    if (!containerRef.value) return
    chart = echarts.init(containerRef.value, null, { renderer: 'canvas' })
    resizeHandler = () => chart?.resize()
    window.addEventListener('resize', resizeHandler)

    if (pendingOption) {
      chart.setOption(pendingOption)
      pendingOption = null
    }
  })

  onBeforeUnmount(() => {
    if (resizeHandler) window.removeEventListener('resize', resizeHandler)
    chart?.dispose()
    chart = null
  })

  function setOption(option, opts = { notMerge: false }) {
    if (chart) {
      chart.setOption(option, opts)
    } else {
      pendingOption = option
    }
  }

  function getInstance() {
    return chart
  }

  return { setOption, getInstance }
}
