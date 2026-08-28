import { readBody } from 'h3'
import { z } from 'zod'
import { getProjection } from '../services/portfolio'
import { apiError, parseWithZod } from '../utils/http'

const schema = z.object({
  years: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]),
  annualReturnPercent: z.string().regex(/^-?\d+(\.\d{1,2})?$/).refine(value => Number(value) >= -100 && Number(value) <= 100)
})

export default defineEventHandler(async event => {
  try {
    const input = parseWithZod(schema, await readBody(event))
    return await getProjection(input.years, input.annualReturnPercent)
  } catch (error) {
    return apiError(error)
  }
})
