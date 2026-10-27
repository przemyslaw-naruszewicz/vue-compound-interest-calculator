<script setup>
import { ref } from 'vue'
import { InvestmentCalculator } from '../../src/index.js'

const locale = ref('pl-PL')
const currency = ref('PLN')
const seed = ref({})
const instanceKey = ref(0)
const events = ref([])
const invalidEvents = ref([])

function receive(payload) {
  events.value.push(payload ? { ...payload } : null)
  if (payload) {
    payload.finalValue = -1
    payload.investedCapital = -2
    payload.investmentGain = -3
  }
}

function changeDefaults() {
  seed.value = {
    defaultInitialInvestment: 1234.56, defaultMonthlyContribution: 78.91,
    defaultDurationYears: 3, defaultAnnualReturn: 4.2,
  }
}
</script>

<template>
  <main class="public-checks">
    <h1>Public calculator component checks</h1>
    <p data-test="host-text">Unrelated host text</p>
    <div class="public-checks__settings">
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
      <button data-test="change-defaults" @click="changeDefaults">Change defaults</button>
      <button data-test="remount" @click="instanceKey++">Remount</button>
    </div>
    <InvestmentCalculator
      :key="instanceKey"
      v-bind="seed"
      data-test="interactive"
      :locale="locale"
      :currency="currency"
      @result-change="receive"
    />
    <output data-test="events">{{ JSON.stringify(events) }}</output>
    <InvestmentCalculator
      data-test="invalid"
      default-initial-investment="10000"
      :default-duration-years="41"
      :default-annual-return="7.05"
      @result-change="invalidEvents.push($event)"
    />
    <output data-test="invalid-events">{{ JSON.stringify(invalidEvents) }}</output>
    <InvestmentCalculator
      data-test="maximum"
      :default-initial-investment="1_000_000_000"
      :default-monthly-contribution="1_000_000_000"
      :default-duration-years="40"
      :default-annual-return="15"
    />
  </main>
</template>

<style scoped>
.public-checks {
  display: grid;
  max-width: 64rem;
  margin: auto;
  gap: 1.5rem;
}

.public-checks h1,
.public-checks output {
  overflow-wrap: anywhere;
}

.public-checks__settings {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.public-checks__settings label {
  display: grid;
  gap: 0.5rem;
}

.public-checks__settings select,
.public-checks__settings button {
  min-height: 44px;
}
</style>
