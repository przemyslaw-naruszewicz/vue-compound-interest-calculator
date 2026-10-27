<script setup>
import { computed } from 'vue'
import InvestmentForm from '../../src/features/investment-calculator/components/InvestmentForm.vue'
import InvestmentSummary from '../../src/features/investment-calculator/components/InvestmentSummary.vue'
import { useInvestmentCalculator } from '../../src/features/investment-calculator/composables/useInvestmentCalculator.js'
import { createCurrencyFormatter } from '../../src/features/investment-calculator/utils/formatCurrency.js'

const props = defineProps({
  initialParameters: { type: Object, default: undefined },
  locale: { type: String, default: 'pl-PL' },
  currency: { type: String, default: 'PLN' },
})

const {
  initialInvestmentDraft, monthlyContributionDraft, durationYears, annualReturn,
  errors, result,
} = useInvestmentCalculator(props.initialParameters)
const formatter = computed(() => createCurrencyFormatter(props.locale, props.currency))
</script>

<template>
  <div class="investment-results-host">
    <InvestmentForm
      v-model:initial-investment-draft="initialInvestmentDraft"
      v-model:monthly-contribution-draft="monthlyContributionDraft"
      v-model:duration-years="durationYears"
      v-model:annual-return="annualReturn"
      :errors="errors"
      :currency="formatter.currency"
    />
    <InvestmentSummary :result="result" :locale="locale" :currency="currency" />
  </div>
</template>

<style scoped>
.investment-results-host {
  display: grid;
  min-width: 0;
  gap: 1rem;
}
</style>
