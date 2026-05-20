import { createMiddleware } from 'hono/factory'
import { createDb } from './client'
import type { Env } from '../env'

declare module 'hono' {
  interface ContextVariableMap {
    db: ReturnType<typeof createDb>
  }
}

export const dbMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const db = createDb(c.env.DB)
  c.set('db', db)
  await next()
})
