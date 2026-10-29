<script setup>
import { computed, useId } from 'vue'
import { INVESTMENT_CONSTRAINTS } from '../domain/investmentConstraints.js'

const props = defineProps({
  initialInvestmentDraft: { type: String, required: true },
  monthlyContributionDraft: { type: String, required: true },
  // Invalid seeds must reach the UI without Vue coercing or replacing them.
  durationYears: { required: true },
  annualReturn: { required: true },
  errors: { type: Object, required: true },
  currency: { type: String, default: 'PLN' },
})

const emit = defineEmits([
  'update:initialInvestmentDraft',
  'update:monthlyContributionDraft',
  'update:durationYears',
  'update:annualReturn',
])

const instanceId = useId()
const amountDefinitions = [
  { field: 'initialInvestment', label: 'Initial investment', draft: 'initialInvestmentDraft' },
  { field: 'monthlyContribution', label: 'Monthly contribution', draft: 'monthlyContributionDraft' },
]
const sliderDefinitions = [
  { field: 'durationYears', label: 'Duration (years)', name: 'Duration', unit: 'years' },
  {
    field: 'annualReturn', label: 'Annual nominal return (%)',
    name: 'Annual nominal return', unit: '%',
  },
]

function fieldIds(field) {
  const id = `${instanceId}-${field}`
  return { id, helpId: `${id}-help`, errorId: `${id}-error` }
}

function amountError(field, label) {
  const code = props.errors[field]
  if (!code) return ''
  if (code === 'required') return `${label}: enter an amount, or 0 for none.`
  if (code === 'out_of_range' || code === 'not_finite') {
    const { min, max } = INVESTMENT_CONSTRAINTS[field]
    return `${label}: enter an amount from ${min} to ${max}, without grouping separators.`
  }
  return `${label}: use digits and up to two decimal places, with a dot or comma and no grouping separators.`
}

const amounts = computed(() => amountDefinitions.map((definition) => {
  const ids = fieldIds(definition.field)
  const error = amountError(definition.field, definition.label)
  return {
    ...definition,
    ...ids,
    label: `${definition.label} (${props.currency})`,
    value: props[definition.draft],
    error,
    describedBy: error ? `${ids.helpId} ${ids.errorId}` : ids.helpId,
  }
}))

const sliders = computed(() => sliderDefinitions.map((definition) => {
  const { field, name, unit } = definition
  const ids = fieldIds(field)
  const { min, max, step } = INVESTMENT_CONSTRAINTS[field]
  const help = `${min}–${max} ${unit}, in steps of ${step}. Use the arrow keys to adjust.`
  const error = props.errors[field]
    ? `${name}: choose a value from ${min} to ${max} ${unit}, in steps of ${step}.`
    : ''
  const valueText = error
    ? 'Unavailable. Choose a value using the slider.'
    : field === 'durationYears'
      ? `${props[field]} ${props[field] === 1 ? 'year' : 'years'}`
      : `${props[field]}%`

  return {
    ...definition, ...ids, min, max, step, help, error, valueText,
    // A native range always has a position; only user input may commit it.
    value: error ? undefined : props[field],
    describedBy: error ? `${ids.helpId} ${ids.errorId}` : ids.helpId,
  }
}))

function updateAmount(draft, event) {
  emit(`update:${draft}`, event.target.value)
}

function updateSlider(field, event) {
  emit(`update:${field}`, event.target.valueAsNumber)
}
</script>

<template>
  <fieldset class="investment-form" @keydown.enter.prevent.stop>
    <legend>Investment parameters</legend>

    <div class="investment-form__fields">
      <div v-for="amount in amounts" :key="amount.field" class="investment-form__field">
        <label :for="amount.id">{{ amount.label }}</label>
        <input
          :id="amount.id"
          type="text"
          inputmode="decimal"
          :value="amount.value"
          :aria-invalid="Boolean(amount.error)"
          :aria-describedby="amount.describedBy"
          @input="updateAmount(amount.draft, $event)"
        >
        <p :id="amount.helpId" class="investment-form__help">
          Use a dot or comma for decimals (e.g. 1000.50 or 1000,50), without grouping separators.
        </p>
        <p v-if="amount.error" :id="amount.errorId" class="investment-form__error">
          {{ amount.error }}
        </p>
      </div>

      <div v-for="slider in sliders" :key="slider.field" class="investment-form__field">
        <label :for="slider.id">{{ slider.label }}</label>
        <span class="investment-form__value">{{ slider.valueText }}</span>
        <input
          :id="slider.id"
          type="range"
          :min="slider.min"
          :max="slider.max"
          :step="slider.step"
          :value="slider.value"
          :aria-valuetext="slider.valueText"
          :aria-invalid="Boolean(slider.error)"
          :aria-describedby="slider.describedBy"
          @input="updateSlider(slider.field, $event)"
        >
        <p :id="slider.helpId" class="investment-form__help">{{ slider.help }}</p>
        <p v-if="slider.error" :id="slider.errorId" class="investment-form__error">
          {{ slider.error }}
        </p>
      </div>
    </div>
  </fieldset>
</template>

<style scoped>
.investment-form,
.investment-form * {
  box-sizing: border-box;
}

.investment-form {
  min-inline-size: 0;
  margin: 0;
  padding: clamp(1rem, 4vw, 1.5rem);
  border: 1px solid #d4e3da;
  border-radius: 1rem;
  background: #fff;
  color: #183c32;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.5;
}

.investment-form legend {
  float: left;
  width: 100%;
  max-width: 100%;
  margin-bottom: 1rem;
  padding: 0;
  font-size: 1.125rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.investment-form__fields {
  clear: both;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.investment-form__field {
  display: flex;
  min-width: min(100%, 16rem);
  flex: 1 1 calc(50% - 0.75rem);
  flex-direction: column;
  gap: 0.5rem;
  overflow-wrap: anywhere;
}

.investment-form label {
  font-weight: 650;
}

.investment-form input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  margin: 0;
  font: inherit;
}

.investment-form input[type='text'] {
  padding: 0.625rem 0.75rem;
  border: 1px solid #637a70;
  border-radius: 0.5rem;
  background: #fff;
  color: #183c32;
}

.investment-form input[type='text'][aria-invalid='true'] {
  border-color: #a12727;
}

.investment-form input[type='range'] {
  padding: 0;
  accent-color: #32694f;
  cursor: pointer;
}

.investment-form input:focus-visible {
  outline: 3px solid #1d5f49;
  outline-offset: 3px;
}

.investment-form__value {
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.investment-form__help,
.investment-form__error {
  margin: 0;
  font-size: 0.875rem;
}

.investment-form__help {
  color: #4c6259;
}

.investment-form__error {
  color: #a12727;
  font-weight: 600;
}
</style>
