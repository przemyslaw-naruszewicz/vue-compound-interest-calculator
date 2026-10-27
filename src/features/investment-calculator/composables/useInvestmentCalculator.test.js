import { reactive } from 'vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { calculateInvestment } from '../domain/calculateInvestment.js'
import {
  DEFAULT_INVESTMENT_PARAMETERS,
  INVESTMENT_CONSTRAINTS,
} from '../domain/investmentConstraints.js'
import { validateInvestment } from '../domain/validateInvestment.js'
import { useInvestmentCalculator } from './useInvestmentCalculator.js'

vi.mock('../domain/calculateInvestment.js', { spy: true })

beforeEach(() => vi.clearAllMocks())

const amountFields = ['initialInvestment', 'monthlyContribution']
const sliderFields = ['durationYears', 'annualReturn']

function expectInvalid(calculator, errors) {
  expect(calculator.errors.value).toEqual(errors)
  expect(calculator.isValid.value).toBe(false)
  expect(calculator.result.value).toBeNull()
}

test('initializes defaults and derives the unrounded reference result', () => {
  const calculator = useInvestmentCalculator()

  expect(calculator.initialInvestmentDraft.value).toBe('10000')
  expect(calculator.monthlyContributionDraft.value).toBe('500')
  expect(calculator.durationYears.value).toBe(10)
  expect(calculator.annualReturn.value).toBe(7)
  expect(calculator.parameters.value).toEqual(DEFAULT_INVESTMENT_PARAMETERS)
  expect(calculator.errors.value).toEqual({})
  expect(calculator.isValid.value).toBe(true)
  expect(calculator.result.value.investedCapital).toBe(70000)
  expect(calculator.result.value.finalValue).toBeCloseTo(106639.0174837243, 6)
  expect(calculator.result.value.investmentGain).toBeCloseTo(36639.0174837243, 6)
})

test('reads a custom seed once without changing or tracking its later updates', () => {
  const seed = reactive({
    initialInvestment: 1000, monthlyContribution: 0, durationYears: 1, annualReturn: 12,
  })
  const calculator = useInvestmentCalculator(seed)

  expect(calculator.result.value.finalValue).toBeCloseTo(1126.825030131970, 6)
  calculator.initialInvestmentDraft.value = '2000,50'
  expect(seed.initialInvestment).toBe(1000)
  seed.initialInvestment = 9000
  seed.durationYears = 40
  expect(calculator.initialInvestmentDraft.value).toBe('2000,50')
  expect(calculator.parameters.value.initialInvestment).toBe(2000.5)
  expect(calculator.durationYears.value).toBe(1)
})

describe.each(amountFields)('%s drafts', (field) => {
  test('clears and recovers immediately while preserving all other inputs', () => {
    const calculator = useInvestmentCalculator()
    calculator.annualReturn.value = 0
    calculator.durationYears.value = 2
    calculator[`${field}Draft`].value = ''

    expect(calculator[`${field}Draft`].value).toBe('')
    expectInvalid(calculator, { [field]: 'required' })
    expect(calculateInvestment).not.toHaveBeenCalled()

    calculator[`${field}Draft`].value = ' 1000,50 '

    expect(calculator[`${field}Draft`].value).toBe(' 1000,50 ')
    expect(calculator.parameters.value).toEqual({
      ...DEFAULT_INVESTMENT_PARAMETERS, [field]: 1000.5, annualReturn: 0, durationYears: 2,
    })
    expect(calculator.errors.value).toEqual({})
    expect(calculator.isValid.value).toBe(true)
    const invested = field === 'initialInvestment' ? 13000.5 : 34012
    expect(calculator.result.value).toEqual({
      investedCapital: invested, finalValue: invested, investmentGain: 0,
    })
  })

  test.each([
    [' ', 'required'], ['1.', 'invalid_format'], ['.5', 'invalid_format'],
    ['1,000.00', 'invalid_format'], ['1 000', 'invalid_format'],
    ['1e3', 'invalid_format'], ['0x10', 'invalid_format'],
    ['+1', 'invalid_format'], ['-1', 'invalid_format'],
    ['1abc', 'invalid_format'], ['1.001', 'invalid_format'],
    ['1000000000.01', 'out_of_range'], ['9'.repeat(400), 'not_finite'],
  ])('preserves invalid text and suppresses calculation: %j', (draft, error) => {
    const calculator = useInvestmentCalculator()
    calculator[`${field}Draft`].value = draft

    expect(calculator[`${field}Draft`].value).toBe(draft)
    expectInvalid(calculator, { [field]: error })
    expect(calculateInvestment).not.toHaveBeenCalled()
  })

  test.each([
    [undefined, 'required'], [null, 'invalid_type'], ['500', 'invalid_type'],
    [true, 'invalid_type'], [[], 'invalid_type'], [NaN, 'not_finite'],
    [Infinity, 'not_finite'], [-1, 'out_of_range'],
    [1_000_000_000.01, 'out_of_range'], [1.001, 'invalid_step'],
  ])('keeps an invalid seed invalid until an explicit edit: %s', (value, error) => {
    const calculator = useInvestmentCalculator({ ...DEFAULT_INVESTMENT_PARAMETERS, [field]: value })

    expectInvalid(calculator, { [field]: error })
    expect(calculateInvestment).not.toHaveBeenCalled()
    calculator.annualReturn.value = 0
    expectInvalid(calculator, { [field]: error })

    // Even the same visible text counts as an explicit user edit.
    calculator[`${field}Draft`].value = '500'
    expect(calculator.parameters.value[field]).toBe(500)
    expect(calculator.isValid.value).toBe(true)
    expect(calculator.result.value).not.toBeNull()
  })
})

test.each([
  ['durationYears', undefined, 'required'], ['durationYears', '10', 'invalid_type'],
  ['durationYears', 0, 'out_of_range'], ['durationYears', 41, 'out_of_range'],
  ['durationYears', 1.5, 'not_integer'], ['durationYears', NaN, 'not_finite'],
  ['annualReturn', undefined, 'required'], ['annualReturn', '7', 'invalid_type'],
  ['annualReturn', null, 'invalid_type'], ['annualReturn', -0.1, 'out_of_range'],
  ['annualReturn', 15.1, 'out_of_range'], ['annualReturn', 7.05, 'invalid_step'],
  ['annualReturn', Infinity, 'not_finite'],
])('preserves an invalid %s seed (%s) until that slider changes', (field, value, error) => {
  const calculator = useInvestmentCalculator({ ...DEFAULT_INVESTMENT_PARAMETERS, [field]: value })
  expect(calculator[field].value).toBe(value)
  expectInvalid(calculator, { [field]: error })
  calculator.initialInvestmentDraft.value = '0'
  expect(calculator[field].value).toBe(value)
  expectInvalid(calculator, { [field]: error })
  expect(calculateInvestment).not.toHaveBeenCalled()

  calculator[field].value = INVESTMENT_CONSTRAINTS[field].min
  expect(calculator.isValid.value).toBe(true)
  expect(calculator.result.value).not.toBeNull()
})

describe.each(Object.keys(INVESTMENT_CONSTRAINTS))('%s limits', (field) => {
  test.each(['min', 'max'])('accepts the inclusive %s on initialization and edit', (boundary) => {
    const value = INVESTMENT_CONSTRAINTS[field][boundary]
    const seeded = useInvestmentCalculator({ ...DEFAULT_INVESTMENT_PARAMETERS, [field]: value })
    const edited = useInvestmentCalculator()
    if (amountFields.includes(field)) edited[`${field}Draft`].value = String(value)
    else edited[field].value = value

    for (const calculator of [seeded, edited]) {
      expect(calculator.parameters.value[field]).toBe(value)
      expect(calculator.errors.value).toEqual({})
      expect(calculator.isValid.value).toBe(true)
      expect(Number.isFinite(calculator.result.value.finalValue)).toBe(true)
    }
  })
})

test.each(sliderFields)('validates %s user updates with the domain rules', (field) => {
  const calculator = useInvestmentCalculator()
  for (const value of [undefined, '7', NaN, -1, 41, 7.05]) {
    calculator[field].value = value
    expectInvalid(calculator, validateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, [field]: value }))
  }
  expect(calculateInvestment).not.toHaveBeenCalled()
})

test('treats missing seed fields as errors instead of merging defaults', () => {
  const calculator = useInvestmentCalculator({ initialInvestment: 0 })
  expectInvalid(calculator, {
    monthlyContribution: 'required', durationYears: 'required', annualReturn: 'required',
  })
  calculator.monthlyContributionDraft.value = '0'
  calculator.durationYears.value = 1
  calculator.annualReturn.value = 0
  expect(calculator.result.value).toEqual({ investedCapital: 0, finalValue: 0, investmentGain: 0 })
})

test('equivalent drafts normalize to the same parameters and result', () => {
  const calculator = useInvestmentCalculator()
  const parameters = { ...calculator.parameters.value }
  const result = { ...calculator.result.value }
  calculator.monthlyContributionDraft.value = '500.00'
  expect(calculator.monthlyContributionDraft.value).toBe('500.00')
  expect(calculator.parameters.value).toEqual(parameters)
  expect(calculator.result.value).toEqual(result)
})

test('zero amounts and return are valid while empty input is required', () => {
  const calculator = useInvestmentCalculator()
  calculator.initialInvestmentDraft.value = '0'
  calculator.monthlyContributionDraft.value = '0,00'
  calculator.annualReturn.value = 0
  expect(calculator.isValid.value).toBe(true)
  expect(calculator.result.value).toEqual({ investedCapital: 0, finalValue: 0, investmentGain: 0 })
  calculator.initialInvestmentDraft.value = ''
  expectInvalid(calculator, { initialInvestment: 'required' })
})

test('two invocations own independent drafts, sliders, errors, and results', () => {
  const seed = Object.freeze({ ...DEFAULT_INVESTMENT_PARAMETERS })
  const first = useInvestmentCalculator(seed)
  const second = useInvestmentCalculator(seed)
  const secondResult = { ...second.result.value }
  first.initialInvestmentDraft.value = ''
  first.monthlyContributionDraft.value = '250,25'
  first.durationYears.value = 40
  first.annualReturn.value = 0

  expectInvalid(first, { initialInvestment: 'required' })
  expect(second.initialInvestmentDraft.value).toBe('10000')
  expect(second.monthlyContributionDraft.value).toBe('500')
  expect(second.parameters.value).toEqual(seed)
  expect(second.errors.value).toEqual({})
  expect(second.isValid.value).toBe(true)
  expect(second.result.value).toEqual(secondResult)

  first.initialInvestmentDraft.value = '0'
  expect(first.result.value).toEqual({ investedCapital: 120120, finalValue: 120120, investmentGain: 0 })
  expect(second.result.value).toEqual(secondResult)
})

test('never sends invalid inputs to the financial function across edit transitions', () => {
  const calculator = useInvestmentCalculator()
  expect(calculator.result.value).not.toBeNull()
  calculator.initialInvestmentDraft.value = '1.'
  expect(calculator.result.value).toBeNull()
  calculator.monthlyContributionDraft.value = ''
  calculator.initialInvestmentDraft.value = '0'
  expect(calculator.result.value).toBeNull()
  calculator.monthlyContributionDraft.value = '100,50'
  expect(calculator.result.value).not.toBeNull()
  calculator.annualReturn.value = 7.05
  expect(calculator.result.value).toBeNull()
  calculator.annualReturn.value = 0.1
  expect(calculator.result.value).not.toBeNull()

  for (const [parameters] of calculateInvestment.mock.calls) {
    expect(validateInvestment(parameters)).toEqual({})
    expect(Object.values(parameters).every((value) => typeof value === 'number')).toBe(true)
  }
})
