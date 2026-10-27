<script setup>
import { computed } from 'vue'

const props = defineProps({
  result: { type: [Object, null], required: true },
})

const breakdown = computed(() => {
  const { finalValue, investedCapital } = props.result ?? {}
  if (!Number.isFinite(finalValue) || !Number.isFinite(investedCapital) || finalValue < 0) {
    return null
  }

  const investedShare = finalValue > 0
    ? Math.min(100, Math.max(0, investedCapital / finalValue * 100))
    : 0
  const gainShare = finalValue > 0 ? 100 - investedShare : 0
  const investedTenths = Math.round(investedShare * 10)
  const gainTenths = finalValue > 0 ? 1000 - investedTenths : 0

  return {
    investedStyle: { width: `${investedShare}%` },
    gainStyle: { width: `${gainShare}%` },
    investedPercentage: `${(investedTenths / 10).toFixed(1)}%`,
    gainPercentage: `${(gainTenths / 10).toFixed(1)}%`,
    isEmpty: finalValue === 0,
  }
})
</script>

<template>
  <div v-if="breakdown" class="investment-breakdown">
    <div class="investment-breakdown__track" aria-hidden="true">
      <span class="investment-breakdown__invested" :style="breakdown.investedStyle" />
      <span class="investment-breakdown__gain" :style="breakdown.gainStyle" />
    </div>
    <ul class="investment-breakdown__legend" aria-label="Investment breakdown">
      <li>
        <span class="investment-breakdown__swatch investment-breakdown__invested" aria-hidden="true" />
        <span>Total invested: <strong>{{ breakdown.investedPercentage }}</strong></span>
      </li>
      <li>
        <span class="investment-breakdown__swatch investment-breakdown__gain" aria-hidden="true" />
        <span>Projected gain: <strong>{{ breakdown.gainPercentage }}</strong></span>
      </li>
    </ul>
    <p v-if="breakdown.isEmpty" class="investment-breakdown__empty">
      No invested capital or gain yet.
    </p>
  </div>
</template>

<style scoped>
.investment-breakdown,
.investment-breakdown * {
  box-sizing: border-box;
}

.investment-breakdown {
  min-width: 0;
  color: #183c32;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.investment-breakdown__track {
  display: flex;
  height: 1.25rem;
  overflow: hidden;
  border: 1px solid #637a70;
  border-radius: 0.375rem;
  background: #e7ece9;
}

.investment-breakdown__track > span {
  flex: 0 0 auto;
}

.investment-breakdown__invested {
  background: #32694f;
}

.investment-breakdown__gain {
  background: repeating-linear-gradient(135deg, #a4ccad 0 4px, #d2e5d6 4px 8px);
}

.investment-breakdown__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;
}

.investment-breakdown__legend li {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-width: 0;
}

.investment-breakdown__swatch {
  width: 0.75rem;
  height: 0.75rem;
  flex: 0 0 auto;
  border: 1px solid #637a70;
  border-radius: 0.125rem;
}

.investment-breakdown__empty {
  margin: 0.75rem 0 0;
  color: #4c6259;
}
</style>
