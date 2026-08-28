import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import type { AccountType, TransactionType } from '../../shared/types/domain'

export const portfolio = sqliteTable('portfolio', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  isin: text('isin').notNull(),
  currency: text('currency').notNull().default('GBP'),
  initialInvestment: text('initial_investment').notNull(),
  startDate: text('start_date').notNull(),
  status: text('status', { enum: ['PENDING', 'ACTIVE'] }).notNull().default('PENDING'),
  createdAt: text('created_at').notNull()
})

export const account = sqliteTable('account', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  portfolioId: integer('portfolio_id').notNull().references(() => portfolio.id, { onDelete: 'cascade' }),
  type: text('type').$type<AccountType>().notNull(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull()
}, table => [
  uniqueIndex('idx_account_portfolio_type').on(table.portfolioId, table.type)
])

export const holding = sqliteTable('holding', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').notNull().references(() => account.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  units: text('units').notNull().default('0'),
  originalCost: text('original_cost').notNull().default('0'),
  eriAdjustment: text('eri_adjustment').notNull().default('0'),
  updatedAt: text('updated_at').notNull()
}, table => [
  uniqueIndex('idx_holding_account_symbol').on(table.accountId, table.symbol)
])

export const transaction = sqliteTable('transaction', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  portfolioId: integer('portfolio_id').notNull().references(() => portfolio.id, { onDelete: 'cascade' }),
  accountId: integer('account_id').references(() => account.id, { onDelete: 'set null' }),
  date: text('date').notNull(),
  type: text('type').$type<TransactionType>().notNull(),
  symbol: text('symbol').notNull(),
  units: text('units').notNull().default('0'),
  price: text('price').notNull().default('0'),
  grossValue: text('gross_value').notNull().default('0'),
  costBasis: text('cost_basis').notNull().default('0'),
  realisedGain: text('realised_gain').notNull().default('0'),
  eriAdjustment: text('eri_adjustment').notNull().default('0'),
  estimatedTax: text('estimated_tax').notNull().default('0'),
  notes: text('notes').notNull().default(''),
  groupId: text('group_id'),
  createdAt: text('created_at').notNull()
}, table => [
  index('idx_transaction_portfolio_date').on(table.portfolioId, table.date),
  index('idx_transaction_account_date').on(table.accountId, table.date),
  index('idx_transaction_group').on(table.groupId)
])

export const marketPrice = sqliteTable('market_price', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  symbol: text('symbol').notNull(),
  marketTimestamp: text('market_timestamp').notNull(),
  price: text('price').notNull(),
  previousClose: text('previous_close'),
  change: text('change'),
  changePercent: text('change_percent'),
  fiftyTwoWeekHigh: text('fifty_two_week_high'),
  fiftyTwoWeekLow: text('fifty_two_week_low'),
  source: text('source').notNull(),
  retrievedAt: text('retrieved_at').notNull()
}, table => [
  uniqueIndex('idx_market_price_symbol_timestamp').on(table.symbol, table.marketTimestamp),
  index('idx_market_price_symbol_retrieved').on(table.symbol, table.retrievedAt)
])

export const taxYear = sqliteTable('tax_year', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label').notNull().unique(),
  startsOn: text('starts_on').notNull(),
  endsOn: text('ends_on').notNull(),
  isaAllowance: text('isa_allowance').notNull(),
  cgtAnnualExemption: text('cgt_annual_exemption').notNull(),
  cgtBasicRate: text('cgt_basic_rate').notNull(),
  cgtHigherRate: text('cgt_higher_rate').notNull(),
  dividendAllowance: text('dividend_allowance').notNull(),
  dividendBasicRate: text('dividend_basic_rate').notNull(),
  dividendHigherRate: text('dividend_higher_rate').notNull(),
  dividendAdditionalRate: text('dividend_additional_rate').notNull(),
  personalAllowance: text('personal_allowance').notNull(),
  basicRateBand: text('basic_rate_band').notNull(),
  additionalRateThreshold: text('additional_rate_threshold').notNull(),
  confirmed: integer('confirmed', { mode: 'boolean' }).notNull().default(false),
  sourceNote: text('source_note').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const taxProfile = sqliteTable('tax_profile', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taxYear: text('tax_year').notNull().unique(),
  employmentIncome: text('employment_income').notNull().default('0'),
  otherTaxableIncome: text('other_taxable_income').notNull().default('0'),
  otherDividendIncome: text('other_dividend_income').notNull().default('0'),
  otherCapitalGains: text('other_capital_gains').notNull().default('0'),
  capitalLosses: text('capital_losses').notNull().default('0'),
  pensionContributions: text('pension_contributions').notNull().default('0'),
  personalAllowanceOverride: text('personal_allowance_override'),
  isaAllowanceUsed: text('isa_allowance_used').notNull().default('0'),
  mode: text('mode', { enum: ['simple', 'advanced'] }).notNull().default('simple'),
  updatedAt: text('updated_at').notNull()
})

export const eriRecord = sqliteTable('eri_record', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  portfolioId: integer('portfolio_id').notNull().references(() => portfolio.id, { onDelete: 'cascade' }),
  fund: text('fund').notNull(),
  isin: text('isin').notNull(),
  reportingPeriodStart: text('reporting_period_start').notNull(),
  reportingPeriodEnd: text('reporting_period_end').notNull(),
  fundDistributionDate: text('fund_distribution_date').notNull(),
  eriPerUnit: text('eri_per_unit').notNull(),
  currency: text('currency').notNull().default('GBP'),
  source: text('source').notNull(),
  sourceDocument: text('source_document').notNull(),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes').notNull().default(''),
  applicableUnits: text('applicable_units').notNull().default('0'),
  totalAmount: text('total_amount').notNull().default('0'),
  appliedAt: text('applied_at'),
  createdAt: text('created_at').notNull()
}, table => [
  index('idx_eri_record_portfolio_period').on(table.portfolioId, table.reportingPeriodEnd)
])

export const taxCalculation = sqliteTable('tax_calculation', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  portfolioId: integer('portfolio_id').notNull().references(() => portfolio.id, { onDelete: 'cascade' }),
  taxYear: text('tax_year').notNull(),
  calculationType: text('calculation_type').notNull(),
  inputJson: text('input_json').notNull(),
  resultJson: text('result_json').notNull(),
  createdAt: text('created_at').notNull()
}, table => [
  index('idx_tax_calculation_portfolio_year').on(table.portfolioId, table.taxYear)
])

export const appSetting = sqliteTable('app_setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull()
})
