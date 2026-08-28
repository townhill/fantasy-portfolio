import { readBody } from 'h3'
import { z } from 'zod'
import { applyBedIsa } from '../../services/portfolio'
import { apiError, parseWithZod } from '../../utils/http'

const schema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  date: z.iso.date().optional(),
  confirmation: z.literal(true)
})

export default defineEventHandler(async event => {
  try {
    const input = parseWithZod(schema, await readBody(event))
    return await applyBedIsa(input.amount, input.date)
  } catch (error) {
    return apiError(error)
  }
})
