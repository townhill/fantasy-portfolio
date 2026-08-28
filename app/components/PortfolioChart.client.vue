<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { PerformancePoint } from '../../shared/types/domain'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent])

const props = defineProps<{ points: PerformancePoint[] }>()
const colorMode = useColorMode()

const option = computed(() => {
  const dark = colorMode.value === 'dark'
  const text = dark ? '#94a3b8' : '#64748b'
  const grid = dark ? '#1e293b' : '#e2e8f0'
  return {
    animationDuration: 300,
    color: ['#2f9e74', '#3b82f6', '#8b5cf6'],
    grid: { left: 12, right: 12, top: 52, bottom: 28, containLabel: true },
    legend: { top: 2, right: 0, textStyle: { color: text }, icon: 'roundRect', itemWidth: 18, itemHeight: 3 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#0f172a' : '#ffffff',
      borderColor: grid,
      textStyle: { color: dark ? '#f8fafc' : '#0f172a' },
      formatter(params: Array<{ dataIndex: number, marker: string, seriesName: string, value: number }>) {
        const point = props.points[params[0]?.dataIndex ?? 0]
        if (!point) return ''
        return [
          `<strong>${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(`${point.date}T12:00:00Z`))}</strong>`,
          `VUAG price&nbsp;&nbsp;<strong>${formatGbp(point.price, 4)}</strong>`,
          ...params.map(item => `${item.marker}${item.seriesName}&nbsp;&nbsp;<strong>${formatGbp(item.value)}</strong>`)
        ].join('<br/>')
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.points.map(point => point.date),
      axisLine: { lineStyle: { color: grid } },
      axisTick: { show: false },
      axisLabel: { color: text, hideOverlap: true, formatter: (value: string) => value.slice(2, 7) }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: text, formatter: (value: number) => `£${Math.round(value / 1000)}k` },
      splitLine: { lineStyle: { color: grid, type: 'dashed' } }
    },
    series: [
      {
        name: 'Total portfolio',
        type: 'line',
        data: props.points.map(point => Number(point.total)),
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 2.5 },
        areaStyle: { opacity: 0.07 },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { formatter: 'Original £100k', color: text, position: 'insideEndTop' },
          lineStyle: { color: text, type: 'dashed', opacity: 0.65 },
          data: [{ yAxis: 100000 }]
        }
      },
      { name: 'ISA', type: 'line', data: props.points.map(point => Number(point.isa)), showSymbol: false, smooth: false, lineStyle: { width: 1.5 } },
      { name: 'GIA', type: 'line', data: props.points.map(point => Number(point.gia)), showSymbol: false, smooth: false, lineStyle: { width: 1.5 } }
    ]
  }
})
</script>

<template>
  <VChart :option="option" autoresize class="h-[380px] w-full" aria-label="VUAG portfolio performance chart" />
</template>
