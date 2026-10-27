<script setup>
import { computed, watch } from 'vue'
import InvestmentForm from './components/InvestmentForm.vue'
import InvestmentSummary from './components/InvestmentSummary.vue'
import { useInvestmentCalculator } from './composables/useInvestmentCalculator.js'
import { DEFAULT_INVESTMENT_PARAMETERS } from './domain/investmentConstraints.js'
import { createCurrencyFormatter } from './utils/formatCurrency.js'

const props = defineProps({
  defaultInitialInvestment: { type: Number, default: DEFAULT_INVESTMENT_PARAMETERS.initialInvestment },
  defaultMonthlyContribution: { type: Number, default: DEFAULT_INVESTMENT_PARAMETERS.monthlyContribution },
  defaultDurationYears: { type: Number, default: DEFAULT_INVESTMENT_PARAMETERS.durationYears },
  defaultAnnualReturn: { type: Number, default: DEFAULT_INVESTMENT_PARAMETERS.annualReturn },
  locale: { type: String, default: 'pl-PL' },
  currency: { type: String, default: 'PLN' },
})

const emit = defineEmits(['result-change'])
const {
  initialInvestmentDraft, monthlyContributionDraft, durationYears, annualReturn,
  parameters, errors, isValid, result,
} = useInvestmentCalculator({
  initialInvestment: props.defaultInitialInvestment,
  monthlyContribution: props.defaultMonthlyContribution,
  durationYears: props.defaultDurationYears,
  annualReturn: props.defaultAnnualReturn,
})
const formatter = computed(() => createCurrencyFormatter(props.locale, props.currency))
const statusMessage = computed(() => isValid.value
  ? 'Projection available.'
  : 'Projection unavailable. Correct the highlighted investment parameters.',
)

watch(
  () => isValid.value ? Object.values(parameters.value) : null,
  (tuple, previousTuple) => {
    if (tuple === previousTuple) return
    if (tuple && previousTuple && tuple.every((value, index) => value === previousTuple[index])) return
    emit('result-change', tuple ? { ...result.value } : null)
  },
  { immediate: true },
)
</script>

<template>
  <div class="investment-calculator">
    <InvestmentForm
      v-model:initial-investment-draft="initialInvestmentDraft"
      v-model:monthly-contribution-draft="monthlyContributionDraft"
      v-model:duration-years="durationYears"
      v-model:annual-return="annualReturn"
      :errors="errors"
      :currency="formatter.currency"
    />
    <p class="investment-calculator__status" role="status" aria-live="polite" aria-atomic="true">
      {{ statusMessage }}
    </p>
    <InvestmentSummary :result="result" :locale="locale" :currency="currency" />
    <p class="investment-calculator__assumptions">
      Illustrative projection using a constant nominal annual return, compounded monthly,
      with contributions at month-end. Excludes taxes, fees and inflation. Actual returns
      vary and may be negative; this is not a guarantee or investment advice.
    </p>
  </div>
</template>

<style scoped>
.investment-calculator,
.investment-calculator * {
  box-sizing: border-box;
}

.investment-calculator {
  display: grid;
  min-width: 0;
  gap: 1rem;
  color: #183c32;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.investment-calculator__status,
.investment-calculator__assumptions {
  margin: 0;
  color: #4c6259;
  font-size: 0.875rem;
}

.investment-calculator__assumptions {
  padding: 1rem;
  border: 1px solid #d4e3da;
  border-radius: 0.75rem;
  background: #f3f7f4;
}
</style>
