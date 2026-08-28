<script setup lang="ts">
import type { LedgerEntry, TransactionType } from '../../shared/types/domain'

const { data: entries, status, error } = await useFetch<LedgerEntry[]>('/api/transactions')
const type = ref<'ALL' | TransactionType>('ALL')
const options = ['ALL', 'INITIAL_BUY', 'GIA_SELL', 'ISA_BUY', 'BED_AND_ISA', 'ERI', 'TAX_PAYMENT', 'ADJUSTMENT']
const filtered = computed(() => type.value === 'ALL' ? entries.value ?? [] : (entries.value ?? []).filter(item => item.type === type.value))

function typeColor(value: TransactionType) {
  if (value === 'GIA_SELL') return 'warning'
  if (value === 'ISA_BUY' || value === 'INITIAL_BUY') return 'success'
  if (value === 'ERI') return 'info'
  return 'neutral'
}
</script>

<template>
  <div>
    <PageHeader eyebrow="Audit trail" title="Transaction ledger" description="Every portfolio movement is recorded with units, acquisition or disposal price, allocated cost basis, gain, ERI adjustment, and estimated tax." />
    <div class="mb-4 flex items-center justify-between gap-3"><p class="text-sm text-muted">{{ filtered.length }} ledger entries</p><USelect v-model="type" :items="options" class="w-48" aria-label="Filter transaction type" /></div>
    <UCard :ui="{ body: 'p-0' }">
      <USkeleton v-if="status === 'pending'" class="h-72 w-full" />
      <UAlert v-else-if="error" color="error" variant="subtle" title="Ledger unavailable" :description="error.message" />
      <div v-else-if="!filtered.length" class="py-16 text-center"><UIcon name="i-lucide-receipt-text" class="mx-auto size-8 text-dimmed" /><p class="mt-3 font-medium">No matching transactions</p><p class="mt-1 text-sm text-muted">Opening buys appear after the portfolio is initialized.</p></div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[1180px] text-left text-sm">
          <thead class="border-b border-default bg-elevated/50 text-xs text-muted"><tr><th class="px-4 py-3 font-medium">Date</th><th class="px-4 py-3 font-medium">Account</th><th class="px-4 py-3 font-medium">Type</th><th class="px-4 py-3 text-right font-medium">VUAG units</th><th class="px-4 py-3 text-right font-medium">Price</th><th class="px-4 py-3 text-right font-medium">Gross value</th><th class="px-4 py-3 text-right font-medium">Cost basis</th><th class="px-4 py-3 text-right font-medium">Realised gain</th><th class="px-4 py-3 text-right font-medium">ERI adjustment</th><th class="px-4 py-3 text-right font-medium">Est. tax</th><th class="px-4 py-3 font-medium">Notes</th></tr></thead>
          <tbody><tr v-for="entry in filtered" :key="entry.id" class="border-b border-default align-top last:border-0 hover:bg-elevated/30"><td class="whitespace-nowrap px-4 py-3">{{ entry.date }}</td><td class="px-4 py-3">{{ entry.account ?? '—' }}</td><td class="px-4 py-3"><UBadge :color="typeColor(entry.type)" variant="subtle">{{ entry.type.replaceAll('_', ' ') }}</UBadge></td><td class="numeric px-4 py-3 text-right">{{ formatUnits(entry.units) }}</td><td class="numeric px-4 py-3 text-right">{{ formatGbp(entry.price, 6) }}</td><td class="numeric px-4 py-3 text-right">{{ formatGbp(entry.grossValue) }}</td><td class="numeric px-4 py-3 text-right">{{ formatGbp(entry.costBasis) }}</td><td class="numeric px-4 py-3 text-right" :class="Number(entry.realisedGain) > 0 ? 'text-success' : ''">{{ formatGbp(entry.realisedGain) }}</td><td class="numeric px-4 py-3 text-right">{{ formatGbp(entry.eriAdjustment) }}</td><td class="numeric px-4 py-3 text-right">{{ formatGbp(entry.estimatedTax) }}</td><td class="max-w-[320px] px-4 py-3 text-xs leading-5 text-muted">{{ entry.notes }}</td></tr></tbody>
        </table>
      </div>
    </UCard>
    <p class="mt-4 text-xs text-muted">Linked Bed & ISA legs share an internal group identifier and remain separate account transactions. The summary row is audit-only and does not affect holdings.</p>
  </div>
</template>
