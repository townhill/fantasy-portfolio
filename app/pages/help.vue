<script setup lang="ts">
const quickLinks = [
  { label: 'First visit', href: '#first-visit' },
  { label: 'Page tour', href: '#page-tour' },
  { label: 'Common workflows', href: '#workflows' },
  { label: 'Settings', href: '#settings-guide' },
  { label: 'Data safety', href: '#data-safety' },
  { label: 'Glossary', href: '#glossary' }
]

const screens = [
  {
    title: 'Dashboard',
    to: '/',
    icon: 'i-lucide-layout-dashboard',
    description: 'Your current valuation, account split, quote status, gains, and estimated tax exposure.',
    note: 'Potential CGT is hypothetical exposure, not tax currently due.'
  },
  {
    title: 'Performance',
    to: '/performance',
    icon: 'i-lucide-chart-no-axes-combined',
    description: 'Historical VUAG.L closes across selectable periods, applied to the units held.',
    note: 'Forecast data is never mixed into the historical chart.'
  },
  {
    title: 'Bed & ISA',
    to: '/bed-and-isa',
    icon: 'i-lucide-arrow-left-right',
    description: 'Preview and, after explicit confirmation, record a linked GIA sale and ISA purchase.',
    note: 'Only Apply to fantasy portfolio changes holdings.'
  },
  {
    title: 'Withdrawals',
    to: '/withdrawals',
    icon: 'i-lucide-hand-coins',
    description: 'Sell from the ISA (tax-free, the default) or the GIA into an interest-earning cash account, then take cash out to live on.',
    note: 'GIA sales crystallise a gain; ISA sales never incur CGT.'
  },
  {
    title: 'Tax',
    to: '/tax',
    icon: 'i-lucide-landmark',
    description: 'Review tax-year estimates and record official Excess Reportable Income data.',
    note: 'Unverified ERI is stored but is not applied.'
  },
  {
    title: 'Transactions',
    to: '/transactions',
    icon: 'i-lucide-receipt-text',
    description: 'An append-only audit trail of opening buys, transfers, disposals, ERI adjustments, and cash movements.',
    note: 'Bed & ISA legs remain separate so both accounts can be audited.'
  },
  {
    title: 'Projection',
    to: '/projection',
    icon: 'i-lucide-telescope',
    description: 'Explore 5–20 year scenarios using a return assumption, yearly withdrawals to live on, and illustrative annual sheltering.',
    note: 'Forecasts never create transactions or predict VUAG prices.'
  },
  {
    title: 'Settings',
    to: '/settings',
    icon: 'i-lucide-settings-2',
    description: 'Maintain the market refresh, wider tax profile, ISA use, and tax-year assumptions.',
    note: 'Opening price and units stay locked after initialization.'
  }
]

const glossary = [
  ['Adjusted CGT base', 'Original allowable cost plus verified ERI adjustments.'],
  ['Bed & ISA', 'A GIA sale followed by an ISA purchase to move value into a sheltered account.'],
  ['Cash account', 'Where withdrawal proceeds are held. It earns the interest rate in Settings, paid monthly.'],
  ['CGT', 'Capital Gains Tax.'],
  ['ERI', 'Excess Reportable Income: potentially taxable non-cash income reported by an offshore fund.'],
  ['GIA', 'General Investment Account; treated as taxable by this tracker.'],
  ['ISA', 'Individual Savings Account; treated as tax sheltered by this tracker.'],
  ['Potential CGT', 'A hypothetical estimate if the GIA were sold, not automatically a tax bill.'],
  ['Realised gain', 'A gain created by a recorded disposal.'],
  ['Section 104 pool', 'The pooled allowable cost used for shares not matched by same-day or 30-day rules.'],
  ['Stale quote', 'The last successful cached price, shown because a provider refresh failed.'],
  ['Tax year', 'The UK period from 6 April to 5 April of the next calendar year.'],
  ['Unrealised gain', 'A gain on units still held, before any disposal is recorded.']
]
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Documentation"
      title="Help & user guide"
      description="A practical introduction to the tracker, its calculations, and the actions that change your fantasy portfolio."
    >
      <template #actions>
        <UButton to="/" color="neutral" variant="outline" icon="i-lucide-arrow-left">
          Back to dashboard
        </UButton>
      </template>
    </PageHeader>

    <UAlert
      class="mb-5"
      color="warning"
      variant="subtle"
      icon="i-lucide-flask-conical"
      title="Simulation only"
      description="This app does not hold investments, place trades, connect to a broker, submit an HMRC return, or provide financial or tax advice."
    />

    <UCard class="overflow-hidden border-primary/25" :ui="{ body: 'p-0' }">
      <div class="grid lg:grid-cols-[1.2fr_0.8fr]">
        <div class="relative overflow-hidden p-6 sm:p-8">
          <div class="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl" />
          <div class="relative">
            <UBadge color="primary" variant="subtle">Start here</UBadge>
            <h2 class="mt-4 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">Understand the portfolio in five minutes</h2>
            <p class="mt-3 max-w-2xl text-sm leading-6 text-muted">The tracker follows one £100,000 fantasy VUAG investment: £20,000 in a Stocks & Shares ISA and £80,000 in a General Investment Account. Current prices revalue fixed units; they never rewrite the recorded opening purchase.</p>
            <div class="mt-6 flex flex-wrap gap-2">
              <UButton to="#first-visit" icon="i-lucide-list-checks">Follow the first-visit checklist</UButton>
              <UButton to="/settings" color="neutral" variant="outline" icon="i-lucide-settings-2">Review assumptions</UButton>
            </div>
          </div>
        </div>
        <div class="border-t border-default bg-elevated/45 p-6 lg:border-l lg:border-t-0 sm:p-8">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted">On this page</p>
          <nav class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="Guide sections">
            <a v-for="(item, index) in quickLinks" :key="item.href" :href="item.href" class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-default hover:text-highlighted">
              <span class="numeric grid size-6 place-items-center rounded-md bg-default text-xs font-semibold text-primary">{{ index + 1 }}</span>
              <span>{{ item.label }}</span>
              <UIcon name="i-lucide-arrow-down-right" class="ml-auto size-3.5 opacity-0 transition group-hover:opacity-100" />
            </a>
          </nav>
        </div>
      </div>
    </UCard>

    <section id="first-visit" class="scroll-mt-24 pt-10">
      <div class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">01 · First visit</p>
        <h2 class="mt-2 text-xl font-semibold">Set up the tracker in the right order</h2>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-muted">If the portfolio is already initialized, begin at step three. Initialization is intentionally permanent in the interface.</p>
      </div>
      <div class="grid gap-4 lg:grid-cols-4">
        <UCard v-for="step in [
          { n: '1', title: 'Choose a date', text: 'On Dashboard, choose the opening date. Historical dates use an available close; today may use a delayed quote.' },
          { n: '2', title: 'Review before creating', text: 'Retrieve the price and check its date, source, ISA/GIA allocation, and fractional units before confirming.' },
          { n: '3', title: 'Enter your profile', text: 'In Settings, add wider income, gains, losses, other dividends, and ISA allowance used elsewhere.' },
          { n: '4', title: 'Check the quote', text: 'Return to Dashboard and read the source, timestamp, and stale/manual status before interpreting values.' }
        ]" :key="step.n" :ui="{ body: 'p-5' }">
          <div class="grid size-8 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">{{ step.n }}</div>
          <h3 class="mt-4 font-semibold">{{ step.title }}</h3>
          <p class="mt-2 text-sm leading-6 text-muted">{{ step.text }}</p>
        </UCard>
      </div>
      <UAlert class="mt-4" color="neutral" variant="subtle" icon="i-lucide-lock-keyhole" title="Opening acquisition is locked" description="After creation, the acquisition price and units cannot be reset from the UI. Later market prices only revalue the units." />
    </section>

    <section class="pt-10">
      <div class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">02 · Reading the dashboard</p>
        <h2 class="mt-2 text-xl font-semibold">Know which numbers are current, realised, or hypothetical</h2>
      </div>
      <UCard :ui="{ body: 'p-0' }">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead class="border-b border-default bg-elevated/50 text-xs text-muted"><tr><th class="px-5 py-3 font-medium">Figure</th><th class="px-5 py-3 font-medium">What it means</th><th class="px-5 py-3 font-medium">What changes it</th></tr></thead>
            <tbody class="divide-y divide-default">
              <tr><td class="px-5 py-4 font-medium">Current value</td><td class="px-5 py-4 text-muted">Current VUAG quote × all units held, plus the cash account balance.</td><td class="px-5 py-4 text-muted">Quote movement, cash interest, or cash taken out to live on.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Gain / loss</td><td class="px-5 py-4 text-muted">Current value plus cash taken out, minus the initial investment.</td><td class="px-5 py-4 text-muted">Quote movement or cash interest. Withdrawals and cash taken out do not change it.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Tax due now</td><td class="px-5 py-4 text-muted">Estimate from recorded GIA disposals and verified reportable income.</td><td class="px-5 py-4 text-muted">Applied Bed & ISA, GIA withdrawals, ERI, profile, or tax rules.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Potential CGT</td><td class="px-5 py-4 text-muted">Hypothetical exposure if the full GIA were sold at the displayed price.</td><td class="px-5 py-4 text-muted">Quote, GIA base cost, profile, or rules. It is not automatically due.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Today</td><td class="px-5 py-4 text-muted">Approximate movement from previous close to the current quote.</td><td class="px-5 py-4 text-muted">Market quote only.</td></tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </section>

    <section id="page-tour" class="scroll-mt-24 pt-10">
      <div class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">03 · Page tour</p>
        <h2 class="mt-2 text-xl font-semibold">What each area is for</h2>
      </div>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <NuxtLink v-for="screen in screens" :key="screen.to" :to="screen.to" class="group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <UCard class="h-full transition group-hover:border-primary/40 group-hover:bg-elevated/30" :ui="{ body: 'p-5' }">
            <div class="flex items-start gap-3">
              <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><UIcon :name="screen.icon" class="size-4" /></div>
              <div><h3 class="font-semibold">{{ screen.title }}</h3><p class="mt-1 text-sm leading-6 text-muted">{{ screen.description }}</p></div>
              <UIcon name="i-lucide-arrow-up-right" class="ml-auto size-4 shrink-0 text-dimmed transition group-hover:text-primary" />
            </div>
            <p class="mt-4 border-t border-default pt-4 text-xs leading-5 text-muted">{{ screen.note }}</p>
          </UCard>
        </NuxtLink>
      </div>
    </section>

    <section id="workflows" class="scroll-mt-24 pt-10">
      <div class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">04 · Common workflows</p>
        <h2 class="mt-2 text-xl font-semibold">The three tasks most likely to need an explanation</h2>
      </div>
      <div class="space-y-5">
        <UCard :ui="{ body: 'p-5 sm:p-6' }">
          <div class="grid gap-6 lg:grid-cols-[0.65fr_1.35fr]">
            <div><UBadge color="info" variant="subtle">Market data</UBadge><h3 class="mt-3 text-lg font-semibold">Refresh and validate a quote</h3><p class="mt-2 text-sm leading-6 text-muted">A new quote changes valuation only. It cannot alter the acquisition or ledger.</p></div>
            <ol class="space-y-3 text-sm">
              <li class="flex gap-3"><span class="numeric text-primary">1.</span><span>On Dashboard, read the source, market timestamp, and last-successful refresh.</span></li>
              <li class="flex gap-3"><span class="numeric text-primary">2.</span><span>Select <strong>Refresh</strong> to request a fresh server-side quote.</span></li>
              <li class="flex gap-3"><span class="numeric text-primary">3.</span><span>If it is labelled stale, the provider failed and the last successful cached value is being used.</span></li>
              <li class="flex gap-3"><span class="numeric text-primary">4.</span><span>A manual price can be enabled in Settings for testing; it is clearly labelled throughout the app.</span></li>
            </ol>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-5 sm:p-6' }">
          <div class="grid gap-6 lg:grid-cols-[0.65fr_1.35fr]">
            <div><UBadge color="warning" variant="subtle">Changes holdings</UBadge><h3 class="mt-3 text-lg font-semibold">Preview and apply Bed & ISA</h3><p class="mt-2 text-sm leading-6 text-muted">The preview is safe. Applying records a GIA disposal and ISA acquisition.</p></div>
            <div>
              <ol class="space-y-3 text-sm">
                <li class="flex gap-3"><span class="numeric text-primary">1.</span><span>Enter an amount and date, then select <strong>Update preview</strong>.</span></li>
                <li class="flex gap-3"><span class="numeric text-primary">2.</span><span>Review allowance, units, allocated Section 104 cost, realised gain, estimated CGT, and resulting values.</span></li>
                <li class="flex gap-3"><span class="numeric text-primary">3.</span><span>Expand the workings, tick the confirmation, then select <strong>Apply to fantasy portfolio</strong> only when ready.</span></li>
              </ol>
              <UAlert class="mt-4" color="warning" variant="subtle" title="Why the default preview shows £0" description="The opening £20,000 ISA buy already consumes the configured 2026/27 allowance. The app also deducts ISA allowance used elsewhere and other recorded contributions." />
            </div>
          </div>
        </UCard>

        <UCard :ui="{ body: 'p-5 sm:p-6' }">
          <div class="grid gap-6 lg:grid-cols-[0.65fr_1.35fr]">
            <div><UBadge color="success" variant="subtle">Official source required</UBadge><h3 class="mt-3 text-lg font-semibold">Record Excess Reportable Income</h3><p class="mt-2 text-sm leading-6 text-muted">VUAG is accumulating, so taxable GIA income may exist without a cash dividend.</p></div>
            <ol class="space-y-3 text-sm">
              <li class="flex gap-3"><span class="numeric text-primary">1.</span><span>Obtain Vanguard's official document for ISIN <code class="rounded bg-elevated px-1.5 py-0.5 text-xs">IE00BFMXXD54</code>.</span></li>
              <li class="flex gap-3"><span class="numeric text-primary">2.</span><span>On Tax, select <strong>Add ERI record</strong> and enter the period, distribution date, GBP amount per unit, source, and document reference.</span></li>
              <li class="flex gap-3"><span class="numeric text-primary">3.</span><span>Tick verified only after checking every field. Verified ERI contributes to reportable income and increases the GIA base cost; unverified ERI is stored but not applied.</span></li>
              <li class="flex gap-3"><span class="numeric text-primary">4.</span><span>Saved ERI cannot currently be edited or deleted in the UI, so review before saving.</span></li>
            </ol>
          </div>
        </UCard>
      </div>
    </section>

    <section id="settings-guide" class="scroll-mt-24 pt-10">
      <div class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">05 · Settings checklist</p>
        <h2 class="mt-2 text-xl font-semibold">Keep assumptions explicit</h2>
      </div>
      <div class="grid gap-5 lg:grid-cols-3">
        <UCard :ui="{ body: 'p-5' }"><UIcon name="i-lucide-radio-tower" class="size-5 text-info" /><h3 class="mt-3 font-semibold">Market data</h3><ul class="mt-3 space-y-2 text-sm leading-6 text-muted"><li>Refresh interval: 5–1,440 minutes.</li><li>Manual override: GBP per VUAG unit.</li><li>Disable and save to return to provider data.</li></ul></UCard>
        <UCard :ui="{ body: 'p-5' }"><UIcon name="i-lucide-user-round-check" class="size-5 text-primary" /><h3 class="mt-3 font-semibold">Tax profile</h3><ul class="mt-3 space-y-2 text-sm leading-6 text-muted"><li>Enter wider income, dividends, gains, and losses.</li><li>Add ISA allowance already used elsewhere.</li><li>Advanced mode exposes deductions and a personal-allowance override.</li></ul></UCard>
        <UCard :ui="{ body: 'p-5' }"><UIcon name="i-lucide-scale" class="size-5 text-warning" /><h3 class="mt-3 font-semibold">Tax-year rules</h3><ul class="mt-3 space-y-2 text-sm leading-6 text-muted"><li>Use a <code class="text-xs">YYYY/YY</code> year label.</li><li>Enter rates as decimals: <code class="text-xs">0.18</code>, not <code class="text-xs">18</code>.</li><li>Add a source note and confirm only after checking the rules.</li></ul></UCard>
      </div>
      <p class="mt-4 text-xs leading-5 text-muted">Future years without configured rules reuse the latest rules as visibly labelled assumptions. They are not presented as confirmed future law.</p>
    </section>

    <section id="data-safety" class="scroll-mt-24 pt-10">
      <div class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">06 · Data safety</p>
        <h2 class="mt-2 text-xl font-semibold">Know which actions write to the database</h2>
      </div>
      <UCard :ui="{ body: 'p-0' }">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[820px] text-left text-sm">
            <thead class="border-b border-default bg-elevated/50 text-xs text-muted"><tr><th class="px-5 py-3 font-medium">Action</th><th class="px-5 py-3 font-medium">Changes holdings</th><th class="px-5 py-3 font-medium">Adds ledger entries</th><th class="px-5 py-3 font-medium">Important detail</th></tr></thead>
            <tbody class="divide-y divide-default">
              <tr><td class="px-5 py-4 font-medium">Refresh quote</td><td class="px-5 py-4 text-muted">No</td><td class="px-5 py-4 text-muted">No</td><td class="px-5 py-4 text-muted">Valuation only.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Save settings</td><td class="px-5 py-4 text-muted">No</td><td class="px-5 py-4 text-muted">No</td><td class="px-5 py-4 text-muted">Recalculates estimates; never rewrites opening units.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Preview Bed & ISA</td><td class="px-5 py-4 text-muted">No</td><td class="px-5 py-4 text-muted">No</td><td class="px-5 py-4 text-muted">Safe to explore repeatedly.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Apply Bed & ISA</td><td class="px-5 py-4 font-medium text-warning">Yes</td><td class="px-5 py-4 font-medium text-warning">Yes</td><td class="px-5 py-4 text-muted">Records linked GIA sale, ISA buy, and audit summary.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Preview a withdrawal</td><td class="px-5 py-4 text-muted">No</td><td class="px-5 py-4 text-muted">No</td><td class="px-5 py-4 text-muted">Safe to explore repeatedly.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Withdraw to cash</td><td class="px-5 py-4 font-medium text-warning">Yes</td><td class="px-5 py-4 font-medium text-warning">Yes</td><td class="px-5 py-4 text-muted">Records a linked ISA or GIA sale and cash deposit.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Take out cash</td><td class="px-5 py-4 text-muted">Cash only</td><td class="px-5 py-4 font-medium text-warning">Yes</td><td class="px-5 py-4 text-muted">Records money leaving the portfolio to live on.</td></tr>
              <tr><td class="px-5 py-4 font-medium">View portfolio pages after a month ends</td><td class="px-5 py-4 text-muted">Cash only</td><td class="px-5 py-4 text-muted">Interest only</td><td class="px-5 py-4 text-muted">Pays outstanding monthly cash interest at the current rate. Saving a new rate pays finished months at the old rate first.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Save unverified ERI</td><td class="px-5 py-4 text-muted">No</td><td class="px-5 py-4 text-muted">No</td><td class="px-5 py-4 text-muted">Stored for reference but not applied.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Save verified ERI</td><td class="px-5 py-4 text-muted">No units</td><td class="px-5 py-4 font-medium text-warning">Yes</td><td class="px-5 py-4 text-muted">Adds a base-cost adjustment and reportable income.</td></tr>
              <tr><td class="px-5 py-4 font-medium">Model projection</td><td class="px-5 py-4 text-muted">No</td><td class="px-5 py-4 text-muted">No</td><td class="px-5 py-4 text-muted">Forecast only.</td></tr>
            </tbody>
          </table>
        </div>
      </UCard>
      <div class="mt-5 grid gap-5 lg:grid-cols-2">
        <UCard :ui="{ body: 'p-5 sm:p-6' }">
          <h3 class="font-semibold">Persistent storage</h3>
          <p class="mt-2 text-sm leading-6 text-muted">The SQLite database lives in the Docker volume <code class="rounded bg-elevated px-1.5 py-0.5 text-xs">vuag-fantasy-portfolio-data</code>. Normal container restarts and <code class="text-xs">docker compose down</code> preserve it.</p>
          <UAlert class="mt-4" color="error" variant="subtle" title="Do not add -v unless deletion is intentional" description="docker compose down -v removes the persistent portfolio database. Recovery then requires a backup." />
        </UCard>
        <UCard :ui="{ body: 'p-5 sm:p-6' }">
          <h3 class="font-semibold">Before a material change</h3>
          <p class="mt-2 text-sm leading-6 text-muted">Stop the service and make a consistent copy of <code class="text-xs">/data/vuag.db</code>. Full backup and restore commands are documented in the repository user guide.</p>
          <div class="mt-4 flex items-center gap-2 text-xs text-muted"><UIcon name="i-lucide-database-backup" class="size-4 text-primary" /><span>Verify the Dashboard and Transactions pages after any restore.</span></div>
        </UCard>
      </div>
    </section>

    <section class="pt-10">
      <div class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">07 · Troubleshooting</p>
        <h2 class="mt-2 text-xl font-semibold">Common questions</h2>
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <details class="group rounded-xl border border-default bg-default p-5" open><summary class="flex cursor-pointer list-none items-center justify-between font-semibold">Why is Bed & ISA allowance £0?<UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition group-open:rotate-180" /></summary><p class="mt-3 text-sm leading-6 text-muted">The default opening ISA contribution already uses the full 2026/27 allowance. The calculation also deducts contributions used elsewhere and any other portfolio ISA buys in that year.</p></details>
        <details class="group rounded-xl border border-default bg-default p-5"><summary class="flex cursor-pointer list-none items-center justify-between font-semibold">Why does the quote say stale?<UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition group-open:rotate-180" /></summary><p class="mt-3 text-sm leading-6 text-muted">The provider refresh failed, so the last successful cached quote is shown. Check its timestamp before interpreting the valuation.</p></details>
        <details class="group rounded-xl border border-default bg-default p-5"><summary class="flex cursor-pointer list-none items-center justify-between font-semibold">Why is ERI missing from tax?<UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition group-open:rotate-180" /></summary><p class="mt-3 text-sm leading-6 text-muted">Confirm the record is verified and that its fund distribution date falls inside the tax year you are viewing. Unverified records are deliberately not applied.</p></details>
        <details class="group rounded-xl border border-default bg-default p-5"><summary class="flex cursor-pointer list-none items-center justify-between font-semibold">Why do tax figures look unexpected?<UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition group-open:rotate-180" /></summary><p class="mt-3 text-sm leading-6 text-muted">Check the tax year, wider income, gains, losses, dividends, ISA use, and rule rates. Rates must be decimals such as 0.18. Expand the calculation details wherever available.</p></details>
      </div>
    </section>

    <section id="glossary" class="scroll-mt-24 pt-10">
      <div class="mb-5">
        <p class="text-xs font-semibold uppercase tracking-wider text-primary">08 · Glossary</p>
        <h2 class="mt-2 text-xl font-semibold">Terms in plain English</h2>
      </div>
      <UCard :ui="{ body: 'p-5 sm:p-6' }">
        <dl class="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="item in glossary" :key="item[0]" class="border-b border-default pb-4 last:border-0"><dt class="text-sm font-semibold">{{ item[0] }}</dt><dd class="mt-1 text-sm leading-6 text-muted">{{ item[1] }}</dd></div>
        </dl>
      </UCard>
    </section>

    <UCard class="mt-10 border-primary/25" :ui="{ body: 'p-5 sm:p-6' }">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 class="font-semibold">Ready to explore?</h2><p class="mt-1 text-sm text-muted">Start with the current quote, then review your saved assumptions before interpreting tax exposure.</p></div>
        <div class="flex flex-wrap gap-2"><UButton to="/" icon="i-lucide-layout-dashboard">Open dashboard</UButton><UButton to="/settings" color="neutral" variant="outline" icon="i-lucide-settings-2">Open settings</UButton></div>
      </div>
    </UCard>
  </div>
</template>
