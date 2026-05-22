import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { SyncMembershipSchema } from "./types"
import { syncMembershipForUser, getUserMembershipStatus } from "./membership"
import { handleAppStoreNotification } from "./webhook"
import { getBearerToken } from "../auth/auth"
import type { Env } from '../../env'
import { createDb } from '../../db/client'
import { createHash } from 'crypto'
import { appSession } from '../../db/schema'
import { eq, and, gt, isNull } from 'drizzle-orm'

export const membershipRouter = new Hono<{ Bindings: Env }>()

membershipRouter.post("/webhook/appstore", async (c) => {
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

membershipRouter.post("/sync", zValidator("json", SyncMembershipSchema), async (c) => {
  const db = createDb(c.env.DB)
  const body = c.req.valid("json")
  const signedTransaction = body.signedTransaction
  const environment = body.environment || "Production"

  // Extract userId from Authorization header
  const token = getBearerToken(c.req.header("Authorization") || "")
  if (!token) {
    return c.json({ code: 1, msg: "Authorization required" }, 401)
  }

  const tokenHash = createHash("sha256").update(token).digest("hex")
  const sessions = await db.select().from(appSession).where(and(eq(appSession.tokenHash, tokenHash), isNull(appSession.revokedAt), gt(appSession.expiresAt, new Date().toISOString()))).limit(1)
  if (!sessions.length) {
    return c.json({ code: 1, msg: "Invalid session" }, 401)
  }
  const userId = sessions[0].userId

  try {
    const status = await syncMembershipForUser(db, signedTransaction, environment, userId)
    return c.json({ code: 0, msg: "Membership synced", data: status })
  } catch (error) {
    return c.json({ code: 1, msg: String(error) })
  }
})

membershipRouter.get("/status", async (c) => {
  const db = createDb(c.env.DB)
  const userId = c.req.query("userId")
  if (!userId) {
    return c.json({ code: 1, msg: "userId is required" })
  }

  try {
    const status = await getUserMembershipStatus(db, userId)
    return c.json({ code: 0, msg: "Success", data: status })
  } catch (error) {
    return c.json({ code: 1, msg: String(error) })
  }
})
