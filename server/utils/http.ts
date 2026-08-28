import { createError } from 'h3'
import type { ZodType } from 'zod'

export function parseWithZod<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: result.error.flatten()
    })
  }
  return result.data
}

export function apiError(error: unknown) {
  if (error && typeof error === 'object' && 'statusCode' in error) throw error
  throw createError({
    statusCode: 500,
    statusMessage: error instanceof Error ? error.message : 'Unexpected server error'
  })
}
