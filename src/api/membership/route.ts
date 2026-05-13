import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { SyncMembershipSchema } from "./types"
import { syncMembershipForUser, getUserMembershipStatus } from "./membership"
import { handleAppStoreNotification } from "./webhook"
import { getBearerToken } from "../auth/auth"

export const membershipRouter = new Hono()

membershipRouter.post("/webhook/appstore", async (c) => {
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

membershipRouter.post("/sync", zValidator("json", SyncMembershipSchema), async (c) => {
  const body = c.req.valid("json")
  const signedTransaction = body.signedTransaction
  const environment = body.environment || "Production"

  // Extract userId from Authorization header
  const token = getBearerToken(c.req.header("Authorization") || "")
  if (!token) {
    return c.json({ code: 1, msg: "Authorization required" }, 401)
  }

  // We need userId. Get it from session lookup.
  const prisma = (await import("../../db/prisma.client")).default
  const crypto = await import("crypto")
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  const session = await prisma.app_session.findFirst({
    where: { token_hash: tokenHash, revoked_at: null, expires_at: { gt: new Date() } },
  })
  if (!session) {
    return c.json({ code: 1, msg: "Invalid session" }, 401)
  }
  const userId = session.user_id

  try {
    const status = await syncMembershipForUser(signedTransaction, environment, userId)
    return c.json({ code: 0, msg: "Membership synced", data: status })
  } catch (error) {
    return c.json({ code: 1, msg: String(error) })
  }
})

membershipRouter.get("/status", async (c) => {
  const userId = c.req.query("userId")
  if (!userId) {
    return c.json({ code: 1, msg: "userId is required" })
  }

  try {
    const status = await getUserMembershipStatus(userId)
    return c.json({ code: 0, msg: "Success", data: status })
  } catch (error) {
    return c.json({ code: 1, msg: String(error) })
  }
})
