import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

/**
 * Propaga o crea `X-Request-ID` (útil para trazar logs y el proxy LLM).
 */
export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const id = (req.get('X-Request-ID') || req.get('x-request-id') || randomUUID()).toString()
  res.setHeader('X-Request-ID', id)
  req.nelaiRequestId = id
  next()
}
