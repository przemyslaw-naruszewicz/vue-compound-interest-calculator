<script setup>
import { ref } from 'vue'
import { InvestmentCalculator } from '../../src/index.js'

const firstDefaults = ref({})
const locale = ref('pl-PL')
const currency = ref('PLN')
const firstEvents = ref([])
const secondEvents = ref([])
const submissions = ref(0)

function changeDefaults() {
  firstDefaults.value = {
    defaultInitialInvestment: 20, defaultMonthlyContribution: 30,
    defaultDurationYears: 2, defaultAnnualReturn: 3,
  }
}
</script>

<template>
  <main class="reuse-host">
    <h1 data-test="host-heading">Independent calculator checks</h1>
    <label class="reuse-host__control">Unrelated host input
      <input data-test="host-input" value="Host content">
    </label>
    <div class="reuse-host__settings">
      <label>First locale
        <select v-model="locale" data-test="first-locale">
          <option>pl-PL</option><option>en-US</option><option>bad_locale</option>
        </select>
      </label>
      <label>First currency
        <select v-model="currency" data-test="first-currency">
          <option>PLN</option><option>USD</option><option>bad</option>
        </select>
      </label>
      <button type="button" data-test="change-defaults" @click="changeDefaults">
        Change first defaults
      </button>
    </div>
    <form @submit.prevent="submissions++">
      <InvestmentCalculator
        v-bind="firstDefaults"
        data-test="first"
        :locale="locale"
        :currency="currency"
        @result-change="firstEvents.push($event)"
      />
      <InvestmentCalculator
        data-test="second"
        :default-initial-investment="1234.56"
        :default-monthly-contribution="78.91"
        :default-duration-years="3"
        :default-annual-return="4.2"
        locale="en-US"
        currency="USD"
        @result-change="secondEvents.push($event)"
      />
      <button type="submit" data-test="host-submit">Submit host form</button>
    </form>
    <p>Host submissions: <span data-test="submissions">{{ submissions }}</span></p>
    <details>
      <summary>Parent event log</summary>
      <pre data-test="first-events">{{ JSON.stringify(firstEvents) }}</pre>
      <pre data-test="second-events">{{ JSON.stringify(secondEvents) }}</pre>
    </details>
  </main>
</template>

<style scoped>
.reuse-host {
  display: grid;
  max-width: 64rem;
  margin: auto;
  gap: 1.5rem;
}

.reuse-host h1,
.reuse-host pre {
  overflow-wrap: anywhere;
}

.reuse-host pre {
  white-space: pre-wrap;
}

.reuse-host form {
  display: grid;
  min-width: 0;
  gap: 2rem;
}

.reuse-host__settings {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.reuse-host__control,
.reuse-host__settings label {
  display: grid;
  gap: 0.5rem;
}

.reuse-host__control input {
  width: 10rem;
}

.reuse-host select,
.reuse-host button {
  min-height: 44px;
}
</style>
