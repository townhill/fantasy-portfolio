export type InvestmentAccountType = 'ISA' | 'GIA'
export type AccountType = InvestmentAccountType | 'CASH'

export type TransactionType =
  | 'INITIAL_BUY'
  | 'GIA_SELL'
  | 'ISA_BUY'
  | 'ISA_SELL'
  | 'BED_AND_ISA'
  | 'ERI'
  | 'CASH_DEPOSIT'
  | 'INTEREST'
  | 'CASH_WITHDRAWAL'
  | 'TAX_PAYMENT'
  | 'ADJUSTMENT'

export interface MarketQuote {
  symbol: string
  price: string
  previousClose: string | null
  change: string | null
  changePercent: string | null
  marketTimestamp: string
  fiftyTwoWeekHigh: string | null
  fiftyTwoWeekLow: string | null
  source: string
  lastSuccessfulRefresh: string
  stale: boolean
  manual: boolean
}

export interface PricePoint {
  date: string
  price: string
  source: string
}

export interface TaxRules {
  taxYear: string
  isaAllowance: string
  cgtAnnualExemption: string
  cgtBasicRate: string
  cgtHigherRate: string
  dividendAllowance: string
  dividendBasicRate: string
  dividendHigherRate: string
  dividendAdditionalRate: string
  personalAllowance: string
  basicRateBand: string
  additionalRateThreshold: string
  confirmed: boolean
  sourceNote: string
}

export interface TaxProfileInput {
  taxYear: string
  employmentIncome: string
  otherTaxableIncome: string
  otherDividendIncome: string
  otherCapitalGains: string
  capitalLosses: string
  pensionContributions: string
  personalAllowanceOverride: string | null
  isaAllowanceUsed: string
  mode: 'simple' | 'advanced'
}

export interface CgtResult {
  realisedGain: string
  netGainBeforeExemption: string
  annualExemptionAvailable: string
  annualExemptionUsed: string
  taxableGain: string
  basicRateGain: string
  higherRateGain: string
  basicRateTax: string
  higherRateTax: string
  estimatedCgt: string
}

export interface IncomeTaxResult {
  reportableIncome: string
  dividendAllowanceAvailable: string
  dividendAllowanceUsed: string
  taxableReportableIncome: string
  estimatedIncomeTax: string
}

export interface AccountSnapshot {
  id: number
  type: InvestmentAccountType
  value: string
  units: string
  averageAcquisitionPrice: string
  originalCost: string
  eriAdjustment: string
  adjustedBaseCost: string
  gainLoss: string
  gainLossPercent: string
  portfolioPercent: string
}

export interface PortfolioSnapshot {
  initialized: boolean
  portfolioId: number | null
  asOf: string
  initialInvestment: string
  currentValue: string
  totalGainLoss: string
  totalGainLossPercent: string
  todayChange: string
  todayChangePercent: string
  isa: AccountSnapshot | null
  gia: AccountSnapshot | null
  cash: CashSnapshot | null
  market: MarketQuote | null
  potentialCgt: CgtResult | null
  incomeTax: IncomeTaxResult | null
  estimatedTaxDueNow: string
  unrealisedPotentialTax: string
  reportableIncomeStatus: 'awaiting' | 'recorded'
  reportableIncome: string
  cashDividends: string
  unusedCgtExemption: string
  remainingDividendAllowance: string
  taxYear: string
  taxRulesAssumed: boolean
  refreshIntervalMs: number
}

export interface CashSnapshot {
  id: number | null
  balance: string
  interestRatePercent: string
  accruedInterest: string
  interestThisTaxYear: string
  totalInterest: string
  totalTakenOut: string
  portfolioPercent: string
}

export interface PerformancePoint {
  date: string
  price: string
  total: string
  isa: string
  gia: string
  cash: string
  takenOut: string
  historical: boolean
}

export interface LedgerEntry {
  id: number
  date: string
  account: AccountType | 'Portfolio' | null
  type: TransactionType
  units: string
  price: string
  grossValue: string
  costBasis: string
  realisedGain: string
  eriAdjustment: string
  estimatedTax: string
  notes: string
  groupId: string | null
}

export interface BedIsaPreview {
  date: string
  currentGiaValue: string
  availableIsaAllowance: string
  suggestedAmount: string
  unitsToSell: string
  estimatedGain: string
  cgtAnnualExemptionRemaining: string
  estimatedCgt: string
  isaValueAfter: string
  giaValueAfter: string
  price: string
  rulesAssumed: boolean
  cgt: CgtResult
}

export interface WithdrawalPreview {
  date: string
  account: InvestmentAccountType
  price: string
  accountValue: string
  proceeds: string
  unitsToSell: string
  sellsEntireHolding: boolean
  originalCostSold: string
  eriAdjustmentSold: string
  allocatedCost: string
  gain: string
  estimatedCgt: string
  cgtAnnualExemptionRemaining: string | null
  accountValueAfter: string
  cashBalanceAfter: string
  rulesAssumed: boolean
  priceStale: boolean
  manualPrice: boolean
}

export interface ProjectionPoint {
  year: number
  label: string
  portfolioValue: string
  isaValue: string
  giaValue: string
  cashValue: string
  withdrawn: string
  cumulativeWithdrawn: string
  shortfall: string
  estimatedCumulativeTax: string
  amountSheltered: string
  historical: boolean
}
