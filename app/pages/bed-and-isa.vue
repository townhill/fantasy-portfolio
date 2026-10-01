<script setup lang="ts">
import { $fetch as rawFetch } from 'ofetch'
import type { BedIsaPreview, PortfolioSnapshot, ProjectionPoint } from '../../shared/types/domain'

const toast = useToast()
const amount = ref('20000.00')
const date = ref(new Date().toISOString().slice(0, 10))
const confirmed = ref(false)
const busy = ref(false)
const preview = ref<BedIsaPreview | null>(null)
const previewedInput = ref<{ amount: string, date: string } | null>(null)
// Only the transfer on screen can be applied, so the inputs must still match what was previewed.
const previewIsCurrent = computed(() => {
  const value = moneyInput(amount.value)
  return !!preview.value && !!previewedInput.value && value !== null
    && Number(value) === Number(previewedInput.value.amount) && date.value === previewedInput.value.date
})
const { data: portfolio, refresh: refreshPortfolio } = await useFetch<PortfolioSnapshot>('/api/portfolio')
const { data: projection } = await useFetch<ProjectionPoint[]>('/api/projection', { method: 'POST', body: { years: 10, annualReturnPercent: '7' } })

async function calculate() {
  const value = moneyInput(amount.value)
  if (!value) {
    toast.add({ title: 'Check the transfer amount', description: 'Enter an amount in pounds and pence, for example 20000.00.', color: 'error' })
    return
  }
  busy.value = true
  try {
    const input = { amount: value, date: date.value }
    preview.value = await rawFetch<BedIsaPreview>('/api/bed-isa/preview', { method: 'POST', body: input })
    previewedInput.value = input
  } catch (cause) {
    toast.add({ title: 'Preview unavailable', description: cause instanceof Error ? cause.message : 'Check the inputs.', color: 'error' })
  } finally { busy.value = false }
}

async function applyTransfer() {
  const previewed = previewedInput.value
  if (!confirmed.value || !previewed || !previewIsCurrent.value) return
  busy.value = true
  try {
    await rawFetch('/api/bed-isa/apply', { method: 'POST', body: { ...previewed, confirmation: true } })
    confirmed.value = false
    await refreshPortfolio()
    await calculate()
    toast.add({ title: 'Bed & ISA recorded', description: 'The linked GIA disposal and ISA acquisition were added to the audit ledger.', color: 'success' })
  } catch (cause) {
    toast.add({ title: 'Transfer could not be applied', description: cause instanceof Error ? cause.message : 'Try again.', color: 'error' })
  } finally { busy.value = false }
}

// Number inputs hand back numbers once edited, while the API expects pounds and pence as a string.
function moneyInput(value: string | number) {
  const text = String(value ?? '').trim()
  return /^\d+(\.\d{1,2})?$/.test(text) ? text : null
}

watch([amount, date], () => { confirmed.value = false })
onMounted(calculate)
</script>

<template>
  <div>
    <PageHeader eyebrow="Tax-year planning" title="Bed & ISA planner" description="Preview a real GIA disposal and linked ISA acquisition. The sale crystallises a gain; the ISA purchase creates a separate sheltered acquisition lot." />

    <div class="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <UCard :ui="{ body: 'p-5 sm:p-6' }">
        <h2 class="text-base font-semibold">Transfer assumptions</h2>
        <p class="mt-1 text-sm leading-6 text-muted">The available allowance is reduced by ISA allowance used elsewhere in Settings.</p>
        <div class="mt-5 space-y-4">
          <UFormField label="Transfer amount" description="Maximum defaults to the remaining annual ISA allowance">
            <UInput v-model="amount" type="number" min="0" step="0.01" icon="i-lucide-pound-sterling" class="w-full" />
          </UFormField>
          <UFormField label="Transaction date">
            <UInput v-model="date" type="date" class="w-full" />
          </UFormField>
          <UButton block icon="i-lucide-calculator" :loading="busy" @click="calculate">Update preview</UButton>
        </div>
        <UAlert class="mt-5" color="warning" variant="subtle" icon="i-lucide-triangle-alert" title="Nothing executes automatically" description="Future transfers in the projection are illustrative. Only the confirmed transaction below changes the fantasy ledger." />
      </UCard>

      <UCard :ui="{ body: 'p-5 sm:p-6' }">
        <div class="flex items-start justify-between gap-3">
          <div><p class="text-xs font-semibold uppercase tracking-wider text-primary">Transaction preview</p><p class="numeric mt-2 text-3xl font-semibold">{{ formatGbp(preview?.suggestedAmount) }}</p></div>
          <UBadge v-if="preview?.rulesAssumed" color="warning" variant="subtle">Projection using current tax assumptions</UBadge>
          <UBadge v-else color="success" variant="subtle">Configured {{ portfolio?.taxYear }} rules</UBadge>
        </div>
        <div class="mt-4 grid gap-x-6 md:grid-cols-2">
          <MetricRow label="Current GIA value" :value="formatGbp(preview?.currentGiaValue)" />
          <MetricRow label="Available ISA allowance" :value="formatGbp(preview?.availableIsaAllowance)" />
          <MetricRow label="Units sold / bought" :value="formatUnits(preview?.unitsToSell)" />
          <MetricRow label="Gain crystallised" :value="formatGbp(preview?.estimatedGain)" :tone="Number(preview?.estimatedGain) >= 0 ? 'positive' : 'negative'" />
          <MetricRow label="CGT exemption remaining" :value="formatGbp(preview?.cgtAnnualExemptionRemaining)" />
          <MetricRow label="Estimated CGT" :value="formatGbp(preview?.estimatedCgt)" hint="Estimated on the GIA disposal only, using your wider-income profile." />
          <MetricRow label="ISA value after" :value="formatGbp(preview?.isaValueAfter)" />
          <MetricRow label="GIA value after" :value="formatGbp(preview?.giaValueAfter)" />
        </div>
        <CalculationDetails v-if="preview" title="Show gain and tax workings">
          {{ formatGbp(preview.suggestedAmount) }} disposal proceeds − allocated adjusted Section 104 cost = {{ formatGbp(preview.cgt.realisedGain) }} gain. The calculation uses {{ formatGbp(preview.cgt.annualExemptionUsed) }} of the remaining exemption; {{ formatGbp(preview.cgt.basicRateGain) }} is tested at 18% and {{ formatGbp(preview.cgt.higherRateGain) }} at 24%.
        </CalculationDetails>
        <div class="mt-5 border-t border-default pt-5">
          <UCheckbox v-model="confirmed" label="I understand this records a fantasy GIA disposal and ISA acquisition" />
          <p v-if="preview && !previewIsCurrent" class="mt-3 text-xs text-warning">The amount or date has changed since this preview. Select Update preview before applying.</p>
          <UButton class="mt-4" color="primary" icon="i-lucide-arrow-left-right" :disabled="!confirmed || !previewIsCurrent" :loading="busy" @click="applyTransfer">Apply to fantasy portfolio</UButton>
        </div>
      </UCard>
    </div>

    <UCard class="mt-5" :ui="{ body: 'p-5 sm:p-6' }">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 class="text-base font-semibold">Ten-year sheltering path</h2><p class="mt-1 text-sm text-muted">Illustrative 7% annual return with an annual transfer using current allowance assumptions.</p></div><UBadge color="warning" variant="subtle">Forecast · not executed</UBadge></div>
      <div class="mt-5 overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-default text-xs text-muted"><tr><th class="pb-3 font-medium">Year</th><th class="pb-3 text-right font-medium">Portfolio</th><th class="pb-3 text-right font-medium">ISA</th><th class="pb-3 text-right font-medium">GIA</th><th class="pb-3 text-right font-medium">Cash</th><th class="pb-3 text-right font-medium">Sheltered</th><th class="pb-3 text-right font-medium">Cumulative tax</th></tr></thead>
          <tbody><tr v-for="point in projection" :key="point.year" class="border-b border-default last:border-0"><td class="py-3 font-medium">{{ point.label }}</td><td class="numeric py-3 text-right">{{ formatGbp(point.portfolioValue) }}</td><td class="numeric py-3 text-right text-info">{{ formatGbp(point.isaValue) }}</td><td class="numeric py-3 text-right">{{ formatGbp(point.giaValue) }}</td><td class="numeric py-3 text-right">{{ formatGbp(point.cashValue) }}</td><td class="numeric py-3 text-right text-success">{{ formatGbp(point.amountSheltered) }}</td><td class="numeric py-3 text-right">{{ formatGbp(point.estimatedCumulativeTax) }}</td></tr></tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
