<script setup lang="ts">
import type { PerformancePoint, PortfolioSnapshot } from '../../shared/types/domain'

const ranges = ['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'ALL'] as const
const range = ref<(typeof ranges)[number]>('ALL')
const { data: portfolio } = await useFetch<PortfolioSnapshot>('/api/portfolio')
const { data: points, status, error, refresh } = await useFetch<PerformancePoint[]>('/api/performance', { query: { range } })
watch(range, () => refresh())

const periodChange = computed(() => {
  const values = points.value ?? []
  if (values.length < 2) return { amount: '0', percent: '0' }
  const first = Number(values[0]?.total ?? 0)
  const last = Number(values.at(-1)?.total ?? 0)
  return { amount: String(last - first), percent: first ? String(((last - first) / first) * 100) : '0' }
})
</script>

<template>
  <div>
    <PageHeader title="Performance" description="Actual VUAG.L historical closes applied to the units held in each account. Forecast prices are never mixed into this chart." eyebrow="Historical market data" />

    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-1 rounded-lg border border-default bg-elevated/50 p-1" aria-label="Chart range">
        <UButton v-for="item in ranges" :key="item" size="sm" :color="range === item ? 'primary' : 'neutral'" :variant="range === item ? 'solid' : 'ghost'" @click="range = item">{{ item }}</UButton>
      </div>
      <div v-if="points?.length" class="text-right">
        <p class="text-xs text-muted">Period change</p>
        <p class="numeric text-sm font-semibold" :class="Number(periodChange.amount) >= 0 ? 'text-success' : 'text-error'">{{ formatGbp(periodChange.amount) }} · {{ formatPercent(periodChange.percent) }}</p>
      </div>
    </div>

    <UCard :ui="{ body: 'p-3 sm:p-5' }">
      <USkeleton v-if="status === 'pending'" class="h-[380px] w-full" />
      <UAlert v-else-if="error" color="error" variant="subtle" title="Historical prices unavailable" :description="error.message" />
      <div v-else-if="!points?.length" class="grid min-h-[320px] place-items-center text-center">
        <div><UIcon name="i-lucide-chart-no-axes-combined" class="mx-auto size-8 text-dimmed" /><p class="mt-3 font-medium">No historical points yet</p><p class="mt-1 text-sm text-muted">Initialize the portfolio or try a wider date range.</p></div>
      </div>
      <PortfolioChart v-else :points="points" />
    </UCard>

    <div class="mt-5 grid gap-5 md:grid-cols-3">
      <UCard :ui="{ body: 'p-5' }"><p class="text-xs text-muted">Current portfolio</p><p class="numeric mt-2 text-xl font-semibold">{{ formatGbp(portfolio?.currentValue) }}</p></UCard>
      <UCard :ui="{ body: 'p-5' }"><p class="text-xs text-muted">VUAG market price</p><p class="numeric mt-2 text-xl font-semibold">{{ formatGbp(portfolio?.market?.price, 4) }}</p></UCard>
      <UCard :ui="{ body: 'p-5' }"><p class="text-xs text-muted">Data points</p><p class="numeric mt-2 text-xl font-semibold">{{ points?.length ?? 0 }}</p></UCard>
    </div>
  </div>
</template>
