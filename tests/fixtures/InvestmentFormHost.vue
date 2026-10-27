<script setup>
import InvestmentForm from '../../src/features/investment-calculator/components/InvestmentForm.vue'
import { useInvestmentCalculator } from '../../src/features/investment-calculator/composables/useInvestmentCalculator.js'

const props = defineProps({
  initialParameters: { type: Object, default: undefined },
  currency: { type: String, default: 'PLN' },
})

const {
  initialInvestmentDraft, monthlyContributionDraft, durationYears, annualReturn,
  errors, parameters, isValid,
} = useInvestmentCalculator(props.initialParameters)
</script>

<template>
  <div class="investment-form-host">
    <InvestmentForm
      v-model:initial-investment-draft="initialInvestmentDraft"
      v-model:monthly-contribution-draft="monthlyContributionDraft"
      v-model:duration-years="durationYears"
      v-model:annual-return="annualReturn"
      :errors="errors"
      :currency="currency"
    />
    <p data-test="validity">{{ isValid ? 'Valid parameters' : 'Unavailable: correct the fields above.' }}</p>
    <pre data-test="parameters">{{ JSON.stringify(parameters) }}</pre>
  </div>
</template>
