<script setup lang="ts">
import { $fetch as rawFetch } from 'ofetch'

interface TaxYearSummary {
  taxYear: string
  confirmedRules: boolean
  sourceNote: string
  giaDisposals: number
  disposalProceeds: string
  realisedGains: string
  capitalLosses: string
  netGain: string
  annualExemptionUsed: string
  taxableCapitalGain: string
  estimatedCgt: string
  vuagEri: string
  otherReportableIncome: string
  dividendAllowanceUsed: string
  estimatedIncomeTax: string
  totalEstimatedTax: string
  cashInterest: string
  cgt: Record<string, string>
  income: Record<string, string>
}

interface EriRecord {
  id: number
  reportingPeriodStart: string
  reportingPeriodEnd: string
  fundDistributionDate: string
  eriPerUnit: string
  currency: string
  source: string
  sourceDocument: string
  verified: boolean
  notes: string
  applicableUnits: string
  totalAmount: string
}

const toast = useToast()
const showForm = ref(false)
const saving = ref(false)
const { data, status, error, refresh } = await useFetch<{ years: TaxYearSummary[], eriRecords: EriRecord[] }>('/api/tax')
const form = reactive({
  reportingPeriodStart: '2025-07-01',
  reportingPeriodEnd: '2026-06-30',
  fundDistributionDate: '2026-12-31',
  eriPerUnit: '',
  currency: 'GBP',
  source: 'Vanguard official reporting-fund documentation',
  sourceDocument: '',
  verified: true,
  notes: ''
})

async function saveEri() {
  saving.value = true
  try {
    await rawFetch('/api/eri', { method: 'POST', body: form })
    await refresh()
    showForm.value = false
    toast.add({ title: 'ERI record saved', description: form.verified ? 'The verified non-cash income was added to the GIA base cost.' : 'The unverified record is stored but not applied.', color: 'success' })
  } catch (cause) {
    toast.add({ title: 'ERI record could not be saved', description: cause instanceof Error ? cause.message : 'Check every field.', color: 'error' })
  } finally { saving.value = false }
}
</script>

<template>
  <div>
    <PageHeader eyebrow="UK tax estimate" title="Tax by tax year" description="Crystallised GIA disposals and verified non-cash reportable income, grouped from 6 April to 5 April. This is not an HMRC tax-return calculation.">
      <template #actions><UButton icon="i-lucide-plus" @click="showForm = !showForm">Add ERI record</UButton></template>
    </PageHeader>

    <UAlert class="mb-5" color="warning" variant="subtle" icon="i-lucide-info" title="Estimate only — not financial or tax advice" description="CGT rates depend on wider taxable income. Verify tax rules and Vanguard reporting-fund documents before relying on these figures." />

    <UCard v-if="showForm" class="mb-5" :ui="{ body: 'p-5 sm:p-6' }">
      <div class="flex items-start justify-between"><div><h2 class="font-semibold">Record Excess Reportable Income</h2><p class="mt-1 text-sm text-muted">Enter only data from an official source. No dividend-yield estimate is substituted.</p></div><UButton color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Close form" @click="showForm = false" /></div>
      <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UFormField label="Reporting period start"><UInput v-model="form.reportingPeriodStart" type="date" class="w-full" /></UFormField>
        <UFormField label="Reporting period end"><UInput v-model="form.reportingPeriodEnd" type="date" class="w-full" /></UFormField>
        <UFormField label="Fund distribution date"><UInput v-model="form.fundDistributionDate" type="date" class="w-full" /></UFormField>
        <UFormField label="ERI per unit" description="GBP per VUAG unit"><UInput v-model="form.eriPerUnit" type="number" min="0" step="0.00000001" class="w-full" /></UFormField>
        <UFormField label="Currency"><UInput v-model="form.currency" maxlength="3" class="w-full" disabled /></UFormField>
        <UFormField label="Official source"><UInput v-model="form.source" class="w-full" /></UFormField>
        <UFormField class="sm:col-span-2" label="Source document or URL"><UInput v-model="form.sourceDocument" placeholder="Document title or official URL" class="w-full" /></UFormField>
        <UFormField label="Notes"><UInput v-model="form.notes" class="w-full" /></UFormField>
      </div>
      <div class="mt-5 flex flex-wrap items-center gap-4"><UCheckbox v-model="form.verified" label="Verified against the official document" /><UButton :loading="saving" icon="i-lucide-save" @click="saveEri">Save ERI record</UButton></div>
    </UCard>

    <USkeleton v-if="status === 'pending'" class="h-72 w-full" />
    <UAlert v-else-if="error" color="error" variant="subtle" title="Tax data unavailable" :description="error.message" />
    <div v-else class="space-y-5">
      <details v-for="(year, index) in data?.years" :key="year.taxYear" class="group rounded-xl border border-default bg-default" :open="index === 0">
        <summary class="flex cursor-pointer list-none flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3"><div class="grid size-10 place-items-center rounded-lg bg-elevated font-semibold">{{ year.taxYear.slice(2, 4) }}</div><div><h2 class="font-semibold">{{ year.taxYear }} tax year</h2><p class="mt-0.5 text-xs text-muted">{{ year.giaDisposals }} GIA disposal{{ year.giaDisposals === 1 ? '' : 's' }} · {{ year.confirmedRules ? 'Configured rules' : 'Projected assumptions' }}</p></div></div>
          <div class="flex items-center gap-4"><div class="text-right"><p class="text-xs text-muted">Estimated portfolio tax</p><p class="numeric mt-1 text-lg font-semibold">{{ formatGbp(year.totalEstimatedTax) }}</p></div><UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition-transform group-open:rotate-180" /></div>
        </summary>
        <div class="border-t border-default p-5">
          <UBadge v-if="!year.confirmedRules" class="mb-4" color="warning" variant="subtle">Projection using current tax assumptions</UBadge>
          <div class="grid gap-6 lg:grid-cols-2">
            <div><h3 class="text-sm font-semibold">Capital gains</h3><div class="mt-2"><MetricRow label="GIA disposal proceeds" :value="formatGbp(year.disposalProceeds)" /><MetricRow label="Realised gains" :value="formatGbp(year.realisedGains)" /><MetricRow label="Capital losses" :value="formatGbp(year.capitalLosses)" /><MetricRow label="Net gain" :value="formatGbp(year.netGain)" /><MetricRow label="Annual exemption used" :value="formatGbp(year.annualExemptionUsed)" /><MetricRow label="Taxable capital gain" :value="formatGbp(year.taxableCapitalGain)" /><MetricRow label="Estimated CGT" :value="formatGbp(year.estimatedCgt)" /></div></div>
            <div><h3 class="text-sm font-semibold">Reportable income</h3><div class="mt-2"><MetricRow label="VUAG ERI" :value="formatGbp(year.vuagEri)" hint="Verified Excess Reportable Income only; this is non-cash income for the accumulating fund." /><MetricRow label="Other dividend income" :value="formatGbp(year.otherReportableIncome)" /><MetricRow label="Dividend allowance used" :value="formatGbp(year.dividendAllowanceUsed)" /><MetricRow label="Estimated income tax" :value="formatGbp(year.estimatedIncomeTax)" /><MetricRow label="Cash VUAG dividends" value="£0.00" /><MetricRow label="Cash account interest" :value="formatGbp(year.cashInterest)" hint="Interest paid on the cash account. It is taxable savings income outside an ISA, usually covered first by the Personal Savings Allowance, and is not included in these estimates." /></div></div>
          </div>
          <CalculationDetails title="Show tax-engine workings">The CGT engine deducts entered capital losses and the available annual exemption, then applies 18% within the remaining basic-rate band and 24% above it. Verified ERI is treated as potentially taxable reportable income, uses the available dividend allowance, and is also added to the GIA base cost to prevent double taxation. {{ year.sourceNote }}</CalculationDetails>
        </div>
      </details>
    </div>

    <UCard class="mt-5" :ui="{ body: 'p-5 sm:p-6' }">
      <div class="flex items-center justify-between gap-3"><div><h2 class="font-semibold">ERI records</h2><p class="mt-1 text-sm text-muted">Manual official-source records for ISIN IE00BFMXXD54.</p></div><UBadge color="neutral" variant="subtle">{{ data?.eriRecords.length ?? 0 }} records</UBadge></div>
      <div v-if="!data?.eriRecords.length" class="py-10 text-center"><UIcon name="i-lucide-file-question" class="mx-auto size-7 text-dimmed" /><p class="mt-3 text-sm font-medium">Awaiting published ERI data</p><p class="mt-1 text-xs text-muted">No zero value has been silently assumed.</p></div>
      <div v-else class="mt-4 overflow-x-auto"><table class="w-full min-w-[760px] text-left text-sm"><thead class="border-b border-default text-xs text-muted"><tr><th class="pb-3 font-medium">Period end</th><th class="pb-3 font-medium">Distribution date</th><th class="pb-3 text-right font-medium">Per unit</th><th class="pb-3 text-right font-medium">GIA units</th><th class="pb-3 text-right font-medium">Total ERI</th><th class="pb-3 font-medium">Status</th><th class="pb-3 font-medium">Source</th></tr></thead><tbody><tr v-for="item in data.eriRecords" :key="item.id" class="border-b border-default last:border-0"><td class="py-3">{{ item.reportingPeriodEnd }}</td><td class="py-3">{{ item.fundDistributionDate }}</td><td class="numeric py-3 text-right">{{ formatGbp(item.eriPerUnit, 8) }}</td><td class="numeric py-3 text-right">{{ formatUnits(item.applicableUnits) }}</td><td class="numeric py-3 text-right">{{ formatGbp(item.totalAmount) }}</td><td class="py-3"><UBadge :color="item.verified ? 'success' : 'warning'" variant="subtle">{{ item.verified ? 'Verified' : 'Unverified' }}</UBadge></td><td class="max-w-[220px] truncate py-3 text-muted">{{ item.source }}</td></tr></tbody></table></div>
    </UCard>
  </div>
</template>
