// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { expect, test } from 'vitest'
import { InvestmentCalculator } from '../../index.js'
import { calculateInvestment } from './domain/calculateInvestment.js'
import { DEFAULT_INVESTMENT_PARAMETERS } from './domain/investmentConstraints.js'
import OneTimeContributions from './components/OneTimeContributions.vue'

const rows = (wrapper) => wrapper.findAll('.contribution-row')
const amount = (row) => row.get('input[inputmode="decimal"]')
const year = (row) => row.get('input[inputmode="numeric"]')
const events = (wrapper) => wrapper.emitted('result-change').map(([payload]) => payload)
const add = (wrapper) => wrapper.get('.one-time-contributions__add').trigger('click')

test('edits and removes multiple rows without losing values, errors, IDs or labels', async () => {
  const wrapper = mount(InvestmentCalculator)
  expect(wrapper.text()).toContain('These contributions are optional')
  await add(wrapper)
  const first = rows(wrapper)[0]
  expect(amount(first).element.value).toBe('')
  expect(year(first).element.value).toBe('1')
  expect(amount(first).attributes('aria-invalid')).toBe('true')
  await amount(first).setValue('100,50')
  await add(wrapper)
  const second = rows(wrapper)[1]
  const secondElement = second.element
  const secondId = amount(second).attributes('id')
  await amount(second).setValue('1.')
  await year(second).setValue('11')
  await first.get('button').trigger('click')
  const remaining = rows(wrapper)[0]
  expect(remaining.element).toBe(secondElement)
  expect(amount(remaining).attributes('id')).toBe(secondId)
  expect(amount(remaining).element.value).toBe('1.')
  expect(year(remaining).element.value).toBe('11')
  for (const input of remaining.findAll('input')) {
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(remaining.find(`label[for="${input.attributes('id')}"]`).exists()).toBe(true)
    for (const id of input.attributes('aria-describedby').split(' ')) {
      expect(remaining.get(`[id="${id}"]`).text()).not.toBe('')
    }
  }
  await amount(remaining).setValue('1000000000')
  await year(remaining).setValue('10')
  const expected = calculateInvestment({
    ...DEFAULT_INVESTMENT_PARAMETERS, oneTimeContributions: [{ year: 10, amount: 1e9 }],
  })
  expect(events(wrapper).at(-1)).toEqual(expected)
  expect(wrapper.findAll('dd')).toHaveLength(3)
  expect(wrapper.find('.investment-breakdown').exists()).toBe(true)
  await remaining.get('button').trigger('click')
  expect(rows(wrapper)).toHaveLength(0)
  expect(events(wrapper).at(-1)).toEqual(calculateInvestment(DEFAULT_INVESTMENT_PARAMETERS))
})

test('deduplicates equivalent drafts and invalid events, and emits unchanged-total edits', async () => {
  const wrapper = mount(InvestmentCalculator, { props: { defaultAnnualReturn: 0 } })
  const original = events(wrapper)[0]
  await add(wrapper)
  expect(events(wrapper)).toEqual([original, null])
  const row = rows(wrapper)[0]
  await amount(row).setValue('1.')
  await year(row).setValue('')
  await year(row).setValue('1')
  expect(events(wrapper)).toEqual([original, null])
  await amount(row).setValue('0')
  expect(events(wrapper)).toEqual([original, null, original])
  for (const draft of ['0.00', '0,00', ' 0 ']) await amount(row).setValue(draft)
  expect(events(wrapper)).toHaveLength(3)
  await year(row).setValue('2')
  expect(events(wrapper)).toHaveLength(4)
  await row.get('button').trigger('click')
  expect(events(wrapper)).toHaveLength(5)
  expect(events(wrapper).every((value) => value === null || value.finalValue === original.finalValue)).toBe(true)
  expect(new Set(events(wrapper).filter(Boolean)).size).toBe(4)
})

test('batches synchronous contribution edits and isolates every delivered payload', async () => {
  const received = []
  const wrapper = mount(InvestmentCalculator, { props: {
    onResultChange(payload) {
      received.push(payload && { ...payload })
      if (payload) payload.finalValue = -1
    },
  } })
  await add(wrapper)
  const row = rows(wrapper)[0]
  for (const [input, value] of [[amount(row), '1000,50'], [year(row), '10']]) {
    input.element.value = value
    input.element.dispatchEvent(new Event('input', { bubbles: true }))
  }
  await nextTick()
  expect(received).toHaveLength(3)
  const expected = calculateInvestment({
    ...DEFAULT_INVESTMENT_PARAMETERS, oneTimeContributions: [{ year: 10, amount: 1000.5 }],
  })
  expect(received.at(-1)).toEqual(expected)
  expect(wrapper.get('dd').text()).toBe(new Intl.NumberFormat('pl-PL', {
    style: 'currency', currency: 'PLN',
  }).format(expected.finalValue))
})

test('detects list edits with equal totals while excluding row IDs from change detection', async () => {
  const wrapper = mount(InvestmentCalculator, { props: { defaultAnnualReturn: 0 } })
  const editor = wrapper.getComponent(OneTimeContributions)
  editor.vm.$emit('add')
  editor.vm.$emit('update', 1, 'amountDraft', '100')
  await nextTick()
  expect(events(wrapper)).toHaveLength(2)
  expect(events(wrapper).at(-1).investedCapital).toBe(70100)

  editor.vm.$emit('add')
  editor.vm.$emit('update', 2, 'amountDraft', '0')
  await nextTick()
  expect(events(wrapper)).toHaveLength(3)
  expect(events(wrapper)[1]).toEqual(events(wrapper)[2])
  editor.vm.$emit('update', 1, 'amountDraft', '50')
  editor.vm.$emit('update', 2, 'amountDraft', '50')
  await nextTick()
  expect(events(wrapper)).toHaveLength(4)
  expect(events(wrapper)[2]).toEqual(events(wrapper)[3])

  editor.vm.$emit('remove', 2)
  editor.vm.$emit('add')
  editor.vm.$emit('update', 3, 'amountDraft', '50,00')
  await nextTick()
  expect(events(wrapper)).toHaveLength(4)
  expect(editor.props('contributions').map((row) => row.id)).toEqual([1, 3])
})

test('shorter durations hide results and extending restores preserved rows', async () => {
  const wrapper = mount(InvestmentCalculator)
  await add(wrapper)
  const row = rows(wrapper)[0]
  await amount(row).setValue('12.34')
  await year(row).setValue('10')
  await wrapper.get('input[type="range"][id$="-durationYears"]').setValue('9')
  expect(year(row).element.value).toBe('10')
  expect(year(row).attributes('aria-invalid')).toBe('true')
  expect(wrapper.find('dd').exists()).toBe(false)
  expect(events(wrapper).at(-1)).toBeNull()
  await wrapper.get('input[type="range"][id$="-durationYears"]').setValue('10')
  expect(amount(row).element.value).toBe('12.34')
  expect(year(row).attributes('aria-invalid')).toBe('false')
  expect(wrapper.findAll('dd')).toHaveLength(3)
})

test('isolates lists, IDs, errors and events, preserves drafts across prop changes, and clears on remount', async () => {
  const wrapper = mount({
    components: { InvestmentCalculator },
    props: ['instanceKey', 'currency', 'duration'],
    template: `<div><InvestmentCalculator :key="instanceKey" :currency="currency"
      :default-duration-years="duration" /><InvestmentCalculator /></div>`,
  }, { props: { instanceKey: 0, currency: 'PLN', duration: 10 } })
  const [first, second] = wrapper.findAllComponents(InvestmentCalculator)
  await add(first)
  await amount(rows(first)[0]).setValue('25,50')
  await add(second)
  expect(events(second)).toHaveLength(2)
  expect(events(second).at(-1)).toBeNull()
  expect(events(first).at(-1)).not.toBeNull()
  const before = events(first).slice()
  await wrapper.setProps({ currency: 'USD', duration: 1 })
  expect(amount(rows(first)[0]).element.value).toBe('25,50')
  expect(rows(first)[0].text()).toContain('amount (USD)')
  expect(events(first)).toEqual(before)
  const ids = wrapper.findAll('[id]').map((node) => node.attributes('id'))
  expect(new Set(ids).size).toBe(ids.length)
  await wrapper.setProps({ instanceKey: 1 })
  expect(rows(wrapper.findAllComponents(InvestmentCalculator)[0])).toHaveLength(0)
  expect(rows(second)).toHaveLength(1)
})

test('focuses new amounts and the next, previous or add control after removal', async () => {
  const wrapper = mount(InvestmentCalculator, { attachTo: document.body })
  try {
    for (let index = 0; index < 3; index += 1) {
      await add(wrapper)
      expect(document.activeElement).toBe(amount(rows(wrapper).at(-1)).element)
    }
    const [first, middle, last] = rows(wrapper)
    await middle.get('button').trigger('click')
    expect(document.activeElement).toBe(amount(last).element)
    await last.get('button').trigger('click')
    expect(document.activeElement).toBe(amount(first).element)
    await first.get('button').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('.one-time-contributions__add').element)
  } finally {
    wrapper.unmount()
  }
})
