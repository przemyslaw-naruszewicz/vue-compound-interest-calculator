export const INVESTMENT_CONSTRAINTS = Object.freeze({
  initialInvestment: Object.freeze({
    defaultValue: 10000,
    min: 0,
    max: 1_000_000_000,
    step: 0.01,
    scale: 100,
  }),
  monthlyContribution: Object.freeze({
    defaultValue: 500,
    min: 0,
    max: 1_000_000_000,
    step: 0.01,
    scale: 100,
  }),
  durationYears: Object.freeze({
    defaultValue: 10,
    min: 1,
    max: 40,
    step: 1,
  }),
  annualReturn: Object.freeze({
    defaultValue: 7,
    min: 0,
    max: 15,
    step: 0.1,
    scale: 10,
  }),
})

export const DEFAULT_INVESTMENT_PARAMETERS = Object.freeze(
  Object.fromEntries(
    Object.entries(INVESTMENT_CONSTRAINTS).map(([field, { defaultValue }]) => [
      field,
      defaultValue,
    ]),
  ),
)
