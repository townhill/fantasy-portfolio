<script setup lang="ts">
defineProps<{
  label: string
  value: string
  hint?: string
  tone?: 'positive' | 'negative' | 'neutral'
}>()
</script>

<template>
  <div class="flex items-start justify-between gap-4 border-b border-default py-3 last:border-b-0">
    <div class="flex items-center gap-1.5 text-sm text-muted">
      <span>{{ label }}</span>
      <InfoTip v-if="hint" :text="hint" />
    </div>
    <span
      class="numeric text-right text-sm font-medium"
      :class="tone === 'positive' ? 'text-success' : tone === 'negative' ? 'text-error' : 'text-highlighted'"
    >{{ value }}</span>
  </div>
</template>
