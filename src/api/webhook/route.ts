import { Hono } from "hono"
import { handleAppStoreNotification } from "../membership/webhook"

export const webhookRouter = new Hono()

webhookRouter.post("/appstore", async (c) => {
  try {
    const body = await c.req.json()
    const signedPayload = body.signedPayload
    if (!signedPayload) {
      return c.json({ code: 1, msg: "signedPayload is required" }, 400)
    }

    await handleAppStoreNotification(signedPayload)
    return c.json({ code: 0, msg: "Notification processed" })
  } catch (error) {
    return c.json({ code: 1, msg: String(error) }, 500)
  }
})
