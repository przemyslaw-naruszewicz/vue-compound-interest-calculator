<script setup>
import { computed, useId, watch } from 'vue'
import InvestmentForm from './components/InvestmentForm.vue'
import InvestmentSummary from './components/InvestmentSummary.vue'
import OneTimeContributions from './components/OneTimeContributions.vue'
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
const disclaimerHeadingId = `${useId()}-disclaimer-heading`
const {
  initialInvestmentDraft, monthlyContributionDraft, durationYears, annualReturn,
  parameters, errors, isValid, result,
  contributions, addContribution, updateContribution, removeContribution,
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
  () => isValid.value ? JSON.stringify(parameters.value) : null,
  (signature, previousSignature) => {
    if (signature === previousSignature) return
    emit('result-change', signature ? { ...result.value } : null)
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
    <OneTimeContributions
      :contributions="contributions"
      :duration-years="durationYears"
      :currency="formatter.currency"
      @add="addContribution"
      @update="updateContribution"
      @remove="removeContribution"
    />
    <p class="investment-calculator__status" role="status" aria-live="polite" aria-atomic="true">
      {{ statusMessage }}
    </p>
    <aside class="investment-calculator__disclaimer" :aria-labelledby="disclaimerHeadingId">
      <h2 :id="disclaimerHeadingId">Not investment advice</h2>
      <p>
        This calculator is for illustrative purposes only and does not constitute
        investment advice. Results are not guaranteed.
      </p>
    </aside>
    <InvestmentSummary :result="result" :locale="locale" :currency="currency" />
    <p class="investment-calculator__assumptions">
      Illustrative projection using a constant nominal annual return, compounded monthly,
      with regular contributions at month-end. One-time contributions are added at year-end,
      after interest and the regular contribution, and earn interest from the following month.
      Final-year contributions earn no interest. Excludes taxes, fees and inflation. Actual returns
      vary and may be negative.
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

.investment-calculator__disclaimer {
  min-width: 0;
  padding: 1rem;
  border: 1px solid #e4c889;
  border-inline-start: 4px solid #9a650c;
  border-radius: 0.75rem;
  background: #fff7e6;
  color: #62440f;
  font-size: 1rem;
  line-height: 1.6;
}

.investment-calculator__disclaimer h2 {
  margin: 0 0 0.5rem;
  color: #62440f;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.5;
}

.investment-calculator__disclaimer p {
  margin: 0;
}
</style>
