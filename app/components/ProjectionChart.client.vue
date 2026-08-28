<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { ProjectionPoint } from '../../shared/types/domain'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, TooltipComponent])

const props = defineProps<{ points: ProjectionPoint[] }>()
const colorMode = useColorMode()
const option = computed(() => {
  const dark = colorMode.value === 'dark'
  const text = dark ? '#94a3b8' : '#64748b'
  const grid = dark ? '#1e293b' : '#e2e8f0'
  return {
    color: ['#2f9e74', '#3b82f6', '#8b5cf6', '#ef4444'],
    grid: { left: 12, right: 12, top: 50, bottom: 26, containLabel: true },
    legend: { top: 2, right: 0, textStyle: { color: text }, icon: 'roundRect', itemWidth: 18, itemHeight: 3 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#0f172a' : '#fff',
      borderColor: grid,
      textStyle: { color: dark ? '#f8fafc' : '#0f172a' },
      valueFormatter: (value: number) => formatGbp(value)
    },
    xAxis: { type: 'category', data: props.points.map(point => point.label), axisTick: { show: false }, axisLine: { lineStyle: { color: grid } }, axisLabel: { color: text } },
    yAxis: { type: 'value', axisLabel: { color: text, formatter: (value: number) => `£${Math.round(value / 1000)}k` }, splitLine: { lineStyle: { color: grid, type: 'dashed' } } },
    series: [
      { name: 'Portfolio', type: 'line', data: props.points.map(point => Number(point.portfolioValue)), showSymbol: true, symbolSize: 5, lineStyle: { width: 2.5, type: 'dashed' } },
      { name: 'ISA', type: 'line', data: props.points.map(point => Number(point.isaValue)), showSymbol: false, lineStyle: { type: 'dashed' } },
      { name: 'GIA', type: 'line', data: props.points.map(point => Number(point.giaValue)), showSymbol: false, lineStyle: { type: 'dashed' } },
      { name: 'Cumulative tax', type: 'line', data: props.points.map(point => Number(point.estimatedCumulativeTax)), showSymbol: false, lineStyle: { type: 'dotted' } }
    ]
  }
})
</script>

<template>
  <VChart :option="option" autoresize class="h-[380px] w-full" aria-label="Forecast portfolio projection chart" />
</template>
