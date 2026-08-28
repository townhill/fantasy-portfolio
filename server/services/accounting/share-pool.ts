import { D, money, precise } from '../../utils/decimal'

export interface AcquisitionLot {
  id: string
  date: string
  units: string
  cost: string
}

export interface ShareMatch {
  rule: 'SAME_DAY' | 'BED_AND_BREAKFAST' | 'SECTION_104'
  acquisitionId: string | null
  units: string
  cost: string
}

export interface ShareDisposalResult {
  disposedUnits: string
  proceeds: string
  allowableCost: string
  realisedGain: string
  matches: ShareMatch[]
  remainingPoolUnits: string
  remainingPoolCost: string
}

export function matchShareDisposal(input: {
  disposalDate: string
  disposedUnits: string
  proceeds: string
  poolUnits: string
  poolCost: string
  acquisitions?: AcquisitionLot[]
}): ShareDisposalResult {
  let remaining = D(input.disposedUnits)
  let allowableCost = D(0)
  const matches: ShareMatch[] = []
  const disposalTime = dateNumber(input.disposalDate)
  const acquisitions = [...(input.acquisitions ?? [])]

  const matchLots = (rule: ShareMatch['rule'], predicate: (lot: AcquisitionLot) => boolean) => {
    for (const lot of acquisitions.filter(predicate)) {
      if (remaining.lte(0)) break
      const lotUnits = D(lot.units)
      const matchedUnits = DecimalMin(remaining, lotUnits)
      const matchedCost = D(lot.cost).mul(matchedUnits).div(lotUnits)
      matches.push({ rule, acquisitionId: lot.id, units: precise(matchedUnits), cost: money(matchedCost) })
      allowableCost = allowableCost.plus(matchedCost)
      remaining = remaining.minus(matchedUnits)
    }
  }

  matchLots('SAME_DAY', lot => dateNumber(lot.date) === disposalTime)
  matchLots('BED_AND_BREAKFAST', lot => {
    const days = Math.round((dateNumber(lot.date) - disposalTime) / 86_400_000)
    return days >= 1 && days <= 30
  })

  const poolUnits = D(input.poolUnits)
  const poolCost = D(input.poolCost)
  if (remaining.gt(0)) {
    if (remaining.gt(poolUnits)) throw new Error('Disposal exceeds the available Section 104 pool')
    const section104Cost = poolUnits.eq(0) ? D(0) : poolCost.mul(remaining).div(poolUnits)
    matches.push({ rule: 'SECTION_104', acquisitionId: null, units: precise(remaining), cost: money(section104Cost) })
    allowableCost = allowableCost.plus(section104Cost)
  }

  const poolMatchedUnits = matches
    .filter(match => match.rule === 'SECTION_104')
    .reduce((sum, match) => sum.plus(match.units), D(0))
  const poolMatchedCost = matches
    .filter(match => match.rule === 'SECTION_104')
    .reduce((sum, match) => sum.plus(match.cost), D(0))

  return {
    disposedUnits: precise(input.disposedUnits),
    proceeds: money(input.proceeds),
    allowableCost: money(allowableCost),
    realisedGain: money(D(input.proceeds).minus(allowableCost)),
    matches,
    remainingPoolUnits: precise(poolUnits.minus(poolMatchedUnits)),
    remainingPoolCost: money(poolCost.minus(poolMatchedCost))
  }
}

function dateNumber(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`).getTime()
}

function DecimalMin(a: ReturnType<typeof D>, b: ReturnType<typeof D>) {
  return a.lt(b) ? a : b
}
