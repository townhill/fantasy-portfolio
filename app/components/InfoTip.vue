<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <UTooltip :text="text" :content="{ side: 'top' }">
    <button type="button" class="inline-flex rounded text-dimmed hover:text-highlighted focus-visible:outline-2 focus-visible:outline-primary" :aria-label="text">
      <UIcon name="i-lucide-circle-help" class="size-3.5" />
    </button>
  </UTooltip>
</template>
