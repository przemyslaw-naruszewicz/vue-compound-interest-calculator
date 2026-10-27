<script setup>
import { computed, useId } from 'vue'
import { createCurrencyFormatter } from '../utils/formatCurrency.js'
import InvestmentBreakdownBar from './InvestmentBreakdownBar.vue'

const props = defineProps({
  result: { type: [Object, null], required: true },
  locale: { type: String, default: 'pl-PL' },
  currency: { type: String, default: 'PLN' },
})

const headingId = `${useId()}-summary-heading`
const formatter = computed(() => createCurrencyFormatter(props.locale, props.currency))
const metrics = [
  { field: 'finalValue', label: 'Projected final value' },
  { field: 'investedCapital', label: 'Total invested' },
  { field: 'investmentGain', label: 'Projected gain' },
]
const formattedMetrics = computed(() => {
  if (!props.result || metrics.some(({ field }) => (
    !Number.isFinite(props.result[field]) || props.result[field] < 0
  ))) {
    return null
  }
  return metrics.map((metric) => ({
    ...metric,
    value: formatter.value.format(props.result[metric.field]),
  }))
})
</script>

<template>
  <section class="investment-summary" :aria-labelledby="headingId">
    <h2 :id="headingId">Investment projection</h2>
    <p v-if="formatter.notice" class="investment-summary__notice" role="status">
      {{ formatter.notice }}
    </p>
    <template v-if="formattedMetrics">
      <dl class="investment-summary__totals">
        <div
          v-for="metric in formattedMetrics"
          :key="metric.field"
          class="investment-summary__metric"
          :class="{ 'investment-summary__metric--final': metric.field === 'finalValue' }"
        >
          <dt>{{ metric.label }}</dt>
          <dd>{{ metric.value }}</dd>
        </div>
      </dl>
      <InvestmentBreakdownBar :result="result" />
    </template>
    <p v-else class="investment-summary__unavailable">
      Results unavailable. Correct the investment parameters to see your projection.
    </p>
  </section>
</template>

<style scoped>
.investment-summary,
.investment-summary * {
  box-sizing: border-box;
}

.investment-summary {
  min-width: 0;
  padding: clamp(1rem, 4vw, 1.5rem);
  border: 1px solid #d4e3da;
  border-radius: 1rem;
  background: #fff;
  color: #183c32;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.investment-summary h2 {
  margin: 0 0 1rem;
  font-size: 1.125rem;
}

.investment-summary__totals {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0 0 1.5rem;
}

.investment-summary__metric {
  flex: 1 1 calc(50% - 0.5rem);
  min-width: min(100%, 12rem);
}

.investment-summary__metric dt {
  color: #4c6259;
}

.investment-summary__metric dd {
  margin: 0.25rem 0 0;
  font-size: clamp(1.25rem, 4vw, 1.5rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.investment-summary__metric--final {
  flex-basis: 100%;
  padding: 1rem;
  border-radius: 0.5rem;
  background: #f3f7f4;
}

.investment-summary__metric--final dd {
  font-size: clamp(1.75rem, 6vw, 2.5rem);
}

.investment-summary__notice {
  margin: 0 0 1rem;
  padding: 0.75rem;
  border-inline-start: 3px solid #32694f;
  background: #f3f7f4;
  font-size: 0.875rem;
}

.investment-summary__unavailable {
  margin: 0;
  color: #4c6259;
}
</style>
