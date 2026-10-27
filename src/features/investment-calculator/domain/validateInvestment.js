import { INVESTMENT_CONSTRAINTS } from './investmentConstraints.js'

/**
 * @typedef {Object} InvestmentParameters
 * @property {number} initialInvestment
 * @property {number} monthlyContribution
 * @property {number} durationYears
 * @property {number} annualReturn
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
 * @returns {Partial<Record<keyof InvestmentParameters, InvestmentErrorCode>>}
 * @throws {TypeError} If parameters is not a non-null, non-array object.
 */
export function validateInvestment(parameters) {
  if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new TypeError('Investment parameters must be a non-null, non-array object.')
  }

  const errors = {}

  for (const [field, constraints] of Object.entries(INVESTMENT_CONSTRAINTS)) {
    const value = parameters[field]

    if (value === undefined) {
      errors[field] = 'required'
    } else if (typeof value !== 'number') {
      errors[field] = 'invalid_type'
    } else if (!Number.isFinite(value)) {
      errors[field] = 'not_finite'
    } else if (value < constraints.min || value > constraints.max) {
      errors[field] = 'out_of_range'
    } else if (field === 'durationYears') {
      if (!Number.isInteger(value)) errors[field] = 'not_integer'
    } else {
      const scaled = value * constraints.scale
      const tolerance = 2 * Number.EPSILON * Math.max(1, Math.abs(scaled))

      if (Math.abs(scaled - Math.round(scaled)) > tolerance) {
        errors[field] = 'invalid_step'
      }
    }
  }

  return errors
}
