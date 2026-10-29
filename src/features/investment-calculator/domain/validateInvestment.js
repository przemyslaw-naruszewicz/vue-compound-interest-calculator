import { INVESTMENT_CONSTRAINTS } from './investmentConstraints.js'

/**
 * @typedef {Object} InvestmentParameters
 * @property {number} initialInvestment
 * @property {number} monthlyContribution
 * @property {number} durationYears
 * @property {number} annualReturn
 * @property {Array<{year: number, amount: number}>} [oneTimeContributions]
 */

/**
 * Stable codes for presentation to map to field-specific messages.
 * @typedef {'required' | 'invalid_type' | 'not_finite' | 'out_of_range' |
 *   'not_integer' | 'invalid_step'} InvestmentErrorCode
 */

/**
 * Return only invalid fields, with one error per field and no input coercion.
 * Type and finiteness checks precede bounds, then integer/step checks.
 *
 * @param {Object} parameters
 * @returns {Record<string, InvestmentErrorCode>} Contribution errors use indexed field paths.
 * @throws {TypeError} If parameters is not a non-null, non-array object.
 */
export function validateInvestment(parameters) {
  if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new TypeError('Investment parameters must be a non-null, non-array object.')
  }

  const errors = {}

  for (const [field, constraints] of Object.entries(INVESTMENT_CONSTRAINTS)) {
    const error = validateNumber(parameters[field], constraints)
    if (error) errors[field] = error
  }

  if (Object.hasOwn(parameters, 'oneTimeContributions')) {
    if (!Array.isArray(parameters.oneTimeContributions)) {
      errors.oneTimeContributions = 'invalid_type'
    } else {
      for (let index = 0; index < parameters.oneTimeContributions.length; index += 1) {
        const contribution = parameters.oneTimeContributions[index]
        const path = `oneTimeContributions.${index}`
        if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
          errors[path] = 'invalid_type'
          continue
        }
        const amountError = validateNumber(contribution.amount, INVESTMENT_CONSTRAINTS.initialInvestment)
        const yearError = validateNumber(contribution.year, {
          min: 1,
          max: errors.durationYears ? INVESTMENT_CONSTRAINTS.durationYears.max : parameters.durationYears,
        })
        if (amountError) errors[`${path}.amount`] = amountError
        if (yearError) errors[`${path}.year`] = yearError
      }
    }
  }

  return errors
}

function validateNumber(value, constraints) {
  if (value === undefined) return 'required'
  if (typeof value !== 'number') return 'invalid_type'
  if (!Number.isFinite(value)) return 'not_finite'
  if (value < constraints.min || value > constraints.max) return 'out_of_range'
  if (!constraints.scale) return Number.isInteger(value) ? undefined : 'not_integer'

  const scaled = value * constraints.scale
  const tolerance = 2 * Number.EPSILON * Math.max(1, Math.abs(scaled))
  if (Math.abs(scaled - Math.round(scaled)) > tolerance) return 'invalid_step'
}
