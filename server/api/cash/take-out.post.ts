import { readBody } from 'h3'
import { z } from 'zod'
import { takeOutCash } from '../../services/portfolio'
import { apiError, parseWithZod } from '../../utils/http'

const schema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  note: z.string().max(200).default(''),
  confirmation: z.literal(true)
})

export default defineEventHandler(async event => {
  try {
    const input = parseWithZod(schema, await readBody(event))
    return await takeOutCash(input.amount, input.note)
  } catch (error) {
    return apiError(error)
  }
})
