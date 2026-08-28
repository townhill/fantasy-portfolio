import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import type {
  BedIsaPreview,
  LedgerEntry,
  PerformancePoint,
  PortfolioSnapshot,
  ProjectionPoint
} from '../../shared/types/domain'
import { getDatabase } from '../database/client'
import {
  account,
  eriRecord,
  holding,
  marketPrice,
  portfolio,
  taxCalculation,
  transaction
} from '../database/schema'
import { D, money, precise, ratioPercent } from '../utils/decimal'
import { createInitialAllocations, valueAccount } from './accounting/portfolio'
import { planBedAndIsa } from './bed-isa/planner'
import { MarketDataService } from './market/service'
import { projectPortfolio } from './projection/projector'
import { ensureApplicationDefaults, getTaxContext, readSettings } from './settings'
import { calculateCgt } from './tax/cgt'
import { calculateEri } from './tax/eri'
import { calculateReportableIncomeTax } from './tax/income'
import { taxYearForDate } from './tax/rules'

const SYMBOL = 'VUAG.L'

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
  const totalUnits = rows.reduce((sum, row) => sum.plus(row.units), D(0))
  const currentValue = totalUnits.mul(quote.price)
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
  const gain = currentValue.minus(record.initialInvestment)
  const todayChange = quote.previousClose ? totalUnits.mul(D(quote.price).minus(quote.previousClose)) : D(0)
  const potentialCgt = gia ? calculateCgt({
    realisedGain: gia.gainLoss,
    profile,
    rules,
    exemptionAlreadyUsed: await cgtExemptionUsed(record.id, currentTaxYear, rules.cgtAnnualExemption)
  }) : null

  const verifiedEri = db.select().from(eriRecord).where(and(
    eq(eriRecord.portfolioId, record.id),
    eq(eriRecord.verified, true)
  )).all().filter(item => taxYearForDate(item.fundDistributionDate) === currentTaxYear)
  const reportableIncome = verifiedEri.reduce((sum, item) => sum.plus(item.totalAmount), D(0))
  const incomeTax = calculateReportableIncomeTax(reportableIncome.toString(), profile, rules)
  const realisedGain = await realisedGainForYear(record.id, currentTaxYear)
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
    todayChangePercent: quote.previousClose ? ratioPercent(D(quote.price).minus(quote.previousClose), quote.previousClose) : '0.0000',
    isa,
    gia,
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
  await ensureApplicationDefaults()
  const db = getDatabase()
  const record = db.select().from(portfolio).limit(1).get()
  if (!record || record.status !== 'ACTIVE') return []
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
      }
    }
    const isaValue = isaUnits.mul(point.price)
    const giaValue = giaUnits.mul(point.price)
    return {
      date: point.date,
      price: point.price,
      total: money(isaValue.plus(giaValue)),
      isa: money(isaValue),
      gia: money(giaValue),
      historical: true
    }
  })
}

export async function getLedger(): Promise<LedgerEntry[]> {
  await ensureApplicationDefaults()
  const db = getDatabase()
  const record = db.select().from(portfolio).limit(1).get()
  if (!record) return []
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
    exemptionAlreadyUsed: await cgtExemptionUsed(snapshot.portfolioId!, taxYearForDate(date), rules.cgtAnnualExemption)
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
  await ensureApplicationDefaults()
  const db = getDatabase()
  const record = db.select().from(portfolio).limit(1).get()
  if (!record) return []
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
      cgt,
      income
    })
  }
  return output
}

export async function getProjection(years: number, annualReturnPercent: string): Promise<ProjectionPoint[]> {
  const snapshot = await getPortfolioSnapshot()
  if (!snapshot.initialized || !snapshot.isa || !snapshot.gia) return []
  const { rules, profile } = await getTaxContext(snapshot.taxYear)
  return projectPortfolio({
    years,
    annualReturnPercent,
    startingIsaValue: snapshot.isa.value,
    startingGiaValue: snapshot.gia.value,
    startingGiaBaseCost: snapshot.gia.adjustedBaseCost,
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

async function cgtExemptionUsed(portfolioId: number, label: string, exemption: string) {
  const realised = await realisedGainForYear(portfolioId, label)
  return money(DecimalMin(DecimalMax(realised, D(0)), D(exemption)))
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

function DecimalMin(a: ReturnType<typeof D>, b: ReturnType<typeof D>) {
  return a.lt(b) ? a : b
}

function DecimalMax(a: ReturnType<typeof D>, b: ReturnType<typeof D>) {
  return a.gt(b) ? a : b
}
