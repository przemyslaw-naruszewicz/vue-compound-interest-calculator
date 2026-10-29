import { INVESTMENT_CONSTRAINTS } from '../domain/investmentConstraints.js'

export function amountErrorMessage(code, label, constraints = INVESTMENT_CONSTRAINTS.initialInvestment) {
  if (!code) return ''
  if (code === 'required') return `${label}: enter an amount, or 0 for none.`
  if (code === 'out_of_range' || code === 'not_finite') {
    return `${label}: enter an amount from ${constraints.min} to ${constraints.max}, without grouping separators.`
  }
  return `${label}: use digits and up to two decimal places, with a dot or comma and no grouping separators.`
}
