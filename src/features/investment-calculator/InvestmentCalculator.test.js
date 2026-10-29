// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { expect, test, vi } from 'vitest'
import * as publicApi from '../../index.js'
import { InvestmentCalculator } from '../../index.js'
import { calculateInvestment } from './domain/calculateInvestment.js'
import { DEFAULT_INVESTMENT_PARAMETERS } from './domain/investmentConstraints.js'

const control = (wrapper, field) => wrapper.get(`input[id$="-${field}"]`)
const notifications = (wrapper) => wrapper.emitted('result-change').map(([payload]) => payload)
const customProps = Object.freeze({
  defaultInitialInvestment: 1234.56, defaultMonthlyContribution: 78.91,
  defaultDurationYears: 3, defaultAnnualReturn: 4.2,
})
const customParameters = {
  initialInvestment: 1234.56, monthlyContribution: 78.91, durationYears: 3, annualReturn: 4.2,
}

test('exports only the component and delivers exactly one initial result to a parent listener', async () => {
  expect(Object.keys(publicApi)).toEqual(['InvestmentCalculator'])
  const listener = vi.fn()
  const wrapper = mount({
    components: { InvestmentCalculator },
    setup: () => ({ listener }),
    template: '<InvestmentCalculator @result-change="listener" />',
  })
  const calculator = wrapper.getComponent(InvestmentCalculator)
  await nextTick()
  expect(listener).toHaveBeenCalledExactlyOnceWith(calculateInvestment(DEFAULT_INVESTMENT_PARAMETERS))
  expect(notifications(calculator)).toHaveLength(1)
  expect(calculator.findAll('dd')).toHaveLength(3)
  for (const [field, value] of Object.entries(DEFAULT_INVESTMENT_PARAMETERS)) {
    expect(control(calculator, field).element.value).toBe(String(value))
  }
})

test('initializes custom props without mutation and emits unrounded plain numbers', () => {
  const wrapper = mount(InvestmentCalculator, { props: customProps })
  const [payload] = notifications(wrapper)
  expect(payload).toEqual(calculateInvestment(customParameters))
  expect(Object.getPrototypeOf(payload)).toBe(Object.prototype)
  expect(payload.finalValue).not.toBe(Number(payload.finalValue.toFixed(2)))
  expect(wrapper.props()).toMatchObject(customProps)
  for (const [field, value] of Object.entries(customParameters)) {
    expect(control(wrapper, field).element.value).toBe(String(value))
  }
})

test.each([
  ['defaultInitialInvestment', 'initialInvestment', '10000'],
  ['defaultInitialInvestment', 'initialInvestment', null],
  ['defaultInitialInvestment', 'initialInvestment', -1],
  ['defaultInitialInvestment', 'initialInvestment', 1.001],
  ['defaultInitialInvestment', 'initialInvestment', NaN],
  ['defaultMonthlyContribution', 'monthlyContribution', '500'],
  ['defaultMonthlyContribution', 'monthlyContribution', 1_000_000_000.01],
  ['defaultMonthlyContribution', 'monthlyContribution', Infinity],
  ['defaultDurationYears', 'durationYears', '10'],
  ['defaultDurationYears', 'durationYears', null],
  ['defaultDurationYears', 'durationYears', 41],
  ['defaultDurationYears', 'durationYears', 1.5],
  ['defaultDurationYears', 'durationYears', NaN],
  ['defaultAnnualReturn', 'annualReturn', '7'],
  ['defaultAnnualReturn', 'annualReturn', null],
  ['defaultAnnualReturn', 'annualReturn', -0.1],
  ['defaultAnnualReturn', 'annualReturn', 7.05],
  ['defaultAnnualReturn', 'annualReturn', Infinity],
])('keeps invalid %s (%s: %s) unavailable until explicitly edited', async (prop, field, value) => {
  const listener = vi.fn()
  const wrapper = mount(InvestmentCalculator, {
    props: { [prop]: value, onResultChange: listener },
    global: { config: { warnHandler: () => {} } },
  })
  const input = control(wrapper, field)
  expect(notifications(wrapper)).toEqual([null])
  expect(listener).toHaveBeenCalledExactlyOnceWith(null)
  expect(input.attributes('aria-invalid')).toBe('true')
  expect(wrapper.find('.investment-form__error').exists()).toBe(true)
  expect(wrapper.find('dd').exists()).toBe(false)
  expect(wrapper.find('.investment-breakdown').exists()).toBe(false)
  expect(wrapper.text()).toContain('Results unavailable')
  await control(wrapper, field === 'initialInvestment' ? 'monthlyContribution' : 'initialInvestment').setValue('200')
  expect(notifications(wrapper)).toEqual([null])
  await wrapper.setProps({ [prop]: DEFAULT_INVESTMENT_PARAMETERS[field] })
  expect(input.attributes('aria-invalid')).toBe('true')
  expect(notifications(wrapper)).toEqual([null])
  await input.setValue(String(DEFAULT_INVESTMENT_PARAMETERS[field]))
  expect(input.attributes('aria-invalid')).toBe('false')
  expect(notifications(wrapper)).toHaveLength(2)
  expect(notifications(wrapper)[1]).not.toBeNull()
  expect(wrapper.findAll('dd')).toHaveLength(3)
})

test('delivers the complete normalized valid/invalid event sequence without duplicate drafts', async () => {
  const wrapper = mount(InvestmentCalculator)
  const monthly = control(wrapper, 'monthlyContribution')
  const initial = control(wrapper, 'initialInvestment')
  const original = notifications(wrapper)[0]
  for (const draft of ['500.00', '500,00', ' 500 ']) {
    await monthly.setValue(draft)
  }
  expect(notifications(wrapper)).toEqual([original])
  await monthly.setValue('501')
  const changed = calculateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, monthlyContribution: 501 })
  expect(notifications(wrapper)).toEqual([original, changed])
  await initial.setValue('1.')
  expect(notifications(wrapper)).toEqual([original, changed, null])
  await initial.setValue('')
  await monthly.setValue('')
  await initial.setValue('10000')
  expect(notifications(wrapper)).toEqual([original, changed, null])
  await monthly.setValue('501.00')
  const restored = notifications(wrapper)[3]
  expect(notifications(wrapper)).toEqual([original, changed, null, changed])
  expect(restored).not.toBe(notifications(wrapper)[1])
})

test('emits for changed valid parameters even when all financial outputs remain zero', async () => {
  const wrapper = mount(InvestmentCalculator, {
    props: { defaultInitialInvestment: 0, defaultMonthlyContribution: 0 },
  })
  const zero = { investedCapital: 0, finalValue: 0, investmentGain: 0 }
  await control(wrapper, 'durationYears').setValue('11')
  await control(wrapper, 'annualReturn').setValue('8')
  expect(notifications(wrapper)).toEqual([zero, zero, zero])
  expect(new Set(notifications(wrapper)).size).toBe(3)
})

test('coalesces synchronous edits into a single notification for their final state', async () => {
  const wrapper = mount(InvestmentCalculator)
  for (const [field, value] of Object.entries(customParameters)) {
    const input = control(wrapper, field).element
    input.value = String(value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  await nextTick()
  expect(notifications(wrapper)).toEqual([
    calculateInvestment(DEFAULT_INVESTMENT_PARAMETERS), calculateInvestment(customParameters),
  ])
})

test('reads default props once, preserves local edits, and resets only on keyed remount', async () => {
  const wrapper = mount({
    components: { InvestmentCalculator },
    props: ['seed', 'instanceKey'],
    template: '<InvestmentCalculator :key="instanceKey" v-bind="seed" />',
  }, { props: { seed: {}, instanceKey: 0 } })
  const calculator = wrapper.getComponent(InvestmentCalculator)
  await control(calculator, 'initialInvestment').setValue('321,50')
  const before = notifications(calculator).slice()
  await wrapper.setProps({ seed: customProps })
  expect(control(calculator, 'initialInvestment').element.value).toBe('321,50')
  expect(control(calculator, 'monthlyContribution').element.value).toBe('500')
  expect(control(calculator, 'durationYears').element.value).toBe('10')
  expect(control(calculator, 'annualReturn').element.value).toBe('7')
  expect(notifications(calculator)).toEqual(before)
  await wrapper.setProps({ instanceKey: 1 })
  const remounted = wrapper.getComponent(InvestmentCalculator)
  expect(remounted.vm).not.toBe(calculator.vm)
  expect(notifications(remounted)).toEqual([calculateInvestment(customParameters)])
})

test('keeps formatting reactive without changing drafts, calculations, or notifications', async () => {
  const wrapper = mount(InvestmentCalculator)
  await control(wrapper, 'initialInvestment').setValue('1234,56')
  await control(wrapper, 'monthlyContribution').setValue('78.91')
  const before = notifications(wrapper).slice()
  const payload = before.at(-1)
  for (const [locale, currency, effectiveLocale, effectiveCurrency] of [
    ['en-US', 'USD', 'en-US', 'USD'], ['ja-JP', 'JPY', 'ja-JP', 'JPY'],
    ['bad_locale', 'USD', 'pl-PL', 'USD'], ['en-US', 'bad', 'en-US', 'PLN'],
    ['bad_locale', 'bad', 'pl-PL', 'PLN'],
  ]) {
    await wrapper.setProps({ locale, currency })
    expect(control(wrapper, 'initialInvestment').element.value).toBe('1234,56')
    expect(control(wrapper, 'monthlyContribution').element.value).toBe('78.91')
    expect(wrapper.get('label').text()).toBe(`Initial investment (${effectiveCurrency})`)
    expect(wrapper.get('dd').text()).toBe(new Intl.NumberFormat(effectiveLocale, {
      style: 'currency', currency: effectiveCurrency,
    }).format(payload.finalValue))
    expect(notifications(wrapper)).toEqual(before)
    const notice = wrapper.find('.investment-summary__notice')
    expect(notice.exists()).toBe(locale === 'bad_locale' || currency === 'bad')
    if (locale === 'bad_locale') expect(notice.text()).toContain('Using pl-PL')
    if (currency === 'bad') expect(notice.text()).toContain('Using PLN')
  }
  await control(wrapper, 'monthlyContribution').setValue('78.92')
  expect(notifications(wrapper).at(-1)).toEqual(calculateInvestment({
    ...DEFAULT_INVESTMENT_PARAMETERS, initialInvestment: 1234.56, monthlyContribution: 78.92,
  }))
})

test('isolates internal and displayed results from a parent mutating every payload', async () => {
  const received = []
  const wrapper = mount({
    components: { InvestmentCalculator },
    setup: () => ({
      mutate(payload) {
        received.push({ ...payload })
        payload.finalValue = -1
        payload.investedCapital = -2
        payload.investmentGain = -3
      },
    }),
    template: '<InvestmentCalculator @result-change="mutate" />',
  })
  const formatter = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })
  expect(wrapper.get('dd').text()).toBe(formatter.format(received[0].finalValue))
  await control(wrapper, 'initialInvestment').setValue('20000')
  expect(received[1]).toEqual(calculateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, initialInvestment: 20000 }))
  expect(wrapper.get('dd').text()).toBe(formatter.format(received[1].finalValue))
  expect(wrapper.find('.investment-breakdown').exists()).toBe(true)
})

test('announces validity transitions politely without making the results a live region', async () => {
  const wrapper = mount(InvestmentCalculator)
  const status = wrapper.get('.investment-calculator__status')
  expect(status.attributes()).toMatchObject({
    role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true',
  })
  expect(status.text()).toBe('Projection available.')
  await control(wrapper, 'initialInvestment').setValue('20000')
  expect(status.text()).toBe('Projection available.')
  await control(wrapper, 'initialInvestment').setValue('1.')
  expect(status.text()).toContain('Projection unavailable. Correct the highlighted investment parameters.')
  const message = status.text()
  await control(wrapper, 'initialInvestment').setValue('')
  expect(status.text()).toBe(message)
  await control(wrapper, 'initialInvestment').setValue('20000')
  expect(status.text()).toBe('Projection available.')
  expect(wrapper.get('.investment-calculator__status').element).toBe(status.element)
  expect(wrapper.get('.investment-summary').attributes('aria-live')).toBeUndefined()
  expect(wrapper.find('[aria-live="assertive"], [role="alert"]').exists()).toBe(false)
})

test('includes financial assumptions in every independent instance without a page heading', async () => {
  const wrapper = mount({
    components: { InvestmentCalculator },
    template: '<div><InvestmentCalculator /><InvestmentCalculator /></div>',
  })
  const [first, second] = wrapper.findAllComponents(InvestmentCalculator)
  for (const calculator of [first, second]) {
    expect(calculator.find('h1').exists()).toBe(false)
    const explanation = calculator.get('.investment-calculator__assumptions').text()
    for (const text of [
      'constant nominal annual return', 'compounded monthly', 'contributions at month-end',
      'Excludes taxes, fees and inflation', 'Actual returns vary and may be negative',
    ]) expect(explanation).toContain(text)
  }
  const ids = wrapper.findAll('[id]').map((element) => element.attributes('id'))
  expect(new Set(ids).size).toBe(ids.length)
  await control(first, 'initialInvestment').setValue('')
  expect(notifications(first).at(-1)).toBeNull()
  expect(second.findAll('dd')).toHaveLength(3)
  expect(control(second, 'initialInvestment').element.value).toBe('10000')
  expect(notifications(second)).toHaveLength(1)
})

test('keeps a labelled investment disclaimer before results through invalid, zero and recovered states', async () => {
  const wrapper = mount(InvestmentCalculator)
  const disclaimer = wrapper.get('aside')
  const checkDisclaimer = () => {
    expect(disclaimer.isVisible()).toBe(true)
    expect(disclaimer.get('h2').text()).toBe('Not investment advice')
    expect(disclaimer.attributes('aria-labelledby')).toBe(disclaimer.get('h2').attributes('id'))
    expect(disclaimer.get('p').text()).toBe(
      'This calculator is for illustrative purposes only and does not constitute investment advice. Results are not guaranteed.',
    )
    expect(disclaimer.element.nextElementSibling).toBe(wrapper.get('.investment-summary').element)
    expect(wrapper.find('details, dialog, [role="alert"], aside[aria-live]').exists()).toBe(false)
  }

  checkDisclaimer()
  await control(wrapper, 'initialInvestment').setValue('')
  expect(wrapper.find('dd').exists()).toBe(false)
  checkDisclaimer()
  await control(wrapper, 'initialInvestment').setValue('0')
  await control(wrapper, 'monthlyContribution').setValue('0')
  expect(notifications(wrapper).at(-1)).toEqual({
    investedCapital: 0, finalValue: 0, investmentGain: 0,
  })
  checkDisclaimer()
  await control(wrapper, 'initialInvestment').setValue('10000')
  expect(wrapper.findAll('dd')).toHaveLength(3)
  checkDisclaimer()
})
