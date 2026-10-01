import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import type {
  BedIsaPreview,
  CashSnapshot,
  InvestmentAccountType,
  LedgerEntry,
  PerformancePoint,
  PortfolioSnapshot,
  ProjectionPoint,
  TransactionType,
  WithdrawalPreview
} from '../../shared/types/domain'
import { getDatabase } from '../database/client'
import {
  account,
  appSetting,
  eriRecord,
  holding,
  marketPrice,
  portfolio,
  taxCalculation,
  transaction
} from '../database/schema'
import { formatGbp } from '../../shared/utils/format'
import { D, money, precise, ratioPercent } from '../utils/decimal'
import { createInitialAllocations, valueAccount } from './accounting/portfolio'
import { planBedAndIsa } from './bed-isa/planner'
import { calculateInterest, cashBalance, cashMovement, lastCompletedMonth, monthAfter, type CashMovement } from './cash/interest'
import { MarketDataService } from './market/service'
import { projectPortfolio } from './projection/projector'
import { DEFAULT_SETTINGS, ensureApplicationDefaults, getTaxContext, readSettings } from './settings'
import { calculateCgt, calculateMarginalCgt } from './tax/cgt'
import { calculateEri } from './tax/eri'
import { calculateReportableIncomeTax } from './tax/income'
import { taxYearForDate } from './tax/rules'
import { planWithdrawal } from './withdrawal/planner'

const SYMBOL = 'VUAG.L'
const CASH_SYMBOL = 'GBP'
const CASH_INTEREST_SETTLED_KEY = 'cash_interest_settled_through'

interface CashState {
  accountId: number | null
  ratePercent: string
  entries: Array<{ type: TransactionType, date: string, grossValue: string }>
  movements: CashMovement[]
  balance: string
  accruedInterest: string
}

export async function setupPreview(startDate?: string, manualPrice?: string) {
  await ensureApplicationDefaults()
  const db = getDatabase()
  const [record] = await db.select().from(portfolio).limit(1)
  if (!record) throw new Error('Portfolio configuration is unavailable')
  if (record.status === 'ACTIVE') return { initialized: true, portfolio: record }
  const selectedDate = startDate ?? record.startDate
  const selected = manualPrice
    ? { price: precise(manualPrice, 6), date: selectedDate, source: 'Manual setup price', currentQuote: false }
    : await new MarketDataService().priceForDate(record.symbol, selectedDate)
  const settings = await readSettings()
  const isaAmount = settings.settings.initial_isa_amount ?? '20000.00'
  const giaAmount = settings.settings.initial_gia_amount ?? '80000.00'
  return {
    initialized: false,
    portfolio: record,
    price: selected,
    allocations: createInitialAllocations(selected.price, isaAmount, giaAmount)
  }
}

export async function initializePortfolio(input: {
  startDate: string
  acquisitionPrice: string
  priceSource: string
  usedCurrentQuote?: boolean
}) {
  await ensureApplicationDefaults()
  const db = getDatabase()
  const existing = db.select().from(portfolio).limit(1).get()
  if (!existing) throw new Error('Portfolio configuration is unavailable')
  if (existing.status === 'ACTIVE') throw new Error('The fantasy portfolio has already been initialized')
  const settings = await readSettings()
  const allocations = createInitialAllocations(
    input.acquisitionPrice,
    settings.settings.initial_isa_amount ?? '20000.00',
    settings.settings.initial_gia_amount ?? '80000.00'
  )
  const now = new Date().toISOString()

  db.transaction(tx => {
    tx.update(portfolio).set({
      startDate: input.startDate,
      initialInvestment: money(allocations.reduce((sum, item) => sum.plus(item.amount), D(0))),
      status: 'ACTIVE'
    }).where(eq(portfolio.id, existing.id)).run()

    for (const allocation of allocations) {
      const inserted = tx.insert(account).values({
        portfolioId: existing.id,
        type: allocation.account,
        name: allocation.account === 'ISA' ? 'Stocks & Shares ISA' : 'General Investment Account',
        createdAt: now
      }).returning({ id: account.id }).get()
      tx.insert(holding).values({
        accountId: inserted.id,
        symbol: existing.symbol,
        units: allocation.units,
        originalCost: allocation.amount,
        eriAdjustment: '0.00',
        updatedAt: now
      }).run()
      tx.insert(transaction).values({
        portfolioId: existing.id,
        accountId: inserted.id,
        date: input.startDate,
        type: 'INITIAL_BUY',
        symbol: existing.symbol,
        units: allocation.units,
        price: allocation.price,
        grossValue: allocation.amount,
        costBasis: allocation.amount,
        realisedGain: '0.00',
        eriAdjustment: '0.00',
        estimatedTax: '0.00',
        notes: `${allocation.account} opening acquisition using ${input.priceSource}${input.usedCurrentQuote ? ' (current delayed quote)' : ''}.`,
        createdAt: now
      }).run()
    }

    tx.insert(marketPrice).values({
      symbol: existing.symbol,
      marketTimestamp: `${input.startDate}T16:35:00.000Z`,
      price: input.acquisitionPrice,
      previousClose: null,
      change: null,
      changePercent: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      source: input.priceSource,
      retrievedAt: `${input.startDate}T00:00:00.000Z`
    }).onConflictDoNothing().run()
  })
  return { initialized: true, allocations }
}

export async function getPortfolioSnapshot(forceMarketRefresh = false): Promise<PortfolioSnapshot> {
  await ensureApplicationDefaults()
  const applicationSettings = await readSettings()
  const refreshIntervalMs = Math.max(5, Number(applicationSettings.settings.refresh_interval_minutes ?? 15)) * 60_000
  const db = getDatabase()
  const record = db.select().from(portfolio).limit(1).get()
  const now = new Date().toISOString()
  if (!record || record.status !== 'ACTIVE') {
    return { ...emptySnapshot(now), refreshIntervalMs }
  }

  const quote = await new MarketDataService().getQuote(record.symbol, forceMarketRefresh)
  const rows = db.select({
    accountId: account.id,
    type: account.type,
    units: holding.units,
    originalCost: holding.originalCost,
    eriAdjustment: holding.eriAdjustment
  }).from(holding).innerJoin(account, eq(holding.accountId, account.id))
    .where(eq(account.portfolioId, record.id)).all()
    .filter((row): row is typeof row & { type: InvestmentAccountType } => row.type !== 'CASH')
  const totalUnits = rows.reduce((sum, row) => sum.plus(row.units), D(0))
  const cash = settleCash(record.id, cashInterestRate(applicationSettings.settings))
  const currentValue = totalUnits.mul(quote.price).plus(cash.balance)
  const currentTaxYear = taxYearForDate(now)
  const { rules, profile } = await getTaxContext(currentTaxYear)
  const valued = rows.map(row => valueAccount({
    id: row.accountId,
    type: row.type,
    units: row.units,
    originalCost: row.originalCost,
    eriAdjustment: row.eriAdjustment,
    price: quote.price,
    totalPortfolioValue: currentValue.toString()
  }))
  const isa = valued.find(item => item.type === 'ISA') ?? null
  const gia = valued.find(item => item.type === 'GIA') ?? null
  const cashSummary = summariseCash(cash, currentTaxYear, currentValue)
  // Cash taken out to live on has left the portfolio but is still part of its return.
  const gain = currentValue.plus(cashSummary.totalTakenOut).minus(record.initialInvestment)
  const todayChange = quote.previousClose ? totalUnits.mul(D(quote.price).minus(quote.previousClose)) : D(0)
  const realisedGain = await realisedGainForYear(record.id, currentTaxYear)
  const potentialCgt = gia ? calculateMarginalCgt({
    realisedGain: gia.gainLoss,
    realisedGainsThisYear: realisedGain.toString(),
    profile,
    rules
  }) : null

  const verifiedEri = db.select().from(eriRecord).where(and(
    eq(eriRecord.portfolioId, record.id),
    eq(eriRecord.verified, true)
  )).all().filter(item => taxYearForDate(item.fundDistributionDate) === currentTaxYear)
  const reportableIncome = verifiedEri.reduce((sum, item) => sum.plus(item.totalAmount), D(0))
  const incomeTax = calculateReportableIncomeTax(reportableIncome.toString(), profile, rules)
  const actualCgt = calculateCgt({ realisedGain: realisedGain.toString(), profile, rules })
  const estimatedTaxDueNow = D(actualCgt.estimatedCgt).plus(incomeTax.estimatedIncomeTax)

  return {
    initialized: true,
    portfolioId: record.id,
    asOf: now,
    initialInvestment: money(record.initialInvestment),
    currentValue: money(currentValue),
    totalGainLoss: money(gain),
    totalGainLossPercent: ratioPercent(gain, record.initialInvestment),
    todayChange: money(todayChange),
    todayChangePercent: ratioPercent(todayChange, currentValue.minus(todayChange)),
    isa,
    gia,
    cash: cashSummary,
    market: quote,
    potentialCgt,
    incomeTax,
    estimatedTaxDueNow: money(estimatedTaxDueNow),
    unrealisedPotentialTax: potentialCgt?.estimatedCgt ?? '0.00',
    reportableIncomeStatus: verifiedEri.length ? 'recorded' : 'awaiting',
    reportableIncome: money(reportableIncome),
    cashDividends: '0.00',
    unusedCgtExemption: money(DecimalMax(D(rules.cgtAnnualExemption).minus(actualCgt.annualExemptionUsed), D(0))),
    remainingDividendAllowance: incomeTax.dividendAllowanceAvailable,
    taxYear: currentTaxYear,
    taxRulesAssumed: !rules.confirmed,
    refreshIntervalMs
  }
}

export async function getPerformance(range = 'ALL'): Promise<PerformancePoint[]> {
  const applicationSettings = await readSettings()
  const db = getDatabase()
  const record = db.select().from(portfolio).limit(1).get()
  if (!record || record.status !== 'ACTIVE') return []
  const cash = settleCash(record.id, cashInterestRate(applicationSettings.settings))
  const to = new Date()
  const from = rangeStart(range, record.startDate, to)
  const prices = await new MarketDataService().getHistory(record.symbol, from, to)
  const entries = db.select().from(transaction)
    .where(and(eq(transaction.portfolioId, record.id), lte(transaction.date, to.toISOString().slice(0, 10))))
    .orderBy(asc(transaction.date), asc(transaction.id)).all()
  const accounts = db.select().from(account).where(eq(account.portfolioId, record.id)).all()
  const typeById = new Map(accounts.map(item => [item.id, item.type]))
  return prices.filter(point => point.date >= from.toISOString().slice(0, 10)).map(point => {
    let isaUnits = D(0)
    let giaUnits = D(0)
    for (const entry of entries) {
      if (entry.date > point.date || !entry.accountId) continue
      const type = typeById.get(entry.accountId)
      if (entry.type === 'INITIAL_BUY' || entry.type === 'ISA_BUY' || entry.type === 'ADJUSTMENT') {
        if (type === 'ISA') isaUnits = isaUnits.plus(entry.units)
        if (type === 'GIA') giaUnits = giaUnits.plus(entry.units)
      } else if (entry.type === 'GIA_SELL' && type === 'GIA') {
        giaUnits = giaUnits.minus(entry.units)
      } else if (entry.type === 'ISA_SELL' && type === 'ISA') {
        isaUnits = isaUnits.minus(entry.units)
      }
    }
    const isaValue = isaUnits.mul(point.price)
    const giaValue = giaUnits.mul(point.price)
    const cashValue = cashBalance(cash.movements, point.date)
    const takenOut = cash.entries.filter(entry => entry.type === 'CASH_WITHDRAWAL' && entry.date <= point.date)
      .reduce((sum, entry) => sum.plus(entry.grossValue), D(0))
    return {
      date: point.date,
      price: point.price,
      total: money(isaValue.plus(giaValue).plus(cashValue)),
      isa: money(isaValue),
      gia: money(giaValue),
      cash: cashValue,
      takenOut: money(takenOut),
      historical: true
    }
  })
}

export async function getLedger(): Promise<LedgerEntry[]> {
  const applicationSettings = await readSettings()
  const db = getDatabase()
  const record = db.select().from(portfolio).limit(1).get()
  if (!record) return []
  settleCash(record.id, cashInterestRate(applicationSettings.settings))
  const accounts = db.select().from(account).where(eq(account.portfolioId, record.id)).all()
  const typeById = new Map(accounts.map(item => [item.id, item.type]))
  return db.select().from(transaction).where(eq(transaction.portfolioId, record.id))
    .orderBy(desc(transaction.date), desc(transaction.id)).all().map(row => ({
      id: row.id,
      date: row.date,
      account: row.accountId ? typeById.get(row.accountId) ?? null : 'Portfolio',
      type: row.type,
      units: row.units,
      price: row.price,
      grossValue: row.grossValue,
      costBasis: row.costBasis,
      realisedGain: row.realisedGain,
      eriAdjustment: row.eriAdjustment,
      estimatedTax: row.estimatedTax,
      notes: row.notes,
      groupId: row.groupId
    }))
}

export async function previewBedIsa(requestedAmount?: string, date = new Date().toISOString().slice(0, 10)): Promise<BedIsaPreview> {
  const snapshot = await getPortfolioSnapshot()
  if (!snapshot.initialized || !snapshot.gia || !snapshot.isa || !snapshot.market) throw new Error('Initialize the portfolio before planning Bed & ISA')
  const { rules, profile } = await getTaxContext(taxYearForDate(date))
  const portfolioIsaAllowanceUsed = await isaContributionsForYear(snapshot.portfolioId!, taxYearForDate(date))
  return planBedAndIsa({
    date,
    price: snapshot.market.price,
    giaUnits: snapshot.gia.units,
    giaOriginalCost: snapshot.gia.originalCost,
    giaEriAdjustment: snapshot.gia.eriAdjustment,
    isaValue: snapshot.isa.value,
    ...(requestedAmount ? { requestedAmount } : {}),
    portfolioIsaAllowanceUsed: portfolioIsaAllowanceUsed.toString(),
    profile,
    rules,
    realisedGainsThisYear: (await realisedGainForYear(snapshot.portfolioId!, taxYearForDate(date))).toString()
  })
}

export async function applyBedIsa(requestedAmount?: string, date = new Date().toISOString().slice(0, 10)) {
  const applicationSettings = await readSettings()
  if (applicationSettings.settings.bed_isa_enabled !== 'true') {
    throw new Error('Bed & ISA transactions are disabled in Settings')
  }
  if (date > new Date().toISOString().slice(0, 10)) {
    throw new Error('Future Bed & ISA transactions can be projected but cannot be applied using today’s market price')
  }
  const preview = await previewBedIsa(requestedAmount, date)
  if (D(preview.suggestedAmount).lte(0)) throw new Error('No ISA allowance or GIA value is available to transfer')
  const db = getDatabase()
  const record = db.select().from(portfolio).limit(1).get()
  if (!record) throw new Error('Portfolio not found')
  const accounts = db.select().from(account).where(eq(account.portfolioId, record.id)).all()
  const isaAccount = accounts.find(item => item.type === 'ISA')
  const giaAccount = accounts.find(item => item.type === 'GIA')
  if (!isaAccount || !giaAccount) throw new Error('Portfolio accounts are incomplete')
  const isaHolding = db.select().from(holding).where(eq(holding.accountId, isaAccount.id)).get()
  const giaHolding = db.select().from(holding).where(eq(holding.accountId, giaAccount.id)).get()
  if (!isaHolding || !giaHolding) throw new Error('Portfolio holdings are incomplete')
  const soldFraction = D(preview.unitsToSell).div(giaHolding.units)
  const originalCostSold = D(giaHolding.originalCost).mul(soldFraction)
  const eriCostSold = D(giaHolding.eriAdjustment).mul(soldFraction)
  const groupId = crypto.randomUUID()
  const now = new Date().toISOString()

  db.transaction(tx => {
    tx.update(holding).set({
      units: precise(D(giaHolding.units).minus(preview.unitsToSell)),
      originalCost: money(D(giaHolding.originalCost).minus(originalCostSold)),
      eriAdjustment: money(D(giaHolding.eriAdjustment).minus(eriCostSold)),
      updatedAt: now
    }).where(eq(holding.id, giaHolding.id)).run()
    tx.update(holding).set({
      units: precise(D(isaHolding.units).plus(preview.unitsToSell)),
      originalCost: money(D(isaHolding.originalCost).plus(preview.suggestedAmount)),
      updatedAt: now
    }).where(eq(holding.id, isaHolding.id)).run()

    tx.insert(transaction).values([
      {
        portfolioId: record.id, accountId: giaAccount.id, date, type: 'GIA_SELL' as const, symbol: record.symbol,
        units: preview.unitsToSell, price: preview.price, grossValue: preview.suggestedAmount,
        costBasis: money(originalCostSold.plus(eriCostSold)), realisedGain: preview.estimatedGain,
        eriAdjustment: money(eriCostSold), estimatedTax: preview.estimatedCgt,
        notes: 'GIA disposal forming the sell leg of a simulated Bed & ISA.', groupId, createdAt: now
      },
      {
        portfolioId: record.id, accountId: isaAccount.id, date, type: 'ISA_BUY' as const, symbol: record.symbol,
        units: preview.unitsToSell, price: preview.price, grossValue: preview.suggestedAmount,
        costBasis: preview.suggestedAmount, realisedGain: '0.00', eriAdjustment: '0.00', estimatedTax: '0.00',
        notes: 'ISA acquisition forming the buy leg of a simulated Bed & ISA.', groupId, createdAt: now
      },
      {
        portfolioId: record.id, accountId: null, date, type: 'BED_AND_ISA' as const, symbol: record.symbol,
        units: preview.unitsToSell, price: preview.price, grossValue: preview.suggestedAmount,
        costBasis: money(originalCostSold.plus(eriCostSold)), realisedGain: preview.estimatedGain,
        eriAdjustment: money(eriCostSold), estimatedTax: preview.estimatedCgt,
        notes: 'Audit summary for the linked GIA sale and ISA purchase. No cash movement is modelled.', groupId, createdAt: now
      }
    ]).run()
    tx.insert(taxCalculation).values({
      portfolioId: record.id,
      taxYear: taxYearForDate(date),
      calculationType: 'BED_AND_ISA',
      inputJson: JSON.stringify({ requestedAmount, date, price: preview.price }),
      resultJson: JSON.stringify(preview),
      createdAt: now
    }).run()
  })
  return { applied: true, groupId, preview }
}

export async function previewWithdrawal(amount: string, accountType: InvestmentAccountType = 'ISA'): Promise<WithdrawalPreview> {
  return (await prepareWithdrawal(amount, accountType)).preview
}

export async function applyWithdrawal(amount: string, accountType: InvestmentAccountType = 'ISA') {
  const { preview, record, investmentAccountId, position } = await prepareWithdrawal(amount, accountType)
  const db = getDatabase()
  const groupId = crypto.randomUUID()
  const now = new Date().toISOString()

  db.transaction(tx => {
    const current = tx.select().from(holding).where(eq(holding.id, position.id)).get()
    if (!current || current.units !== position.units) {
      throw new Error('The holding changed while this withdrawal was being prepared; preview it again')
    }
    tx.update(holding).set({
      units: precise(D(current.units).minus(preview.unitsToSell)),
      originalCost: money(D(current.originalCost).minus(preview.originalCostSold)),
      eriAdjustment: money(D(current.eriAdjustment).minus(preview.eriAdjustmentSold)),
      updatedAt: now
    }).where(eq(holding.id, current.id)).run()

    const existingCash = tx.select({ id: account.id }).from(account)
      .where(and(eq(account.portfolioId, record.id), eq(account.type, 'CASH'))).get()
    const cashAccountId = existingCash?.id ?? tx.insert(account).values({
      portfolioId: record.id,
      type: 'CASH',
      name: 'Cash account',
      createdAt: now
    }).returning({ id: account.id }).get().id

    tx.insert(transaction).values([
      {
        portfolioId: record.id, accountId: investmentAccountId, date: preview.date,
        type: accountType === 'ISA' ? 'ISA_SELL' as const : 'GIA_SELL' as const, symbol: record.symbol,
        units: preview.unitsToSell, price: preview.price, grossValue: preview.proceeds,
        costBasis: preview.allocatedCost, realisedGain: preview.gain, eriAdjustment: preview.eriAdjustmentSold,
        estimatedTax: accountType === 'GIA' ? preview.estimatedCgt : '0.00',
        notes: accountType === 'ISA'
          ? 'ISA sale to fund a cash withdrawal. The gain is sheltered inside the ISA and no CGT applies.'
          : 'GIA disposal to fund a cash withdrawal. The gain is crystallised for CGT.',
        groupId, createdAt: now
      },
      {
        portfolioId: record.id, accountId: cashAccountId, date: preview.date, type: 'CASH_DEPOSIT' as const,
        symbol: CASH_SYMBOL, units: '0', price: '0', grossValue: preview.proceeds, costBasis: '0.00',
        realisedGain: '0.00', eriAdjustment: '0.00', estimatedTax: '0.00',
        notes: `Proceeds of the linked ${accountType} sale credited to the cash account.`,
        groupId, createdAt: now
      }
    ]).run()

    if (accountType === 'GIA') {
      tx.insert(taxCalculation).values({
        portfolioId: record.id,
        taxYear: taxYearForDate(preview.date),
        calculationType: 'WITHDRAWAL',
        inputJson: JSON.stringify({ amount, account: accountType, date: preview.date, price: preview.price }),
        resultJson: JSON.stringify(preview),
        createdAt: now
      }).run()
    }
  })
  return { applied: true, groupId, preview }
}

export async function takeOutCash(amount: string, note = '') {
  const applicationSettings = await readSettings()
  const db = getDatabase()
  const record = db.select().from(portfolio).limit(1).get()
  if (!record || record.status !== 'ACTIVE') throw new Error('Initialize the portfolio before taking out cash')
  const requested = D(amount)
  if (requested.lte(0)) throw new Error('Enter an amount greater than £0')
  const cash = settleCash(record.id, cashInterestRate(applicationSettings.settings))
  if (!cash.accountId) throw new Error('There is no cash to take out yet. Withdraw from the ISA or GIA to cash first.')
  const cashAccountId = cash.accountId
  const date = todayIso()
  const now = new Date().toISOString()

  const balanceAfter = db.transaction(tx => {
    const balance = cashBalance(toCashMovements(tx.select().from(transaction).where(eq(transaction.accountId, cashAccountId)).all()))
    if (requested.gt(balance)) throw new Error(`The cash account holds ${formatGbp(balance)}; enter that amount or less`)
    tx.insert(transaction).values({
      portfolioId: record.id, accountId: cashAccountId, date, type: 'CASH_WITHDRAWAL', symbol: CASH_SYMBOL,
      units: '0', price: '0', grossValue: money(requested), costBasis: '0.00', realisedGain: '0.00',
      eriAdjustment: '0.00', estimatedTax: '0.00',
      notes: note.trim() ? `Cash taken out to live on: ${note.trim()}` : 'Cash taken out to live on.',
      createdAt: now
    }).run()
    return money(D(balance).minus(requested))
  })
  return { takenOut: money(requested), balanceAfter }
}

export async function addEriRecord(input: {
  reportingPeriodStart: string
  reportingPeriodEnd: string
  fundDistributionDate: string
  eriPerUnit: string
  currency: string
  source: string
  sourceDocument: string
  verified: boolean
  notes: string
}) {
  await ensureApplicationDefaults()
  const db = getDatabase()
  const record = db.select().from(portfolio).limit(1).get()
  if (!record || record.status !== 'ACTIVE') throw new Error('Initialize the portfolio before recording ERI')
  const accounts = db.select().from(account).where(and(eq(account.portfolioId, record.id), eq(account.type, 'GIA'))).all()
  const gia = accounts[0]
  if (!gia) throw new Error('GIA account not found')
  const giaHolding = db.select().from(holding).where(eq(holding.accountId, gia.id)).get()
  if (!giaHolding) throw new Error('GIA holding not found')
  const units = giaUnitsAtDate(record.id, gia.id, input.reportingPeriodEnd)
  const calculation = calculateEri(input.eriPerUnit, units)
  const now = new Date().toISOString()

  db.transaction(tx => {
    tx.insert(eriRecord).values({
      portfolioId: record.id,
      fund: 'Vanguard S&P 500 UCITS ETF (USD) Accumulating',
      isin: record.isin,
      reportingPeriodStart: input.reportingPeriodStart,
      reportingPeriodEnd: input.reportingPeriodEnd,
      fundDistributionDate: input.fundDistributionDate,
      eriPerUnit: input.eriPerUnit,
      currency: input.currency,
      source: input.source,
      sourceDocument: input.sourceDocument,
      verified: input.verified,
      notes: input.notes,
      applicableUnits: calculation.applicableUnits,
      totalAmount: calculation.totalReportableIncome,
      appliedAt: input.verified ? now : null,
      createdAt: now
    }).run()
    if (input.verified) {
      tx.update(holding).set({
        eriAdjustment: money(D(giaHolding.eriAdjustment).plus(calculation.allowableBaseCostAdjustment)),
        updatedAt: now
      }).where(eq(holding.id, giaHolding.id)).run()
      tx.insert(transaction).values({
        portfolioId: record.id,
        accountId: gia.id,
        date: input.fundDistributionDate,
        type: 'ERI',
        symbol: record.symbol,
        units,
        price: input.eriPerUnit,
        grossValue: calculation.totalReportableIncome,
        costBasis: '0.00',
        realisedGain: '0.00',
        eriAdjustment: calculation.allowableBaseCostAdjustment,
        estimatedTax: '0.00',
        notes: `Verified ERI recorded from ${input.source}; non-cash reportable income and GIA base-cost adjustment.`,
        createdAt: now
      }).run()
    }
  })
  return calculation
}

export async function getTaxYearSummary() {
  const applicationSettings = await readSettings()
  const db = getDatabase()
  const record = db.select().from(portfolio).limit(1).get()
  if (!record) return []
  settleCash(record.id, cashInterestRate(applicationSettings.settings))
  const entries = db.select().from(transaction).where(eq(transaction.portfolioId, record.id)).all()
  const eri = db.select().from(eriRecord).where(eq(eriRecord.portfolioId, record.id)).all()
  const labels = new Set<string>([taxYearForDate(new Date()), ...entries.map(item => taxYearForDate(item.date)), ...eri.map(item => taxYearForDate(item.fundDistributionDate))])
  const output = []
  for (const label of [...labels].sort().reverse()) {
    const { rules, profile } = await getTaxContext(label)
    const disposals = entries.filter(item => item.type === 'GIA_SELL' && taxYearForDate(item.date) === label)
    const realisedGains = disposals.reduce((sum, item) => sum.plus(item.realisedGain), D(0))
    const cgt = calculateCgt({ realisedGain: realisedGains.toString(), profile, rules })
    const eriAmount = eri.filter(item => item.verified && taxYearForDate(item.fundDistributionDate) === label)
      .reduce((sum, item) => sum.plus(item.totalAmount), D(0))
    const income = calculateReportableIncomeTax(eriAmount.toString(), profile, rules)
    const cashInterest = entries.filter(item => item.type === 'INTEREST' && taxYearForDate(item.date) === label)
      .reduce((sum, item) => sum.plus(item.grossValue), D(0))
    output.push({
      taxYear: label,
      confirmedRules: rules.confirmed,
      sourceNote: rules.sourceNote,
      giaDisposals: disposals.length,
      disposalProceeds: money(disposals.reduce((sum, item) => sum.plus(item.grossValue), D(0))),
      realisedGains: money(realisedGains),
      capitalLosses: money(profile.capitalLosses),
      netGain: cgt.netGainBeforeExemption,
      annualExemptionUsed: cgt.annualExemptionUsed,
      taxableCapitalGain: cgt.taxableGain,
      estimatedCgt: cgt.estimatedCgt,
      vuagEri: money(eriAmount),
      otherReportableIncome: money(profile.otherDividendIncome),
      dividendAllowanceUsed: income.dividendAllowanceUsed,
      estimatedIncomeTax: income.estimatedIncomeTax,
      totalEstimatedTax: money(D(cgt.estimatedCgt).plus(income.estimatedIncomeTax)),
      cashInterest: money(cashInterest),
      cgt,
      income
    })
  }
  return output
}

export async function getProjection(
  years: number,
  annualReturnPercent: string,
  annualWithdrawal = '0',
  withdrawFrom: InvestmentAccountType = 'ISA'
): Promise<ProjectionPoint[]> {
  const snapshot = await getPortfolioSnapshot()
  if (!snapshot.initialized || !snapshot.isa || !snapshot.gia) return []
  const { rules, profile } = await getTaxContext(snapshot.taxYear)
  return projectPortfolio({
    years,
    annualReturnPercent,
    startingIsaValue: snapshot.isa.value,
    startingGiaValue: snapshot.gia.value,
    startingGiaBaseCost: snapshot.gia.adjustedBaseCost,
    startingCash: snapshot.cash?.balance ?? '0',
    cashInterestPercent: snapshot.cash?.interestRatePercent ?? DEFAULT_SETTINGS.cash_interest_rate,
    annualWithdrawal,
    withdrawFrom,
    rules,
    profile,
    startYear: new Date().getUTCFullYear()
  })
}

export async function getEriRecords() {
  await ensureApplicationDefaults()
  const db = getDatabase()
  const record = db.select().from(portfolio).limit(1).get()
  return record ? db.select().from(eriRecord).where(eq(eriRecord.portfolioId, record.id)).orderBy(desc(eriRecord.reportingPeriodEnd)).all() : []
}

async function realisedGainForYear(portfolioId: number, label: string) {
  const db = getDatabase()
  const entries = db.select().from(transaction).where(and(
    eq(transaction.portfolioId, portfolioId),
    eq(transaction.type, 'GIA_SELL')
  )).all()
  return entries.filter(item => taxYearForDate(item.date) === label).reduce((sum, item) => sum.plus(item.realisedGain), D(0))
}

async function isaContributionsForYear(portfolioId: number, label: string) {
  const db = getDatabase()
  const isaAccounts = db.select({ id: account.id }).from(account).where(and(
    eq(account.portfolioId, portfolioId),
    eq(account.type, 'ISA')
  )).all().map(item => item.id)
  if (!isaAccounts.length) return D(0)
  return db.select().from(transaction).where(and(
    eq(transaction.portfolioId, portfolioId),
    inArray(transaction.accountId, isaAccounts),
    inArray(transaction.type, ['INITIAL_BUY', 'ISA_BUY'])
  )).all().filter(item => taxYearForDate(item.date) === label)
    .reduce((sum, item) => sum.plus(item.grossValue), D(0))
}

/** Pays any finished months at the stored rate, so a new rate only applies from the current month. */
export async function settleCashInterest() {
  const applicationSettings = await readSettings()
  const record = getDatabase().select().from(portfolio).limit(1).get()
  if (record?.status === 'ACTIVE') settleCash(record.id, cashInterestRate(applicationSettings.settings))
}

async function prepareWithdrawal(amount: string, accountType: InvestmentAccountType) {
  const snapshot = await getPortfolioSnapshot()
  if (!snapshot.initialized || !snapshot.market) throw new Error('Initialize the portfolio before withdrawing to cash')
  const db = getDatabase()
  const record = db.select().from(portfolio).limit(1).get()
  if (!record) throw new Error('Portfolio not found')
  const investmentAccount = db.select().from(account)
    .where(and(eq(account.portfolioId, record.id), eq(account.type, accountType))).get()
  const position = investmentAccount ? db.select().from(holding).where(eq(holding.accountId, investmentAccount.id)).get() : undefined
  if (!investmentAccount || !position) throw new Error(`The ${accountType} holding was not found`)
  // Sales use the current quote, so they are always dated today and never backdated.
  const date = todayIso()
  const label = taxYearForDate(date)
  const { rules, profile } = await getTaxContext(label)
  const plan = planWithdrawal({
    date,
    account: accountType,
    amount,
    price: snapshot.market.price,
    units: position.units,
    originalCost: position.originalCost,
    eriAdjustment: position.eriAdjustment,
    cashBalance: snapshot.cash?.balance ?? '0',
    realisedGainsThisYear: (await realisedGainForYear(record.id, label)).toString(),
    profile,
    rules
  })
  return {
    preview: { ...plan, priceStale: snapshot.market.stale, manualPrice: snapshot.market.manual },
    record,
    investmentAccountId: investmentAccount.id,
    position
  }
}

/**
 * Posts monthly interest for every completed month that has not been paid yet, then returns the cash
 * account's movements and balance. Postings are written lazily when the portfolio is read, and each
 * month uses the rate in Settings at the time it is settled.
 */
function settleCash(portfolioId: number, ratePercent: string): CashState {
  const db = getDatabase()
  const asOf = todayIso()
  return db.transaction(tx => {
    const cashAccount = tx.select({ id: account.id }).from(account)
      .where(and(eq(account.portfolioId, portfolioId), eq(account.type, 'CASH'))).get()
    if (!cashAccount) {
      return { accountId: null, ratePercent, entries: [], movements: [], balance: '0.00', accruedInterest: '0.00' }
    }
    const rows = tx.select().from(transaction).where(eq(transaction.accountId, cashAccount.id))
      .orderBy(asc(transaction.date), asc(transaction.id)).all()
    const entries = rows.map(row => ({ type: row.type, date: row.date, grossValue: row.grossValue }))
    const movements = toCashMovements(entries)
    const firstMovement = movements[0]
    if (!firstMovement) {
      return { accountId: cashAccount.id, ratePercent, entries, movements, balance: '0.00', accruedInterest: '0.00' }
    }
    // Settlement progress is tracked separately from INTEREST rows because a month can settle at £0
    // (a 0% rate or no cash held) and must not be paid again later at a different rate.
    const settledThrough = tx.select({ value: appSetting.value }).from(appSetting)
      .where(eq(appSetting.key, CASH_INTEREST_SETTLED_KEY)).get()?.value
      ?? entries.filter(entry => entry.type === 'INTEREST').at(-1)?.date.slice(0, 7)
    const fromMonth = settledThrough ? monthAfter(settledThrough) : firstMovement.date.slice(0, 7)
    const { postings, accruedThisMonth } = calculateInterest({ movements, annualRatePercent: ratePercent, fromMonth, asOf })
    const now = new Date().toISOString()
    const completedThrough = lastCompletedMonth(asOf)
    if (fromMonth <= completedThrough) {
      tx.insert(appSetting).values({ key: CASH_INTEREST_SETTLED_KEY, value: completedThrough, updatedAt: now })
        .onConflictDoUpdate({ target: appSetting.key, set: { value: completedThrough, updatedAt: now } }).run()
    }
    for (const posting of postings) {
      tx.insert(transaction).values({
        portfolioId, accountId: cashAccount.id, date: posting.date, type: 'INTEREST', symbol: CASH_SYMBOL,
        units: '0', price: '0', grossValue: posting.amount, costBasis: '0.00', realisedGain: '0.00',
        eriAdjustment: '0.00', estimatedTax: '0.00',
        notes: `Interest for ${posting.month} at ${D(ratePercent).toFixed(2)}% a year, accrued daily on the cash balance and paid monthly.`,
        createdAt: now
      }).run()
      entries.push({ type: 'INTEREST', date: posting.date, grossValue: posting.amount })
    }
    const settled = postings.length ? toCashMovements(entries) : movements
    return {
      accountId: cashAccount.id,
      ratePercent,
      entries,
      movements: settled,
      balance: cashBalance(settled),
      accruedInterest: accruedThisMonth
    }
  })
}

function summariseCash(cash: CashState, taxYearLabel: string, totalPortfolioValue: ReturnType<typeof D>): CashSnapshot {
  const total = (type: TransactionType, include: (date: string) => boolean = () => true) => money(cash.entries
    .filter(entry => entry.type === type && include(entry.date))
    .reduce((sum, entry) => sum.plus(entry.grossValue), D(0)))
  return {
    id: cash.accountId,
    balance: cash.balance,
    interestRatePercent: D(cash.ratePercent).toFixed(2),
    accruedInterest: cash.accruedInterest,
    interestThisTaxYear: total('INTEREST', date => taxYearForDate(date) === taxYearLabel),
    totalInterest: total('INTEREST'),
    totalTakenOut: total('CASH_WITHDRAWAL'),
    portfolioPercent: ratioPercent(cash.balance, totalPortfolioValue)
  }
}

function toCashMovements(entries: CashState['entries']) {
  return entries.map(entry => cashMovement(entry.type, entry.date, entry.grossValue))
    .filter((item): item is CashMovement => item !== null)
}

function cashInterestRate(settings: Record<string, string>) {
  return settings.cash_interest_rate ?? DEFAULT_SETTINGS.cash_interest_rate
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function giaUnitsAtDate(portfolioId: number, accountId: number, date: string) {
  const db = getDatabase()
  const entries = db.select().from(transaction).where(and(
    eq(transaction.portfolioId, portfolioId),
    eq(transaction.accountId, accountId),
    lte(transaction.date, date),
    inArray(transaction.type, ['INITIAL_BUY', 'ADJUSTMENT', 'GIA_SELL'])
  )).all()
  return precise(entries.reduce((sum, item) => item.type === 'GIA_SELL' ? sum.minus(item.units) : sum.plus(item.units), D(0)))
}

function rangeStart(range: string, portfolioStart: string, to: Date) {
  const from = new Date(to)
  const months: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '3Y': 36, '5Y': 60 }
  if (months[range]) from.setUTCMonth(from.getUTCMonth() - months[range])
  else if (range === 'YTD') from.setUTCMonth(0, 1)
  else return new Date(`${portfolioStart}T00:00:00Z`)
  const portfolioDate = new Date(`${portfolioStart}T00:00:00Z`)
  return from < portfolioDate ? portfolioDate : from
}

function emptySnapshot(asOf: string): PortfolioSnapshot {
  return {
    initialized: false,
    portfolioId: null,
    asOf,
    initialInvestment: '100000.00',
    currentValue: '0.00',
    totalGainLoss: '0.00',
    totalGainLossPercent: '0.0000',
    todayChange: '0.00',
    todayChangePercent: '0.0000',
    isa: null,
    gia: null,
    cash: null,
    market: null,
    potentialCgt: null,
    incomeTax: null,
    estimatedTaxDueNow: '0.00',
    unrealisedPotentialTax: '0.00',
    reportableIncomeStatus: 'awaiting',
    reportableIncome: '0.00',
    cashDividends: '0.00',
    unusedCgtExemption: '3000.00',
    remainingDividendAllowance: '500.00',
    taxYear: taxYearForDate(asOf),
    taxRulesAssumed: false,
    refreshIntervalMs: 900000
  }
}

function DecimalMax(a: ReturnType<typeof D>, b: ReturnType<typeof D>) {
  return a.gt(b) ? a : b
}
