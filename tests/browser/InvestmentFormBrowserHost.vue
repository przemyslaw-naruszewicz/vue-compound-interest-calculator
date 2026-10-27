<script setup>
import { ref } from 'vue'
import InvestmentFormHost from '../fixtures/InvestmentFormHost.vue'
import { DEFAULT_INVESTMENT_PARAMETERS } from '../../src/features/investment-calculator/domain/investmentConstraints.js'

const submissions = ref(0)
const enterEvents = ref(0)
const invalidParameters = {
  ...DEFAULT_INVESTMENT_PARAMETERS, durationYears: 41, annualReturn: 7.05,
}
</script>

<template>
  <main class="browser-host">
    <h1>Investment form browser checks</h1>
    <form @submit.prevent="submissions++" @keydown.enter="enterEvents++">
      <InvestmentFormHost data-test="default-instance" />
      <button type="submit">Host submit</button>
    </form>
    <p data-test="submissions">Submissions: {{ submissions }}</p>
    <p data-test="enter-events">Enter events: {{ enterEvents }}</p>
    <InvestmentFormHost data-test="invalid-instance" :initial-parameters="invalidParameters" />
  </main>
</template>

<style scoped>
.browser-host {
  max-width: 60rem;
  margin-inline: auto;
}

.browser-host h1,
.browser-host :deep(pre) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
