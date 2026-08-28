<script setup lang="ts">
import type { MarketQuote } from '../../shared/types/domain'

defineProps<{ quote: MarketQuote }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
    <UBadge :color="quote.stale ? 'warning' : quote.manual ? 'info' : 'neutral'" variant="subtle" size="sm">
      {{ quote.stale ? 'Stale cached price' : quote.manual ? 'Manual price' : 'Market data delayed' }}
    </UBadge>
    <span>Last updated: {{ formatDateTime(quote.lastSuccessfulRefresh) }}</span>
    <span class="hidden sm:inline">•</span>
    <span>Source: {{ quote.source }}</span>
  </div>
</template>
