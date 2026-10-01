<script setup lang="ts">
const route = useRoute()
const colorMode = useColorMode()
const mobileOpen = ref(false)

const navigation = [
  { label: 'Dashboard', to: '/', icon: 'i-lucide-layout-dashboard' },
  { label: 'Performance', to: '/performance', icon: 'i-lucide-chart-no-axes-combined' },
  { label: 'Bed & ISA', to: '/bed-and-isa', icon: 'i-lucide-arrow-left-right' },
  { label: 'Withdrawals', to: '/withdrawals', icon: 'i-lucide-hand-coins' },
  { label: 'Tax', to: '/tax', icon: 'i-lucide-landmark' },
  { label: 'Transactions', to: '/transactions', icon: 'i-lucide-receipt-text' },
  { label: 'Projection', to: '/projection', icon: 'i-lucide-telescope' },
  { label: 'Settings', to: '/settings', icon: 'i-lucide-settings-2' },
  { label: 'Help & Guide', to: '/help', icon: 'i-lucide-book-open' }
]

watch(() => route.path, () => { mobileOpen.value = false })
</script>

<template>
  <div class="min-h-screen bg-default text-highlighted">
    <div class="pointer-events-none fixed inset-x-0 top-0 h-72 surface-grid opacity-40" aria-hidden="true" />

    <header class="sticky top-0 z-40 border-b border-default bg-default/85 backdrop-blur-xl lg:hidden">
      <div class="flex h-16 items-center justify-between px-4">
        <NuxtLink to="/" class="flex items-center gap-3 font-semibold">
          <span class="grid size-9 place-items-center rounded-lg bg-primary text-inverted">V</span>
          <span>VUAG Portfolio</span>
        </NuxtLink>
        <div class="flex items-center gap-1">
          <UButton
            color="neutral"
            variant="ghost"
            :icon="colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'"
            aria-label="Toggle colour mode"
            @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
          />
          <UButton color="neutral" variant="ghost" icon="i-lucide-menu" aria-label="Open navigation" @click="mobileOpen = !mobileOpen" />
        </div>
      </div>
      <nav v-if="mobileOpen" class="border-t border-default p-3" aria-label="Main navigation">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
          :class="route.path === item.to ? 'bg-elevated text-primary' : 'text-muted hover:bg-elevated hover:text-highlighted'"
        >
          <UIcon :name="item.icon" class="size-4" />
          {{ item.label }}
        </NuxtLink>
      </nav>
    </header>

    <aside class="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-default bg-default/80 px-4 py-5 backdrop-blur-xl lg:flex lg:flex-col">
      <NuxtLink to="/" class="mb-8 flex items-center gap-3 px-2 font-semibold">
        <span class="grid size-10 place-items-center rounded-lg bg-primary text-lg text-inverted shadow-sm">V</span>
        <span>
          <span class="block leading-tight">VUAG Portfolio</span>
          <span class="block text-xs font-normal text-muted">Fantasy tracker</span>
        </span>
      </NuxtLink>

      <nav class="space-y-1" aria-label="Main navigation">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
          :class="route.path === item.to ? 'bg-elevated text-primary' : 'text-muted hover:bg-elevated hover:text-highlighted'"
        >
          <UIcon :name="item.icon" class="size-4" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="mt-auto rounded-lg border border-default bg-elevated/60 p-3 text-xs leading-relaxed text-muted">
        <div class="mb-1.5 flex items-center gap-2 font-medium text-highlighted">
          <UIcon name="i-lucide-flask-conical" class="size-4 text-primary" />
          Simulation only
        </div>
        Estimate only — not financial or tax advice.
      </div>
      <UButton
        class="mt-3 justify-start"
        color="neutral"
        variant="ghost"
        :icon="colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'"
        :label="colorMode.value === 'dark' ? 'Dark mode' : 'Light mode'"
        @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
      />
    </aside>

    <main class="relative lg:pl-64">
      <div class="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <slot />
      </div>
    </main>
  </div>
</template>
