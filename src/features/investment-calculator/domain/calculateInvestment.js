import { validateInvestment } from './validateInvestment.js'

/**
 * @typedef {Object} InvestmentResult
 * @property {number} investedCapital
 * @property {number} finalValue
 * @property {number} investmentGain
 */

/**
 * Compound a nominal annual return monthly, with month-end contributions.
 * Balances and results retain full Number precision; formatting belongs to the UI.
 *
 * @param {import('./validateInvestment.js').InvestmentParameters} parameters
 * @returns {InvestmentResult} A fresh object with signed zero normalized.
 * @throws {TypeError} For an invalid shape or missing/non-number/non-finite fields.
 * @throws {RangeError} For finite numbers outside the bounds or off the required steps.
 */
export function calculateInvestment(parameters) {
  const errors = Object.entries(validateInvestment(parameters))
  const typeError = errors.find(([, code]) => (
    code === 'required' || code === 'invalid_type' || code === 'not_finite'
  ))

  if (typeError) {
    throw new TypeError(`Invalid ${typeError[0]}: ${typeError[1]}.`)
  }
  if (errors.length > 0) {
    throw new RangeError(`Invalid ${errors[0][0]}: ${errors[0][1]}.`)
  }

  const { initialInvestment, monthlyContribution, durationYears, annualReturn } = parameters
  const months = durationYears * 12
  const investedCapital = (initialInvestment + monthlyContribution * months) || 0

  if (annualReturn === 0) {
    return { investedCapital, finalValue: investedCapital, investmentGain: 0 }
  }

  const monthlyRate = annualReturn / 100 / 12
  let balance = initialInvestment

  for (let month = 0; month < months; month += 1) {
    balance = balance * (1 + monthlyRate) + monthlyContribution
  }

  return {
    investedCapital,
    finalValue: balance || 0,
    investmentGain: (balance - investedCapital) || 0,
  }
}
