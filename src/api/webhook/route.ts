import { Hono } from "hono"
import { handleAppStoreNotification } from "../membership/webhook"
import type { Env } from '../../env'
import { createDb } from '../../db/client'

export const webhookRouter = new Hono<{ Bindings: Env }>()

webhookRouter.post("/appstore", async (c) => {
  try {
    const db = createDb(c.env.DB)
    const body = await c.req.json()
    const signedPayload = body.signedPayload
    if (!signedPayload) {
      return c.json({ code: 1, msg: "signedPayload is required" }, 400)
    }

    await handleAppStoreNotification(db, signedPayload)
    return c.json({ code: 0, msg: "Notification processed" })
  } catch (error) {
    return c.json({ code: 1, msg: String(error) }, 500)
  }
})
