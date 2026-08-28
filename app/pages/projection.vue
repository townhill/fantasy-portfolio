<script setup lang="ts">
import { $fetch as rawFetch } from 'ofetch'
import type { ProjectionPoint } from '../../shared/types/domain'

const years = ref<5 | 10 | 15 | 20>(10)
const annualReturn = ref('7')
const returnOptions = ['-5', '0', '3', '5', '7', '10']
const points = ref<ProjectionPoint[]>([])
const busy = ref(false)
const error = ref('')

async function calculate() {
  busy.value = true
  error.value = ''
  try {
    points.value = await rawFetch<ProjectionPoint[]>('/api/projection', { method: 'POST', body: { years: years.value, annualReturnPercent: annualReturn.value } })
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Projection unavailable.' } finally { busy.value = false }
}

onMounted(calculate)
</script>

<template>
  <div>
    <PageHeader eyebrow="Scenario modeller" title="Portfolio projection" description="Explore a hypothetical total-return path and progressive Bed & ISA sheltering. These values are forecasts, never historical VUAG prices." />
    <UCard :ui="{ body: 'p-5 sm:p-6' }">
      <div class="grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <UFormField label="Projection horizon"><div class="flex flex-wrap gap-1 rounded-lg border border-default bg-elevated/40 p-1"><UButton v-for="item in [5, 10, 15, 20]" :key="item" size="sm" :color="years === item ? 'primary' : 'neutral'" :variant="years === item ? 'solid' : 'ghost'" @click="years = item as 5 | 10 | 15 | 20">{{ item }} years</UButton></div></UFormField>
        <UFormField label="Annual total return assumption"><div class="flex flex-wrap gap-1 rounded-lg border border-default bg-elevated/40 p-1"><UButton v-for="item in returnOptions" :key="item" size="sm" :color="annualReturn === item ? 'primary' : 'neutral'" :variant="annualReturn === item ? 'solid' : 'ghost'" @click="annualReturn = item">{{ item }}%</UButton><UInput v-model="annualReturn" type="number" class="w-24" aria-label="Custom annual return" /></div></UFormField>
        <UButton icon="i-lucide-sparkles" :loading="busy" @click="calculate">Model scenario</UButton>
      </div>
    </UCard>

    <UAlert class="mt-5" color="warning" variant="subtle" icon="i-lucide-telescope" title="Forecast data" description="Dashed lines use your return assumption and current tax assumptions for future years. They do not predict VUAG prices or execute future transactions." />
    <UCard class="mt-5" :ui="{ body: 'p-3 sm:p-5' }"><USkeleton v-if="busy && !points.length" class="h-[380px]" /><UAlert v-else-if="error" color="error" variant="subtle" title="Projection unavailable" :description="error" /><ProjectionChart v-else-if="points.length" :points="points" /></UCard>

    <div v-if="points.length" class="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <UCard :ui="{ body: 'p-5' }"><p class="text-xs text-muted">Projected portfolio</p><p class="numeric mt-2 text-xl font-semibold">{{ formatGbp(points.at(-1)?.portfolioValue) }}</p></UCard>
      <UCard :ui="{ body: 'p-5' }"><p class="text-xs text-muted">Projected ISA</p><p class="numeric mt-2 text-xl font-semibold text-info">{{ formatGbp(points.at(-1)?.isaValue) }}</p></UCard>
      <UCard :ui="{ body: 'p-5' }"><p class="text-xs text-muted">Amount sheltered</p><p class="numeric mt-2 text-xl font-semibold text-success">{{ formatGbp(points.at(-1)?.amountSheltered) }}</p></UCard>
      <UCard :ui="{ body: 'p-5' }"><p class="text-xs text-muted">Estimated cumulative tax</p><p class="numeric mt-2 text-xl font-semibold">{{ formatGbp(points.at(-1)?.estimatedCumulativeTax) }}</p></UCard>
    </div>

    <UCard v-if="points.length" class="mt-5" :ui="{ body: 'p-0' }"><div class="overflow-x-auto"><table class="w-full min-w-[720px] text-left text-sm"><thead class="border-b border-default bg-elevated/50 text-xs text-muted"><tr><th class="px-4 py-3 font-medium">Year</th><th class="px-4 py-3 text-right font-medium">Portfolio value</th><th class="px-4 py-3 text-right font-medium">ISA value</th><th class="px-4 py-3 text-right font-medium">GIA value</th><th class="px-4 py-3 text-right font-medium">Cumulative tax</th><th class="px-4 py-3 text-right font-medium">Amount sheltered</th><th class="px-4 py-3 font-medium">Data</th></tr></thead><tbody><tr v-for="point in points" :key="point.year" class="border-b border-default last:border-0"><td class="px-4 py-3 font-medium">{{ point.label }}</td><td class="numeric px-4 py-3 text-right">{{ formatGbp(point.portfolioValue) }}</td><td class="numeric px-4 py-3 text-right">{{ formatGbp(point.isaValue) }}</td><td class="numeric px-4 py-3 text-right">{{ formatGbp(point.giaValue) }}</td><td class="numeric px-4 py-3 text-right">{{ formatGbp(point.estimatedCumulativeTax) }}</td><td class="numeric px-4 py-3 text-right">{{ formatGbp(point.amountSheltered) }}</td><td class="px-4 py-3"><UBadge :color="point.historical ? 'success' : 'warning'" variant="subtle">{{ point.historical ? 'Actual starting point' : 'Forecast' }}</UBadge></td></tr></tbody></table></div></UCard>
  </div>
</template>
