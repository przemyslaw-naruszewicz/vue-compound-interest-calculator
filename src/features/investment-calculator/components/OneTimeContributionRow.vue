<script setup>
import { computed, ref, useId } from 'vue'
import { amountErrorMessage } from '../utils/amountErrorMessage.js'

const props = defineProps({
  number: { type: Number, required: true },
  amountDraft: { type: String, required: true },
  yearDraft: { type: String, required: true },
  durationYears: { required: true },
  currency: { type: String, required: true },
  errors: { type: Object, required: true },
})
const emit = defineEmits(['update', 'remove'])
const amountInput = ref(null)
defineExpose({ focusAmount: () => amountInput.value?.focus() })
const id = useId()
const amountId = `${id}-contribution-amount`
const yearId = `${id}-contribution-year`
const amountError = computed(() => amountErrorMessage(props.errors.amount, `Contribution ${props.number} amount`))
const yearHelp = computed(() => Number.isInteger(props.durationYears) && props.durationYears >= 1
  ? `Choose a whole investment year from 1 to ${props.durationYears}.`
  : 'Choose a valid investment duration first, then a whole year within it.',
)
const yearError = computed(() => props.errors.year ? `Contribution ${props.number} year: ${yearHelp.value}` : '')
</script>

<template>
  <li class="contribution-row">
    <div class="contribution-row__field">
      <label :for="amountId">Contribution {{ number }} amount ({{ currency }})</label>
      <input
        :id="amountId"
        ref="amountInput"
        type="text"
        inputmode="decimal"
        :value="amountDraft"
        :aria-invalid="Boolean(amountError)"
        :aria-describedby="`${amountId}-help${amountError ? ` ${amountId}-error` : ''}`"
        @input="emit('update', 'amountDraft', $event.target.value)"
        @keydown.enter.prevent.stop
      >
      <p :id="`${amountId}-help`" class="contribution-row__help">
        Use a dot or comma for decimals, without grouping separators. Enter 0 for none.
      </p>
      <p v-if="amountError" :id="`${amountId}-error`" class="contribution-row__error">{{ amountError }}</p>
    </div>
    <div class="contribution-row__field">
      <label :for="yearId">Contribution {{ number }} investment year</label>
      <input
        :id="yearId"
        type="text"
        inputmode="numeric"
        :value="yearDraft"
        :aria-invalid="Boolean(yearError)"
        :aria-describedby="`${yearId}-help${yearError ? ` ${yearId}-error` : ''}`"
        @input="emit('update', 'yearDraft', $event.target.value)"
        @keydown.enter.prevent.stop
      >
      <p :id="`${yearId}-help`" class="contribution-row__help">{{ yearHelp }}</p>
      <p v-if="yearError" :id="`${yearId}-error`" class="contribution-row__error">{{ yearError }}</p>
    </div>
    <button type="button" :aria-label="`Remove contribution ${number}`" @click="emit('remove')">Remove</button>
  </li>
</template>

<style scoped>
.contribution-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid #d4e3da;
  border-radius: 0.75rem;
  background: #f3f7f4;
}

.contribution-row__field {
  display: flex;
  flex: 1 1 12rem;
  min-width: 0;
  flex-direction: column;
  gap: 0.5rem;
}

label { font-weight: 650; }

input,
button {
  min-width: 0;
  min-height: 44px;
  padding: 0.625rem 0.75rem;
  border: 1px solid #637a70;
  border-radius: 0.5rem;
  background: #fff;
  color: #183c32;
  font: inherit;
}

input { width: 100%; }
input[aria-invalid='true'] { border-color: #a12727; }
button { cursor: pointer; }
button:hover { background: #e3eee6; }

input:focus-visible,
button:focus-visible {
  outline: 3px solid #1d5f49;
  outline-offset: 3px;
}

.contribution-row__help,
.contribution-row__error {
  margin: 0;
  font-size: 0.875rem;
}

.contribution-row__help { color: #4c6259; }
.contribution-row__error { color: #a12727; font-weight: 600; }

@media (max-width: 480px) {
  .contribution-row__field { flex-basis: 100%; }
}
</style>
