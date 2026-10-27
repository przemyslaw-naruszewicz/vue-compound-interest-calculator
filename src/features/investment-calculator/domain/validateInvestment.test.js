import { describe, expect, test } from 'vitest'
import {
  DEFAULT_INVESTMENT_PARAMETERS,
  INVESTMENT_CONSTRAINTS,
} from './investmentConstraints.js'
import { validateInvestment } from './validateInvestment.js'

const fields = Object.keys(INVESTMENT_CONSTRAINTS)
const amountFields = ['initialInvestment', 'monthlyContribution']

test('centralizes immutable defaults and constraints', () => {
  expect(DEFAULT_INVESTMENT_PARAMETERS).toEqual({
    initialInvestment: 10000,
    monthlyContribution: 500,
    durationYears: 10,
    annualReturn: 7,
  })
  expect(Object.isFrozen(DEFAULT_INVESTMENT_PARAMETERS)).toBe(true)
  expect(Object.isFrozen(INVESTMENT_CONSTRAINTS)).toBe(true)
  for (const constraints of Object.values(INVESTMENT_CONSTRAINTS)) {
    expect(Object.isFrozen(constraints)).toBe(true)
  }
  expect(validateInvestment(DEFAULT_INVESTMENT_PARAMETERS)).toEqual({})
})

test.each([undefined, null, [], '', '1000', 1, true, () => {}])(
  'rejects an invalid parameter shape: %s',
  (parameters) => {
    expect(() => validateInvestment(parameters)).toThrow(TypeError)
  },
)

test('reports all missing fields', () => {
  expect(validateInvestment({})).toEqual({
    initialInvestment: 'required',
    monthlyContribution: 'required',
    durationYears: 'required',
    annualReturn: 'required',
  })
})

describe.each(fields)('%s validation', (field) => {
  test('reports a missing field without changing the input', () => {
    const parameters = { ...DEFAULT_INVESTMENT_PARAMETERS }
    delete parameters[field]
    Object.freeze(parameters)

    expect(validateInvestment(parameters)).toEqual({ [field]: 'required' })
    expect(Object.hasOwn(parameters, field)).toBe(false)
  })

  test.each([
    [undefined, 'required'],
    [null, 'invalid_type'],
    ['7', 'invalid_type'],
    ['', 'invalid_type'],
    [true, 'invalid_type'],
    [false, 'invalid_type'],
    [[], 'invalid_type'],
    [{}, 'invalid_type'],
    [new Number(7), 'invalid_type'],
    [7n, 'invalid_type'],
    [Symbol('7'), 'invalid_type'],
    [() => 7, 'invalid_type'],
    [NaN, 'not_finite'],
    [Infinity, 'not_finite'],
    [-Infinity, 'not_finite'],
  ])('rejects %s with %s', (value, code) => {
    const parameters = Object.freeze({ ...DEFAULT_INVESTMENT_PARAMETERS, [field]: value })

    expect(validateInvestment(parameters)).toEqual({ [field]: code })
    expect(parameters[field]).toBe(value)
  })

  test.each(['min', 'max'])('accepts the inclusive %s boundary', (boundary) => {
    expect(validateInvestment({
      ...DEFAULT_INVESTMENT_PARAMETERS,
      [field]: INVESTMENT_CONSTRAINTS[field][boundary],
    })).toEqual({})
  })

  test.each([-1, -0.01])('rejects negative values: %s', (value) => {
    expect(validateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, [field]: value }))
      .toEqual({ [field]: 'out_of_range' })
  })

  test('rejects a value above the upper boundary before checking precision', () => {
    const value = INVESTMENT_CONSTRAINTS[field].max + 0.001
    expect(validateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, [field]: value }))
      .toEqual({ [field]: 'out_of_range' })
  })
})

describe.each(amountFields)('%s precision', (field) => {
  test.each([0, -0, 0.01, 123.45, 146048212.02, 999999999.99])(
    'accepts valid cent amounts: %s',
    (value) => {
      expect(validateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, [field]: value }))
        .toEqual({})
    },
  )

  test.each([0.001, 123.456, 146048212.021, 999999999.999])(
    'rejects excessive precision: %s',
    (value) => {
      expect(validateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, [field]: value }))
        .toEqual({ [field]: 'invalid_step' })
    },
  )
})

test.each([0, -0, 0.1, 7.1, 14.9, 15])('accepts an on-step rate: %s', (annualReturn) => {
  expect(validateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, annualReturn })).toEqual({})
})

test.each([0.01, 7.05, 14.99])('rejects an off-step rate: %s', (annualReturn) => {
  expect(validateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, annualReturn }))
    .toEqual({ annualReturn: 'invalid_step' })
})

test.each([1.1, 10.5, 39.99999999999999])('requires exact whole years: %s', (durationYears) => {
  expect(validateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, durationYears }))
    .toEqual({ durationYears: 'not_integer' })
})

test.each([0, -0])('rejects a duration below one year: %s', (durationYears) => {
  expect(validateInvestment({ ...DEFAULT_INVESTMENT_PARAMETERS, durationYears }))
    .toEqual({ durationYears: 'out_of_range' })
})

test('collects independent field errors without changing the parameters', () => {
  const parameters = Object.freeze({
    initialInvestment: '1000',
    monthlyContribution: -1,
    durationYears: 1.5,
    annualReturn: 7.05,
  })

  expect(validateInvestment(parameters)).toEqual({
    initialInvestment: 'invalid_type',
    monthlyContribution: 'out_of_range',
    durationYears: 'not_integer',
    annualReturn: 'invalid_step',
  })
})
