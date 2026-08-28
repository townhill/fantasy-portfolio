import { readBody } from 'h3'
import { z } from 'zod'
import { addEriRecord } from '../services/portfolio'
import { apiError, parseWithZod } from '../utils/http'

const schema = z.object({
  reportingPeriodStart: z.iso.date(),
  reportingPeriodEnd: z.iso.date(),
  fundDistributionDate: z.iso.date(),
  eriPerUnit: z.string().regex(/^\d+(\.\d{1,8})?$/),
  currency: z.literal('GBP').default('GBP'),
  source: z.string().min(2).max(200),
  sourceDocument: z.string().min(2).max(500),
  verified: z.boolean().default(false),
  notes: z.string().max(1000).default('')
}).refine(input => input.reportingPeriodEnd >= input.reportingPeriodStart, {
  message: 'Reporting period end must not precede its start',
  path: ['reportingPeriodEnd']
})

export default defineEventHandler(async event => {
  try {
    return await addEriRecord(parseWithZod(schema, await readBody(event)))
  } catch (error) {
    return apiError(error)
  }
})
