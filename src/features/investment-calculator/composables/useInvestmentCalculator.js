import { computed, ref } from 'vue'
import { calculateInvestment } from '../domain/calculateInvestment.js'
import { DEFAULT_INVESTMENT_PARAMETERS } from '../domain/investmentConstraints.js'
import { validateInvestment } from '../domain/validateInvestment.js'
import { parseInvestmentInput } from '../utils/parseInvestmentInput.js'

function createAmountDraft(initialValue, initialError) {
  const text = ref(initialValue === undefined ? '' : String(initialValue))
  const edited = ref(false)
  const draft = computed({
    get: () => text.value,
    set: (value) => {
      text.value = value
      edited.value = true
    },
  })
  const parsed = computed(() => {
    // Displaying an initial value as text must not validate a coerced value.
    // Only an explicit edit switches this field to draft parsing.
    if (!edited.value) {
      return {
        value: typeof initialValue === 'number' ? initialValue : undefined,
        error: initialError,
      }
    }

    return parseInvestmentInput(text.value)
  })

  return { draft, parsed }
}

/**
 * Own one calculator's editable state. Omit the argument to use shared defaults;
 * a supplied object is a complete seed, so missing/invalid fields stay invalid.
 * Seeds are read once. Amount drafts are writable refs; assign numeric values
 * to the slider refs only on user updates, never from native range clamping.
 *
 * parameters, errors, isValid, and result are computed. Errors combine the
 * domain codes with the parser's invalid_format code; invalid results are null.
 *
 * @param {import('../domain/validateInvestment.js').InvestmentParameters} initialParameters
 */
export function useInvestmentCalculator(initialParameters = DEFAULT_INVESTMENT_PARAMETERS) {
  const initialErrors = validateInvestment(initialParameters)
  const initialInvestment = createAmountDraft(
    initialParameters.initialInvestment,
    initialErrors.initialInvestment,
  )
  const monthlyContribution = createAmountDraft(
    initialParameters.monthlyContribution,
    initialErrors.monthlyContribution,
  )
  const durationYears = ref(initialParameters.durationYears)
  const annualReturn = ref(initialParameters.annualReturn)

  const parameters = computed(() => ({
    initialInvestment: initialInvestment.parsed.value.value,
    monthlyContribution: monthlyContribution.parsed.value.value,
    durationYears: durationYears.value,
    annualReturn: annualReturn.value,
  }))
  const errors = computed(() => {
    const fieldErrors = validateInvestment(parameters.value)

    for (const [field, amount] of Object.entries({ initialInvestment, monthlyContribution })) {
      if (amount.parsed.value.error) {
        fieldErrors[field] = amount.parsed.value.error
      }
    }

    return fieldErrors
  })
  const isValid = computed(() => Object.keys(errors.value).length === 0)
  const result = computed(() => (
    isValid.value ? calculateInvestment(parameters.value) : null
  ))

  return {
    initialInvestmentDraft: initialInvestment.draft,
    monthlyContributionDraft: monthlyContribution.draft,
    durationYears,
    annualReturn,
    parameters,
    errors,
    isValid,
    result,
  }
}
