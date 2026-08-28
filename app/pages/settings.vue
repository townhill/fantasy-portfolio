<script setup lang="ts">
import { $fetch as rawFetch } from 'ofetch'
import type { TaxProfileInput, TaxRules } from '../../shared/types/domain'

interface SettingsResponse {
  settings: Record<string, string>
  taxProfiles: TaxProfileInput[]
  taxRules: TaxRules[]
  portfolio: { status: 'PENDING' | 'ACTIVE', startDate: string } | null
}

const toast = useToast()
const saving = ref(false)
const { data, status, error, refresh } = await useFetch<SettingsResponse>('/api/settings')
const settings = reactive({
  default_start_date: '2026-08-28', initial_isa_amount: '20000.00', initial_gia_amount: '80000.00',
  bed_isa_enabled: 'true' as 'true' | 'false', manual_price_enabled: 'false' as 'true' | 'false',
  manual_price_override: '', refresh_interval_minutes: '15'
})
const profile = reactive<TaxProfileInput>({
  taxYear: '2026/27', employmentIncome: '0.00', otherTaxableIncome: '0.00', otherDividendIncome: '0.00',
  otherCapitalGains: '0.00', capitalLosses: '0.00', pensionContributions: '0.00', personalAllowanceOverride: null,
  isaAllowanceUsed: '0.00', mode: 'simple'
})
const rules = reactive<TaxRules>({
  taxYear: '2026/27', isaAllowance: '20000.00', cgtAnnualExemption: '3000.00', cgtBasicRate: '0.18', cgtHigherRate: '0.24',
  dividendAllowance: '500.00', dividendBasicRate: '0.1075', dividendHigherRate: '0.3575', dividendAdditionalRate: '0.3935',
  personalAllowance: '12570.00', basicRateBand: '37700.00', additionalRateThreshold: '125140.00', confirmed: true, sourceNote: ''
})

watch(data, value => {
  if (!value) return
  Object.assign(settings, Object.fromEntries(Object.keys(settings).map(key => [key, value.settings[key] ?? settings[key as keyof typeof settings]])))
  Object.assign(profile, value.taxProfiles[0] ?? profile)
  Object.assign(rules, value.taxRules[0] ?? rules)
}, { immediate: true })

async function save() {
  saving.value = true
  try {
    await rawFetch('/api/settings', { method: 'PUT', body: { settings, taxProfile: profile, taxRules: rules } })
    await refresh()
    toast.add({ title: 'Settings saved', description: 'New calculations will use the updated assumptions.', color: 'success' })
  } catch (cause) {
    toast.add({ title: 'Settings could not be saved', description: cause instanceof Error ? cause.message : 'Check the entered values.', color: 'error' })
  } finally { saving.value = false }
}
</script>

<template>
  <div>
    <PageHeader eyebrow="Assumptions & preferences" title="Settings" description="Keep portfolio, tax-profile, market-data, and tax-year assumptions in one place. Existing acquisitions remain fixed when settings change.">
      <template #actions><UButton icon="i-lucide-save" :loading="saving" @click="save">Save settings</UButton></template>
    </PageHeader>
    <USkeleton v-if="status === 'pending'" class="h-96 w-full" />
    <UAlert v-else-if="error" color="error" variant="subtle" title="Settings unavailable" :description="error.message" />
    <div v-else class="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <div class="space-y-5">
        <UCard :ui="{ body: 'p-5 sm:p-6' }">
          <div class="flex items-start gap-3"><div class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><UIcon name="i-lucide-wallet-cards" class="size-4" /></div><div><h2 class="font-semibold">Portfolio assumptions</h2><p class="mt-1 text-sm text-muted">Opening settings apply before initialization only.</p></div></div>
          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <UFormField label="Default start date"><UInput v-model="settings.default_start_date" type="date" class="w-full" :disabled="data?.portfolio?.status === 'ACTIVE'" /></UFormField>
            <UFormField label="Initial ISA amount"><UInput v-model="settings.initial_isa_amount" type="number" step="0.01" class="w-full" :disabled="data?.portfolio?.status === 'ACTIVE'" /></UFormField>
            <UFormField label="Initial GIA amount"><UInput v-model="settings.initial_gia_amount" type="number" step="0.01" class="w-full" :disabled="data?.portfolio?.status === 'ACTIVE'" /></UFormField>
            <UFormField label="Annual Bed & ISA strategy"><USelect v-model="settings.bed_isa_enabled" :items="[{ label: 'Enabled for planning', value: 'true' }, { label: 'Disabled', value: 'false' }]" class="w-full" /></UFormField>
          </div>
          <div class="mt-5 rounded-lg border border-default bg-elevated/40 p-4 text-sm"><div class="grid grid-cols-2 gap-3"><div><p class="text-xs text-muted">Instrument</p><p class="mt-1 font-medium">VUAG.L</p></div><div><p class="text-xs text-muted">ISIN</p><p class="mt-1 font-medium">IE00BFMXXD54</p></div><div><p class="text-xs text-muted">Currency</p><p class="mt-1 font-medium">GBP</p></div><div><p class="text-xs text-muted">Class</p><p class="mt-1 font-medium">Accumulating</p></div></div></div>
          <UAlert v-if="data?.portfolio?.status === 'ACTIVE'" class="mt-4" color="neutral" variant="subtle" title="Opening acquisition is locked" description="Changing current market assumptions never rewrites the stored acquisition price or units." />
        </UCard>

        <UCard :ui="{ body: 'p-5 sm:p-6' }">
          <div class="flex items-start gap-3"><div class="grid size-9 place-items-center rounded-lg bg-info/10 text-info"><UIcon name="i-lucide-radio-tower" class="size-4" /></div><div><h2 class="font-semibold">Market data</h2><p class="mt-1 text-sm text-muted">Conservative server-side caching and a visible testing override.</p></div></div>
          <div class="mt-5 space-y-4">
            <UFormField label="Refresh interval" description="Minutes; minimum 5"><UInput v-model="settings.refresh_interval_minutes" type="number" min="5" max="1440" class="w-full" /></UFormField>
            <UCheckbox :model-value="settings.manual_price_enabled === 'true'" label="Enable manual VUAG price override" @update:model-value="settings.manual_price_enabled = $event ? 'true' : 'false'" />
            <UFormField v-if="settings.manual_price_enabled === 'true'" label="Manual VUAG price" description="Clearly labelled throughout the dashboard"><UInput v-model="settings.manual_price_override" type="number" min="0" step="0.000001" class="w-full" /></UFormField>
          </div>
          <p class="mt-4 text-xs leading-5 text-muted">Normal mode uses the unofficial yahoo-finance2 provider from the server. On failure, the last successful cache is returned as stale; no price is invented.</p>
        </UCard>
      </div>

      <div class="space-y-5">
        <UCard :ui="{ body: 'p-5 sm:p-6' }">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 class="font-semibold">Tax profile</h2><p class="mt-1 text-sm text-muted">Your wider position determines how gains and reportable income use tax bands.</p></div><div class="flex rounded-lg border border-default bg-elevated/50 p-1"><UButton size="sm" :variant="profile.mode === 'simple' ? 'solid' : 'ghost'" :color="profile.mode === 'simple' ? 'primary' : 'neutral'" @click="profile.mode = 'simple'">Simple</UButton><UButton size="sm" :variant="profile.mode === 'advanced' ? 'solid' : 'ghost'" :color="profile.mode === 'advanced' ? 'primary' : 'neutral'" @click="profile.mode = 'advanced'">Advanced</UButton></div></div>
          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <UFormField label="Tax year"><UInput v-model="profile.taxYear" class="w-full" /></UFormField>
            <UFormField label="Employment / pension income"><UInput v-model="profile.employmentIncome" type="number" min="0" step="0.01" class="w-full" /></UFormField>
            <UFormField label="Other taxable income"><UInput v-model="profile.otherTaxableIncome" type="number" min="0" step="0.01" class="w-full" /></UFormField>
            <UFormField label="Other dividend income"><UInput v-model="profile.otherDividendIncome" type="number" min="0" step="0.01" class="w-full" /></UFormField>
            <UFormField label="Other capital gains"><UInput v-model="profile.otherCapitalGains" type="number" min="0" step="0.01" class="w-full" /></UFormField>
            <UFormField label="Capital losses"><UInput v-model="profile.capitalLosses" type="number" min="0" step="0.01" class="w-full" /></UFormField>
            <template v-if="profile.mode === 'advanced'">
              <UFormField label="Pension contributions / deductions"><UInput v-model="profile.pensionContributions" type="number" min="0" step="0.01" class="w-full" /></UFormField>
              <UFormField label="Personal allowance override"><UInput :model-value="profile.personalAllowanceOverride ?? ''" type="number" min="0" step="0.01" placeholder="Use tax-year rule" class="w-full" @update:model-value="profile.personalAllowanceOverride = $event ? String($event) : null" /></UFormField>
            </template>
            <UFormField label="ISA allowance used elsewhere"><UInput v-model="profile.isaAllowanceUsed" type="number" min="0" step="0.01" class="w-full" /></UFormField>
          </div>
          <p class="mt-4 text-xs text-muted">This profile supports educational estimates only and does not reproduce an HMRC tax return.</p>
        </UCard>

        <UCard :ui="{ body: 'p-5 sm:p-6' }">
          <div class="flex items-start justify-between gap-3"><div><h2 class="font-semibold">{{ rules.taxYear }} tax rules</h2><p class="mt-1 text-sm text-muted">Rules are stored as editable tax-year data rather than embedded in components.</p></div><UBadge :color="rules.confirmed ? 'success' : 'warning'" variant="subtle">{{ rules.confirmed ? 'Configured as confirmed' : 'Projection assumptions' }}</UBadge></div>
          <div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UFormField label="ISA allowance"><UInput v-model="rules.isaAllowance" type="number" class="w-full" /></UFormField>
            <UFormField label="CGT annual exemption"><UInput v-model="rules.cgtAnnualExemption" type="number" class="w-full" /></UFormField>
            <UFormField label="Dividend allowance"><UInput v-model="rules.dividendAllowance" type="number" class="w-full" /></UFormField>
            <UFormField label="CGT basic rate"><UInput v-model="rules.cgtBasicRate" type="number" step="0.001" class="w-full" /></UFormField>
            <UFormField label="CGT higher rate"><UInput v-model="rules.cgtHigherRate" type="number" step="0.001" class="w-full" /></UFormField>
            <UFormField label="Personal allowance"><UInput v-model="rules.personalAllowance" type="number" class="w-full" /></UFormField>
            <UFormField label="Dividend basic rate"><UInput v-model="rules.dividendBasicRate" type="number" step="0.0001" class="w-full" /></UFormField>
            <UFormField label="Dividend higher rate"><UInput v-model="rules.dividendHigherRate" type="number" step="0.0001" class="w-full" /></UFormField>
            <UFormField label="Dividend additional rate"><UInput v-model="rules.dividendAdditionalRate" type="number" step="0.0001" class="w-full" /></UFormField>
            <UFormField label="Basic-rate band"><UInput v-model="rules.basicRateBand" type="number" class="w-full" /></UFormField>
            <UFormField label="Additional-rate threshold"><UInput v-model="rules.additionalRateThreshold" type="number" class="w-full" /></UFormField>
            <UFormField label="Tax year"><UInput v-model="rules.taxYear" class="w-full" /></UFormField>
          </div>
          <UFormField class="mt-4" label="Rule source note"><UTextarea v-model="rules.sourceNote" :rows="2" class="w-full" /></UFormField>
          <UCheckbox v-model="rules.confirmed" class="mt-4" label="Treat these rules as confirmed for this tax year" />
        </UCard>
      </div>
    </div>
    <div class="mt-5 flex justify-end"><UButton size="lg" icon="i-lucide-save" :loading="saving" @click="save">Save all settings</UButton></div>
  </div>
</template>
