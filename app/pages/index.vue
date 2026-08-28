<script setup lang="ts">
import { $fetch as rawFetch } from 'ofetch'
import type { PortfolioSnapshot } from '../../shared/types/domain'

const toast = useToast()
const refreshing = ref(false)
const creating = ref(false)
const startDate = ref('2026-08-28')
const manualPrice = ref('')
const setupData = ref<null | {
  initialized: boolean
  price?: { price: string, date: string, source: string, currentQuote: boolean }
  allocations?: Array<{ account: 'ISA' | 'GIA', amount: string, units: string, price: string }>
}>(null)
const setupError = ref('')

const { data: portfolio, status, error, refresh } = await useFetch<PortfolioSnapshot>('/api/portfolio')
const isReady = computed(() => status.value === 'success' && portfolio.value?.initialized)
const gainTone = computed(() => Number(portfolio.value?.totalGainLoss ?? 0) >= 0 ? 'text-success' : 'text-error')

async function refreshMarket() {
  refreshing.value = true
  try {
    portfolio.value = await $fetch<PortfolioSnapshot>('/api/portfolio', { query: { refresh: 'true' } })
    toast.add({ title: 'Market price refreshed', color: portfolio.value.market?.stale ? 'warning' : 'success' })
  } catch (cause) {
    toast.add({ title: 'Could not refresh market data', description: cause instanceof Error ? cause.message : 'Try again shortly.', color: 'error' })
  } finally {
    refreshing.value = false
  }
}

async function previewSetup() {
  setupError.value = ''
  try {
    const endpoint: string = '/api/setup/preview'
    setupData.value = await rawFetch(endpoint, {
      query: { startDate: startDate.value, ...(manualPrice.value ? { manualPrice: manualPrice.value } : {}) }
    })
  } catch (cause) {
    setupError.value = cause instanceof Error ? cause.message : 'No price could be retrieved.'
  }
}

async function confirmSetup() {
  if (!setupData.value?.price) return
  creating.value = true
  try {
    const endpoint: string = '/api/setup/confirm'
    await rawFetch(endpoint, {
      method: 'POST',
      body: {
        startDate: startDate.value,
        acquisitionPrice: setupData.value.price.price,
        priceSource: setupData.value.price.source,
        usedCurrentQuote: setupData.value.price.currentQuote
      }
    })
    setupData.value = null
    await refresh()
    toast.add({ title: 'Fantasy portfolio created', description: 'The acquisition price and fractional units are now fixed in the ledger.', color: 'success' })
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  const config = useRuntimeConfig()
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && portfolio.value?.initialized) refreshMarket()
  }, Number(portfolio.value?.refreshIntervalMs ?? config.public.refreshIntervalMs))
  onBeforeUnmount(() => window.clearInterval(timer))
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="VUAG · LSE"
      title="Portfolio overview"
      description="A £100,000 fantasy investment in Vanguard S&P 500 UCITS ETF (USD) Accumulating, split across an ISA and a General Investment Account."
    >
      <template #actions>
        <UButton v-if="isReady" color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="refreshing" @click="refreshMarket">
          Refresh
        </UButton>
      </template>
    </PageHeader>

    <div v-if="status === 'pending'" class="space-y-5" aria-label="Loading portfolio">
      <USkeleton class="h-56 w-full rounded-xl" />
      <div class="grid gap-5 lg:grid-cols-3"><USkeleton v-for="n in 3" :key="n" class="h-72 rounded-xl" /></div>
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Portfolio data could not be loaded"
      :description="error.message"
    />

    <div v-else-if="!portfolio?.initialized" class="mx-auto max-w-3xl">
      <UCard :ui="{ body: 'p-5 sm:p-7' }">
        <div class="mb-6 flex items-start gap-4">
          <div class="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <UIcon name="i-lucide-badge-pound-sterling" class="size-5" />
          </div>
          <div>
            <h2 class="text-lg font-semibold">Create the opening acquisition</h2>
            <p class="mt-1 text-sm leading-6 text-muted">Review the VUAG price before committing the £20,000 ISA and £80,000 GIA opening buys. The recorded price and units will never be recalculated later.</p>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Portfolio start date" description="Defaults to 28 August 2026">
            <UInput v-model="startDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Manual price override" description="Optional, GBP per VUAG unit">
            <UInput v-model="manualPrice" type="number" min="0" step="0.000001" placeholder="Use market data" class="w-full" />
          </UFormField>
        </div>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          <UButton icon="i-lucide-search" @click="previewSetup">Retrieve opening price</UButton>
          <span class="text-xs text-muted">Yahoo Finance is queried by the server only.</span>
        </div>
        <UAlert v-if="setupError" class="mt-5" color="error" variant="subtle" title="Opening price unavailable" :description="setupError" />

        <div v-if="setupData?.price && setupData.allocations" class="mt-6 border-t border-default pt-6">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-muted">Price to be recorded</p>
              <p class="numeric mt-1 text-3xl font-semibold">{{ formatGbp(setupData.price.price, 6) }}</p>
              <p class="mt-1 text-xs text-muted">{{ setupData.price.date }} · {{ setupData.price.source }}<span v-if="setupData.price.currentQuote"> · current delayed quote</span></p>
            </div>
            <UBadge color="warning" variant="subtle">Review before creating</UBadge>
          </div>
          <div class="mt-5 grid gap-3 sm:grid-cols-2">
            <div v-for="allocation in setupData.allocations" :key="allocation.account" class="rounded-lg border border-default bg-elevated/50 p-4">
              <p class="text-xs font-semibold text-muted">{{ allocation.account }}</p>
              <p class="numeric mt-1 text-lg font-semibold">{{ formatGbp(allocation.amount) }}</p>
              <p class="numeric mt-1 text-sm text-muted">{{ formatUnits(allocation.units) }} units</p>
            </div>
          </div>
          <UButton class="mt-5" icon="i-lucide-check" :loading="creating" @click="confirmSetup">Create fantasy portfolio</UButton>
        </div>
      </UCard>
    </div>

    <template v-else-if="portfolio">
      <UCard class="relative overflow-hidden" :ui="{ body: 'p-5 sm:p-7' }">
        <div class="absolute right-0 top-0 h-48 w-48 rounded-full bg-primary/5 blur-3xl" aria-hidden="true" />
        <div class="relative grid gap-7 xl:grid-cols-[1.1fr_1fr] xl:items-end">
          <div>
            <div class="flex items-center gap-2 text-sm font-medium text-muted">
              Portfolio value
              <InfoTip text="Current VUAG price multiplied by all units held across the ISA and GIA." />
            </div>
            <div class="numeric mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{{ formatGbp(portfolio.currentValue) }}</div>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <span :class="gainTone" class="numeric flex items-center gap-1 text-sm font-semibold">
                <UIcon :name="Number(portfolio.totalGainLoss) >= 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'" class="size-4" />
                {{ formatGbp(portfolio.totalGainLoss) }} ({{ formatPercent(portfolio.totalGainLossPercent) }}) all time
              </span>
              <span class="text-sm text-muted">Today {{ formatGbp(portfolio.todayChange) }} · {{ formatPercent(portfolio.todayChangePercent) }}</span>
            </div>
            <MarketStatus v-if="portfolio.market" class="mt-5" :quote="portfolio.market" />
          </div>
          <div class="grid grid-cols-2 gap-x-5 sm:grid-cols-3">
            <MetricRow label="Initial investment" :value="formatGbp(portfolio.initialInvestment)" />
            <MetricRow label="Current value" :value="formatGbp(portfolio.currentValue)" />
            <MetricRow label="Gain / loss" :value="formatGbp(portfolio.totalGainLoss)" :tone="Number(portfolio.totalGainLoss) >= 0 ? 'positive' : 'negative'" />
            <MetricRow label="Return" :value="formatPercent(portfolio.totalGainLossPercent)" :tone="Number(portfolio.totalGainLossPercent) >= 0 ? 'positive' : 'negative'" />
            <MetricRow label="Today" :value="formatGbp(portfolio.todayChange)" :tone="Number(portfolio.todayChange) >= 0 ? 'positive' : 'negative'" />
            <MetricRow label="Today %" :value="formatPercent(portfolio.todayChangePercent)" :tone="Number(portfolio.todayChangePercent) >= 0 ? 'positive' : 'negative'" />
          </div>
        </div>
      </UCard>

      <div class="mt-5 grid gap-5 xl:grid-cols-3">
        <UCard v-if="portfolio.isa" :ui="{ body: 'p-5' }">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-muted">Stocks & Shares ISA</p>
              <p class="numeric mt-2 text-2xl font-semibold">{{ formatGbp(portfolio.isa.value) }}</p>
            </div>
            <UBadge color="success" variant="subtle" icon="i-lucide-shield-check">Tax sheltered</UBadge>
          </div>
          <div class="mt-4">
            <MetricRow label="VUAG units" :value="formatUnits(portfolio.isa.units)" />
            <MetricRow label="Average acquisition" :value="formatGbp(portfolio.isa.averageAcquisitionPrice)" />
            <MetricRow label="Gain / loss" :value="formatGbp(portfolio.isa.gainLoss)" :tone="Number(portfolio.isa.gainLoss) >= 0 ? 'positive' : 'negative'" />
            <MetricRow label="Portfolio share" :value="formatPercent(portfolio.isa.portfolioPercent)" />
            <MetricRow label="Tax due" value="£0.00" hint="Gains and income within the ISA are sheltered from UK Income Tax and Capital Gains Tax." />
          </div>
        </UCard>

        <UCard v-if="portfolio.gia" :ui="{ body: 'p-5' }">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-muted">General Investment Account</p>
              <p class="numeric mt-2 text-2xl font-semibold">{{ formatGbp(portfolio.gia.value) }}</p>
            </div>
            <UBadge color="neutral" variant="subtle">Taxable account</UBadge>
          </div>
          <div class="mt-4">
            <MetricRow label="VUAG units" :value="formatUnits(portfolio.gia.units)" />
            <MetricRow label="Section 104 cost" :value="formatGbp(portfolio.gia.originalCost)" hint="The original pooled acquisition cost before ERI adjustments." />
            <MetricRow label="Allowable ERI adjustment" :value="formatGbp(portfolio.gia.eriAdjustment)" hint="Verified ERI already subject to income tax increases the CGT base cost, preventing double taxation." />
            <MetricRow label="Adjusted CGT base" :value="formatGbp(portfolio.gia.adjustedBaseCost)" />
            <MetricRow label="Unrealised gain" :value="formatGbp(portfolio.gia.gainLoss)" :tone="Number(portfolio.gia.gainLoss) >= 0 ? 'positive' : 'negative'" />
            <MetricRow label="Potential CGT" :value="formatGbp(portfolio.unrealisedPotentialTax)" hint="A hypothetical estimate if the full GIA were disposed today. An unrealised gain is not itself a tax bill." />
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-5' }" class="border-primary/25">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-primary">Estimated tax exposure</p>
              <p class="numeric mt-2 text-2xl font-semibold">{{ formatGbp(portfolio.estimatedTaxDueNow) }}</p>
              <p class="mt-1 text-xs text-muted">Estimated tax crystallised so far</p>
            </div>
            <UIcon name="i-lucide-scale" class="size-5 text-primary" />
          </div>
          <div class="mt-4">
            <MetricRow label="Potential CGT" :value="formatGbp(portfolio.unrealisedPotentialTax)" hint="This is potential exposure on a hypothetical disposal, not tax currently due." />
            <MetricRow label="Reportable-income tax" :value="formatGbp(portfolio.incomeTax?.estimatedIncomeTax)" />
            <MetricRow label="Unused CGT exemption" :value="formatGbp(portfolio.unusedCgtExemption)" />
            <MetricRow label="Remaining dividend allowance" :value="formatGbp(portfolio.remainingDividendAllowance)" />
            <MetricRow label="Cash dividends" value="£0.00" hint="VUAG is accumulating; underlying dividends are reinvested inside the fund rather than paid as cash." />
          </div>
          <CalculationDetails title="Show potential CGT calculation">
            <template v-if="portfolio.gia && portfolio.potentialCgt">
              {{ formatGbp(portfolio.gia.value) }} current GIA value − {{ formatGbp(portfolio.gia.adjustedBaseCost) }} adjusted Section 104 base cost = {{ formatGbp(portfolio.potentialCgt.realisedGain) }} hypothetical gain. After {{ formatGbp(portfolio.potentialCgt.annualExemptionUsed) }} annual exemption, {{ formatGbp(portfolio.potentialCgt.taxableGain) }} is potentially taxable at 18%/24% according to the tax profile.
            </template>
          </CalculationDetails>
        </UCard>
      </div>

      <div class="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <UCard :ui="{ body: 'p-5' }">
          <div class="flex items-start gap-3">
            <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-info/10 text-info"><UIcon name="i-lucide-refresh-cw" class="size-4" /></div>
            <div>
              <h2 class="text-sm font-semibold">Accumulating fund treatment</h2>
              <p class="mt-1 text-sm leading-6 text-muted">VUAG pays no ordinary cash dividend into this portfolio. The fund reinvests underlying income, while the GIA may still incur taxable Excess Reportable Income from official reporting-fund data.</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <UBadge color="neutral" variant="subtle">Cash dividends: £0</UBadge>
                <UBadge :color="portfolio.reportableIncomeStatus === 'awaiting' ? 'warning' : 'info'" variant="subtle">
                  {{ portfolio.reportableIncomeStatus === 'awaiting' ? 'Awaiting published ERI data' : `Reportable income: ${formatGbp(portfolio.reportableIncome)}` }}
                </UBadge>
              </div>
            </div>
          </div>
        </UCard>
        <UCard :ui="{ body: 'p-5' }">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted">Instrument</p>
          <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><p class="text-xs text-muted">Ticker</p><p class="mt-1 font-medium">VUAG · VUAG.L</p></div>
            <div><p class="text-xs text-muted">ISIN</p><p class="mt-1 font-medium">IE00BFMXXD54</p></div>
            <div><p class="text-xs text-muted">Currency</p><p class="mt-1 font-medium">GBP</p></div>
            <div><p class="text-xs text-muted">Share class</p><p class="mt-1 font-medium">Accumulating</p></div>
          </div>
        </UCard>
      </div>

      <p class="mt-6 text-xs text-muted">Estimate only — not financial or tax advice. Tax outcomes depend on your wider circumstances and current HMRC rules.</p>
    </template>
  </div>
</template>
