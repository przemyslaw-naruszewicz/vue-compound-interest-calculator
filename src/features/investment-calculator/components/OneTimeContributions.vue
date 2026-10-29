<script setup>
import { nextTick, ref, useId } from 'vue'
import OneTimeContributionRow from './OneTimeContributionRow.vue'

const props = defineProps({
  contributions: { type: Array, required: true },
  durationYears: { required: true },
  currency: { type: String, required: true },
})
const emit = defineEmits(['add', 'update', 'remove'])
const headingId = `${useId()}-contributions-heading`
const addButton = ref(null)
const rowComponents = new Map()

function setRowRef(id, instance) {
  if (instance) rowComponents.set(id, instance)
  else rowComponents.delete(id)
}

function disableLeavingRow(element) {
  element.inert = true
}

async function addRow() {
  emit('add')
  await nextTick()
  rowComponents.get(props.contributions.at(-1)?.id)?.focusAmount()
}

async function removeRow(id) {
  const index = props.contributions.findIndex((row) => row.id === id)
  const target = props.contributions[index + 1] || props.contributions[index - 1]
  emit('remove', id)
  await nextTick()
  if (target && rowComponents.has(target.id)) rowComponents.get(target.id).focusAmount()
  else addButton.value?.focus()
}
</script>

<template>
  <section class="one-time-contributions" :aria-labelledby="headingId">
    <h2 :id="headingId">One-time contributions</h2>
    <p>Extra savings are added at the end of the selected investment year and earn interest from the following month.</p>
    <p v-if="!contributions.length">These contributions are optional. Add one if you plan to invest extra savings.</p>
    <TransitionGroup
      name="contribution"
      tag="ul"
      class="one-time-contributions__list"
      @before-leave="disableLeavingRow"
    >
      <OneTimeContributionRow
        v-for="row in contributions"
        :key="row.id"
        :ref="(instance) => setRowRef(row.id, instance)"
        :number="row.id"
        :amount-draft="row.amountDraft"
        :year-draft="row.yearDraft"
        :errors="row.errors"
        :duration-years="durationYears"
        :currency="currency"
        @update="(field, value) => emit('update', row.id, field, value)"
        @remove="removeRow(row.id)"
      />
    </TransitionGroup>
    <button ref="addButton" type="button" class="one-time-contributions__add" @click="addRow">Add contribution</button>
  </section>
</template>

<style scoped>
.one-time-contributions {
  min-width: 0;
  padding: clamp(1rem, 4vw, 1.5rem);
  border: 1px solid #d4e3da;
  border-radius: 1rem;
  background: #fff;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
  line-height: 1.5;
}

p {
  margin: 0 0 1rem;
  color: #4c6259;
  font-size: 0.875rem;
}

.one-time-contributions__list {
  display: grid;
  gap: 1rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

.one-time-contributions__list:empty { margin: 0; }

.contribution-enter-active,
.contribution-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.contribution-enter-from,
.contribution-leave-to {
  opacity: 0;
  transform: translateY(0.375rem);
}

@media (prefers-reduced-motion: reduce) {
  .contribution-enter-active,
  .contribution-leave-active { transition: none; }

  .contribution-enter-from,
  .contribution-leave-to { transform: none; }
}

.one-time-contributions__add {
  max-width: 100%;
  min-height: 44px;
  padding: 0.625rem 1rem;
  border: 1px solid #32694f;
  border-radius: 0.5rem;
  background: #32694f;
  color: #fff;
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}

.one-time-contributions__add:hover { background: #24513c; }
.one-time-contributions__add:focus-visible {
  outline: 3px solid #1d5f49;
  outline-offset: 3px;
}
</style>
