<script setup>
import { ref } from 'vue'
import InvestmentResultsHost from '../fixtures/InvestmentResultsHost.vue'

const locale = ref('pl-PL')
const currency = ref('PLN')
const zeroReturn = { initialInvestment: 10000, monthlyContribution: 500, durationYears: 10, annualReturn: 0 }
const empty = { initialInvestment: 0, monthlyContribution: 0, durationYears: 10, annualReturn: 7 }
const maximum = {
  initialInvestment: 1_000_000_000, monthlyContribution: 1_000_000_000,
  durationYears: 40, annualReturn: 15,
}
</script>

<template>
  <main class="results-checks">
    <h1>Investment results browser checks</h1>
    <div class="results-checks__settings">
      <label>Locale
        <select v-model="locale" data-test="locale">
          <option>pl-PL</option><option>en-US</option><option>ja-JP</option><option>bad_locale</option>
        </select>
      </label>
      <label>Currency
        <select v-model="currency" data-test="currency">
          <option>PLN</option><option>USD</option><option>JPY</option><option>bad</option>
        </select>
      </label>
    </div>
    <InvestmentResultsHost data-test="interactive" :locale="locale" :currency="currency" />
    <InvestmentResultsHost data-test="zero-return" :initial-parameters="zeroReturn" />
    <InvestmentResultsHost data-test="empty" :initial-parameters="empty" />
    <InvestmentResultsHost data-test="maximum" :initial-parameters="maximum" />
  </main>
</template>

<style scoped>
.results-checks {
  display: grid;
  max-width: 64rem;
  margin: auto;
  gap: 1.5rem;
  font-family: system-ui, sans-serif;
}

.results-checks h1 {
  overflow-wrap: anywhere;
}

.results-checks__settings {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.results-checks__settings label {
  display: grid;
  gap: 0.5rem;
}

.results-checks__settings select {
  min-height: 44px;
  font: inherit;
}
</style>
