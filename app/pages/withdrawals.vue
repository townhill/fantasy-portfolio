<script setup lang="ts">
import { $fetch as rawFetch } from 'ofetch'
import type { InvestmentAccountType, PortfolioSnapshot, WithdrawalPreview } from '../../shared/types/domain'

const toast = useToast()
const source = ref<InvestmentAccountType>('ISA')
const amount = ref('1000.00')
const confirmed = ref(false)
const previewing = ref(false)
const applying = ref(false)
const preview = ref<WithdrawalPreview | null>(null)
const previewError = ref('')
const takeOut = reactive({ amount: '', note: '', confirmed: false })
const takingOut = ref(false)
const { data: portfolio, status, error, refresh: refreshPortfolio } = await useFetch<PortfolioSnapshot>('/api/portfolio')

const sourceValue = computed(() => source.value === 'ISA' ? portfolio.value?.isa?.value : portfolio.value?.gia?.value)
// Only the preview on screen can be applied, so it must match the amount and account currently selected.
const previewIsCurrent = computed(() => {
  const value = moneyInput(amount.value)
  return !!preview.value && value !== null && preview.value.account === source.value && Number(value) === Number(preview.value.proceeds)
})
let latestPreviewRequest = 0
const sources = [
  { value: 'ISA' as const, label: 'ISA', detail: 'Tax-free' },
  { value: 'GIA' as const, label: 'GIA', detail: 'May incur CGT' }
]

async function calculate() {
  const request = ++latestPreviewRequest
  previewError.value = ''
  const value = moneyInput(amount.value)
  if (!value) {
    preview.value = null
    previewError.value = 'Enter an amount in pounds and pence, for example 1500.00.'
    return
  }
  previewing.value = true
  try {
    const result = await rawFetch<WithdrawalPreview>('/api/withdrawals/preview', { method: 'POST', body: { amount: value, account: source.value } })
    if (request === latestPreviewRequest) preview.value = result
  } catch (cause) {
    if (request !== latestPreviewRequest) return
    preview.value = null
    previewError.value = errorMessage(cause, 'Check the amount and try again.')
  } finally {
    if (request === latestPreviewRequest) previewing.value = false
  }
}

async function applyWithdrawal() {
  const previewed = preview.value
  if (!confirmed.value || !previewed || !previewIsCurrent.value) return
  applying.value = true
  try {
    await rawFetch('/api/withdrawals/apply', { method: 'POST', body: { amount: previewed.proceeds, account: previewed.account, confirmation: true } })
    confirmed.value = false
    await refreshPortfolio()
    await calculate()
    toast.add({ title: 'Withdrawn to cash', description: `The ${previewed.account} sale and cash deposit were added to the ledger.`, color: 'success' })
  } catch (cause) {
    toast.add({ title: 'Withdrawal could not be applied', description: errorMessage(cause, 'Try again.'), color: 'error' })
  } finally { applying.value = false }
}

async function takeOutCash() {
  if (!takeOut.confirmed) return
  const value = moneyInput(takeOut.amount)
  if (!value) {
    toast.add({ title: 'Check the amount', description: 'Enter an amount in pounds and pence, for example 1500.00.', color: 'error' })
    return
  }
  takingOut.value = true
  try {
    await rawFetch('/api/cash/take-out', { method: 'POST', body: { amount: value, note: takeOut.note, confirmation: true } })
    Object.assign(takeOut, { amount: '', note: '', confirmed: false })
    await refreshPortfolio()
    if (preview.value) await calculate()
    toast.add({ title: 'Cash taken out', description: 'The cash withdrawal was added to the ledger.', color: 'success' })
  } catch (cause) {
    toast.add({ title: 'Cash could not be taken out', description: errorMessage(cause, 'Try again.'), color: 'error' })
  } finally { takingOut.value = false }
}

// Number inputs hand back numbers once edited, while the API expects pounds and pence as a string.
function moneyInput(value: string | number) {
  const text = String(value ?? '').trim()
  return /^\d+(\.\d{1,2})?$/.test(text) ? text : null
}

function errorMessage(cause: unknown, fallback: string) {
  const data = (cause as { data?: { statusMessage?: string } })?.data
  return data?.statusMessage ?? (cause instanceof Error ? cause.message : fallback)
}

watch(source, () => {
  confirmed.value = false
  calculate()
})
watch(amount, () => { confirmed.value = false })
onMounted(() => { if (portfolio.value?.initialized) calculate() })
</script>

<template>
  <div>
    <PageHeader eyebrow="Living on the portfolio" title="Withdrawals & cash" description="Sell VUAG into a cash account that earns interest, then take cash out to live on. Selling inside the ISA is tax-free; selling in the GIA crystallises a gain for CGT." />

    <USkeleton v-if="status === 'pending'" class="h-96 w-full" />
    <UAlert v-else-if="error" color="error" variant="subtle" title="Portfolio data could not be loaded" :description="error.message" />
    <UAlert v-else-if="!portfolio?.initialized" color="neutral" variant="subtle" icon="i-lucide-info" title="Create the portfolio first" description="Withdrawals become available after the opening acquisition is confirmed on the Dashboard." />

    <template v-else>
      <div class="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <UCard :ui="{ body: 'p-5 sm:p-6' }">
          <h2 class="text-base font-semibold">Withdraw to cash</h2>
          <p class="mt-1 text-sm leading-6 text-muted">Sales use the current VUAG price and are dated today.</p>
          <div class="mt-5 space-y-4">
            <UFormField label="Sell from">
              <div class="grid grid-cols-2 gap-1 rounded-lg border border-default bg-elevated/40 p-1">
                <UButton v-for="item in sources" :key="item.value" block size="sm" :color="source === item.value ? 'primary' : 'neutral'" :variant="source === item.value ? 'solid' : 'ghost'" @click="source = item.value">
                  {{ item.label }} · {{ item.detail }}
                </UButton>
              </div>
            </UFormField>
            <UFormField label="Amount to withdraw" :description="`Up to ${formatGbp(sourceValue)} available in the ${source}`">
              <UInput v-model="amount" type="number" min="0" step="0.01" icon="i-lucide-pound-sterling" class="w-full" />
            </UFormField>
            <UButton block icon="i-lucide-calculator" :loading="previewing" @click="calculate">Update preview</UButton>
          </div>
          <UAlert v-if="source === 'ISA'" class="mt-5" color="info" variant="subtle" icon="i-lucide-shield-check" title="ISA withdrawals are tax-free" description="Taking money out of the ISA does not give back this tax year's ISA allowance, so it cannot be paid back in later without using allowance." />
          <UAlert v-else class="mt-5" color="warning" variant="subtle" icon="i-lucide-triangle-alert" title="GIA withdrawals are disposals for CGT" description="The sale uses the pooled Section 104 cost and counts towards this tax year's gains and annual exemption." />
        </UCard>

        <UCard :ui="{ body: 'p-5 sm:p-6' }">
          <div class="flex items-start justify-between gap-3">
            <div><p class="text-xs font-semibold uppercase tracking-wider text-primary">Withdrawal preview</p><p class="numeric mt-2 text-3xl font-semibold">{{ formatGbp(preview?.proceeds) }}</p></div>
            <div class="flex flex-wrap justify-end gap-2">
              <UBadge v-if="preview?.manualPrice" color="warning" variant="subtle">Manual price</UBadge>
              <UBadge v-if="preview?.priceStale" color="warning" variant="subtle">Stale price</UBadge>
              <UBadge v-if="preview?.account === 'GIA' && preview.rulesAssumed" color="warning" variant="subtle">Projection using current tax assumptions</UBadge>
            </div>
          </div>
          <UAlert v-if="previewError" class="mt-4" color="error" variant="subtle" title="Preview unavailable" :description="previewError" />
          <div class="mt-4 grid gap-x-6 md:grid-cols-2">
            <MetricRow :label="`${source} value now`" :value="formatGbp(preview?.accountValue ?? sourceValue)" />
            <MetricRow label="VUAG price" :value="formatGbp(preview?.price, 4)" />
            <MetricRow label="Units sold" :value="formatUnits(preview?.unitsToSell)" />
            <MetricRow label="Allocated cost" :value="formatGbp(preview?.allocatedCost)" :hint="source === 'GIA' ? 'Proportion of the Section 104 pool cost, including verified ERI adjustments.' : 'Proportion of the ISA acquisition cost.'" />
            <MetricRow :label="source === 'ISA' ? 'Gain (sheltered)' : 'Gain crystallised'" :value="formatGbp(preview?.gain)" :tone="Number(preview?.gain ?? 0) >= 0 ? 'positive' : 'negative'" />
            <MetricRow label="Estimated CGT" :value="formatGbp(preview?.estimatedCgt)" :hint="source === 'ISA' ? 'Gains inside the ISA are not subject to CGT.' : 'The increase in this tax year\'s estimated CGT, after earlier disposals and your wider-income profile.'" />
            <MetricRow v-if="preview?.cgtAnnualExemptionRemaining !== null && preview?.cgtAnnualExemptionRemaining !== undefined" label="CGT exemption left after sale" :value="formatGbp(preview.cgtAnnualExemptionRemaining)" />
            <MetricRow :label="`${source} value after`" :value="formatGbp(preview?.accountValueAfter)" />
            <MetricRow label="Cash balance after" :value="formatGbp(preview?.cashBalanceAfter)" />
          </div>
          <CalculationDetails v-if="preview" title="Show sale workings">
            {{ formatGbp(preview.proceeds) }} ÷ {{ formatGbp(preview.price, 4) }} = {{ formatUnits(preview.unitsToSell) }} units sold{{ preview.sellsEntireHolding ? ' (the whole holding)' : '' }}. {{ formatGbp(preview.proceeds) }} proceeds − {{ formatGbp(preview.allocatedCost) }} allocated cost = {{ formatGbp(preview.gain) }} gain.
            <template v-if="preview.account === 'GIA'"> The estimated CGT is the change in this tax year's total once this gain is added to earlier disposals.</template>
            <template v-else> The gain stays inside the ISA wrapper, so no CGT is due.</template>
          </CalculationDetails>
          <div class="mt-5 border-t border-default pt-5">
            <UCheckbox v-model="confirmed" :label="`I understand this records a fantasy ${source} sale and moves the proceeds to the cash account`" />
            <p v-if="preview && !previewIsCurrent" class="mt-3 text-xs text-warning">The amount or account has changed since this preview. Select Update preview before withdrawing.</p>
            <UButton class="mt-4" color="primary" icon="i-lucide-banknote-arrow-down" :disabled="!confirmed || !previewIsCurrent" :loading="applying" @click="applyWithdrawal">Withdraw to cash</UButton>
          </div>
        </UCard>
      </div>

      <UCard class="mt-5" :ui="{ body: 'p-5 sm:p-6' }">
        <div class="grid gap-8 lg:grid-cols-2">
          <div>
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-muted">Cash account</p>
                <p class="numeric mt-2 text-3xl font-semibold">{{ formatGbp(portfolio.cash?.balance) }}</p>
              </div>
              <UBadge color="info" variant="subtle" icon="i-lucide-percent">{{ portfolio.cash?.interestRatePercent }}% a year</UBadge>
            </div>
            <div class="mt-4">
              <MetricRow label="Interest accrued this month" :value="formatGbp(portfolio.cash?.accruedInterest)" hint="Interest accrues daily on the closing balance and is paid into the account on the last day of each month." />
              <MetricRow :label="`Interest paid in ${portfolio.taxYear}`" :value="formatGbp(portfolio.cash?.interestThisTaxYear)" />
              <MetricRow label="Total interest paid" :value="formatGbp(portfolio.cash?.totalInterest)" />
              <MetricRow label="Cash taken out to date" :value="formatGbp(portfolio.cash?.totalTakenOut)" />
            </div>
            <p class="mt-4 text-xs leading-5 text-muted">Change the interest rate in Settings. Interest on cash held outside an ISA is taxable savings income; it is shown on the Tax page but not included in the tax estimates.</p>
          </div>

          <div class="lg:border-l lg:border-default lg:pl-8">
            <h2 class="text-base font-semibold">Take out cash to live on</h2>
            <p class="mt-1 text-sm leading-6 text-muted">Records money leaving the portfolio. It still counts towards the all-time gain on the Dashboard.</p>
            <div class="mt-5 space-y-4">
              <UFormField label="Amount" :description="`Up to ${formatGbp(portfolio.cash?.balance)} available`">
                <UInput v-model="takeOut.amount" type="number" min="0" step="0.01" icon="i-lucide-pound-sterling" class="w-full" />
              </UFormField>
              <UFormField label="Note" description="Optional, for example the month it covers">
                <UInput v-model="takeOut.note" maxlength="200" class="w-full" />
              </UFormField>
              <UCheckbox v-model="takeOut.confirmed" label="I understand this records cash leaving the fantasy portfolio" />
              <UButton icon="i-lucide-wallet" :disabled="!takeOut.confirmed || !takeOut.amount || Number(portfolio.cash?.balance ?? 0) <= 0" :loading="takingOut" @click="takeOutCash">Take out cash</UButton>
            </div>
          </div>
        </div>
      </UCard>

      <p class="mt-4 text-xs text-muted">Linked sale and cash-deposit entries share a group identifier on the Transactions page. Estimate only — not financial or tax advice.</p>
    </template>
  </div>
</template>
