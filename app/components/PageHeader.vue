<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description: string
}>()
</script>

<template>
  <div class="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div class="max-w-3xl">
      <p v-if="eyebrow" class="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{{ eyebrow }}</p>
      <h1 class="text-2xl font-semibold tracking-tight text-highlighted sm:text-3xl">{{ title }}</h1>
      <p class="mt-2 text-sm leading-6 text-muted sm:text-base">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
