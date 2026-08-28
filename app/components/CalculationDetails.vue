<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <details class="group mt-4 rounded-lg border border-default bg-elevated/40 open:bg-elevated/70">
    <summary class="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-medium text-muted hover:text-highlighted">
      <span class="flex items-center gap-2"><UIcon name="i-lucide-calculator" class="size-3.5" /> {{ title }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-3.5 transition-transform group-open:rotate-180" />
    </summary>
    <div class="border-t border-default px-3 py-2 text-xs leading-5 text-muted">
      <slot />
    </div>
  </details>
</template>
