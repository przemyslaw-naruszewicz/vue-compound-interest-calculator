// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import InvestmentForm from './InvestmentForm.vue'
import InvestmentFormHost from '../../../../tests/fixtures/InvestmentFormHost.vue'
import {
  DEFAULT_INVESTMENT_PARAMETERS,
  INVESTMENT_CONSTRAINTS,
} from '../domain/investmentConstraints.js'

const defaultProps = {
  initialInvestmentDraft: '10000', monthlyContributionDraft: '500',
  durationYears: 10, annualReturn: 7, errors: {},
}

function control(wrapper, field) {
  return wrapper.get(`input[id$="-${field}"]`)
}

function descriptions(wrapper, input) {
  return input.attributes('aria-describedby').split(' ').map((id) => (
    wrapper.get(`[id="${id}"]`).text()
  ))
}

test('labels all four default controls, associates help, and reuses slider constraints', () => {
  const wrapper = mount(InvestmentFormHost)
  expect(wrapper.get('legend').text()).toBe('Investment parameters')
  expect(wrapper.findAll('input')).toHaveLength(4)
  expect(wrapper.find('form').exists()).toBe(false)
  expect(wrapper.find('button').exists()).toBe(false)

  const labels = [
    ['initialInvestment', 'Initial investment (PLN)', '10000'],
    ['monthlyContribution', 'Monthly contribution (PLN)', '500'],
    ['durationYears', 'Duration (years)', '10'],
    ['annualReturn', 'Annual nominal return (%)', '7'],
  ]
  for (const [field, label, value] of labels) {
    const input = control(wrapper, field)
    expect(wrapper.get(`label[for="${input.attributes('id')}"]`).text()).toBe(label)
    expect(input.element.value).toBe(value)
    expect(input.attributes('aria-invalid')).toBe('false')
    expect(descriptions(wrapper, input)).toHaveLength(1)
    if (field === 'durationYears' || field === 'annualReturn') {
      expect(input.attributes('type')).toBe('range')
      for (const attribute of ['min', 'max', 'step']) {
        expect(input.attributes(attribute)).toBe(String(INVESTMENT_CONSTRAINTS[field][attribute]))
      }
    } else {
      expect(input.attributes('type')).toBe('text')
      expect(input.attributes('inputmode')).toBe('decimal')
      expect(descriptions(wrapper, input)[0]).toContain('dot or comma')
      expect(descriptions(wrapper, input)[0]).toContain('without grouping separators')
    }
  }
  expect(control(wrapper, 'durationYears').attributes('aria-valuetext')).toBe('10 years')
  expect(control(wrapper, 'annualReturn').attributes('aria-valuetext')).toBe('7%')
  expect(wrapper.text()).toContain('10 years')
  expect(wrapper.text()).toContain('7%')
})

test.each([
  ['initialInvestment', 'initialInvestmentDraft', ' 1,000.00 '],
  ['monthlyContribution', 'monthlyContributionDraft', '1.'],
  ['durationYears', 'durationYears', '11'],
  ['annualReturn', 'annualReturn', '7.1'],
])('emits explicit %s edits without mutating incoming values', async (field, prop, text) => {
  const props = Object.freeze({ ...defaultProps, errors: Object.freeze({}) })
  const wrapper = mount(InvestmentForm, { props })
  expect(wrapper.emitted()).toEqual({})
  await control(wrapper, field).setValue(text)
  const value = prop.endsWith('Draft') ? text : Number(text)
  expect(wrapper.emitted(`update:${prop}`)).toEqual([[value]])
  expect(wrapper.props(prop)).toBe(defaultProps[prop])
  expect(props).toEqual(defaultProps)
})

describe.each(['initialInvestment', 'monthlyContribution'])('%s validation', (field) => {
  test.each([
    ['', 'enter an amount, or 0 for none.'],
    ['1.', 'use digits and up to two decimal places'],
    ['1 000', 'no grouping separators'],
    ['1,000.00', 'no grouping separators'],
    ['1000000000.01', 'enter an amount from 0 to 1000000000'],
  ])('preserves %j with an associated corrective error, then recovers', async (draft, message) => {
    const wrapper = mount(InvestmentFormHost)
    const input = control(wrapper, field)
    const otherField = field === 'initialInvestment' ? 'monthlyContribution' : 'initialInvestment'
    const otherDraft = control(wrapper, otherField).element.value
    await input.setValue(draft)

    expect(input.element.value).toBe(draft)
    expect(input.attributes('aria-invalid')).toBe('true')
    const [help, error] = descriptions(wrapper, input)
    expect(help).toContain('dot or comma')
    expect(error).toContain(field === 'initialInvestment' ? 'Initial investment:' : 'Monthly contribution:')
    expect(error).toContain(message)
    expect(wrapper.get('[data-test="validity"]').text()).toContain('Unavailable')
    expect(control(wrapper, otherField).element.value).toBe(otherDraft)

    await input.setValue(' 1000,50 ')
    expect(input.element.value).toBe(' 1000,50 ')
    expect(input.attributes('aria-invalid')).toBe('false')
    expect(descriptions(wrapper, input)).toHaveLength(1)
    expect(wrapper.find('.investment-form__error').exists()).toBe(false)
    expect(JSON.parse(wrapper.get('[data-test="parameters"]').text())[field]).toBe(1000.5)
    expect(wrapper.get('[data-test="validity"]').text()).toBe('Valid parameters')
  })
})

test.each([
  ['durationYears', undefined], ['durationYears', '10'], ['durationYears', 0],
  ['durationYears', 41], ['durationYears', 1.5], ['durationYears', NaN],
  ['annualReturn', undefined], ['annualReturn', null], ['annualReturn', '7'],
  ['annualReturn', -0.1], ['annualReturn', 15.1], ['annualReturn', 7.05],
  ['annualReturn', Infinity],
])('keeps an invalid %s seed (%s) unavailable until explicit adjustment', async (field, value) => {
  const wrapper = mount(InvestmentFormHost, {
    props: { initialParameters: { ...DEFAULT_INVESTMENT_PARAMETERS, [field]: value } },
  })
  const form = wrapper.getComponent(InvestmentForm)
  const input = control(wrapper, field)
  expect(input.attributes('aria-invalid')).toBe('true')
  expect(input.attributes('aria-valuetext')).toContain('Unavailable')
  expect(wrapper.get('[data-test="validity"]').text()).toContain('Unavailable')
  const [help, error] = descriptions(wrapper, input)
  expect(help).toContain('arrow keys')
  expect(error).toContain('choose a value from')
  expect(form.props(field)).toBe(value)
  expect(form.emitted(`update:${field}`)).toBeUndefined()

  await control(wrapper, 'initialInvestment').setValue('20000')
  expect(form.props(field)).toBe(value)
  expect(input.attributes('aria-valuetext')).toContain('Unavailable')
  await input.setValue(String(INVESTMENT_CONSTRAINTS[field].min))
  expect(input.attributes('aria-invalid')).toBe('false')
  expect(input.attributes('aria-valuetext')).toBe(field === 'durationYears' ? '1 year' : '0%')
  expect(wrapper.get('[data-test="validity"]').text()).toBe('Valid parameters')
})

test('associates every error and help with unique stable IDs across two forms', async () => {
  const wrapper = mount({
    components: { InvestmentFormHost },
    setup: () => ({
      invalidParameters: { ...DEFAULT_INVESTMENT_PARAMETERS, durationYears: 41, annualReturn: 7.05 },
    }),
    template: `<div>
      <InvestmentFormHost :initial-parameters="invalidParameters" />
      <InvestmentFormHost :initial-parameters="invalidParameters" />
    </div>`,
  })
  const [first, second] = wrapper.findAllComponents(InvestmentFormHost)
  const initialIds = wrapper.findAll('input').map((input) => input.attributes('id'))
  for (const host of [first, second]) {
    await control(host, 'initialInvestment').setValue('')
    await control(host, 'monthlyContribution').setValue('')
  }
  const ids = wrapper.findAll('[id]').map((element) => element.attributes('id'))
  expect(new Set(ids).size).toBe(ids.length)
  expect(wrapper.findAll('input').map((input) => input.attributes('id'))).toEqual(initialIds)
  for (const input of wrapper.findAll('input')) {
    expect(wrapper.findAll(`label[for="${input.attributes('id')}"]`)).toHaveLength(1)
    expect(descriptions(wrapper, input)).toHaveLength(2)
  }
  await control(first, 'initialInvestment').setValue('25')
  expect(control(second, 'initialInvestment').element.value).toBe('')
})

test('updates currency labels without changing drafts or emitting field updates', async () => {
  const wrapper = mount(InvestmentForm, { props: defaultProps })
  await wrapper.setProps({ currency: 'USD' })
  expect(wrapper.get('label').text()).toBe('Initial investment (USD)')
  expect(control(wrapper, 'initialInvestment').element.value).toBe('10000')
  expect(wrapper.emitted()).toEqual({})
})

test('preserves the focused input through invalid edits and cancels Enter before the host form', async () => {
  const wrapper = mount({
    components: { InvestmentFormHost },
    template: '<form><InvestmentFormHost /><button>Host submit</button></form>',
  }, { attachTo: document.body })
  const input = control(wrapper, 'initialInvestment')
  input.element.focus()
  await input.setValue('1.')
  expect(document.activeElement).toBe(input.element)
  await input.trigger('keydown', { key: 'Enter' })
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  expect(input.element.dispatchEvent(event)).toBe(false)
  expect(event.defaultPrevented).toBe(true)
  expect(wrapper.emitted('keydown')).toBeUndefined()
  await input.setValue('10')
  expect(document.activeElement).toBe(input.element)
})
