import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { CreateCheckoutSchema, SyncMembershipSchema } from "./types"
import { syncMembershipForUser, getUserMembershipStatus } from "./membership"
import {
  createDodoCheckoutSession,
  createDodoPortalSession,
  handleDodoWebhook,
  DodoWebhookVerificationError,
} from "./dodo"
import { handleAppStoreNotification } from "./webhook"
import { getBearerToken } from "../auth/auth"
import type { Env } from '../../env'
import { createDb } from '../../db/client'
import type { DbClient } from '../../db/types'
import { createHash } from 'crypto'
import { appSession } from '../../db/schema'
import { eq, and, gt, isNull } from 'drizzle-orm'

export const membershipRouter = new Hono<{ Bindings: Env }>()

async function getUserIdFromRequest(
  db: DbClient,
  authHeader: string | undefined
): Promise<string | null> {
  const token = getBearerToken(authHeader || "")
  if (!token) {
    return null
  }

  const tokenHash = createHash("sha256").update(token).digest("hex")
  const sessions = await db
    .select()
    .from(appSession)
    .where(
      and(
        eq(appSession.tokenHash, tokenHash),
        isNull(appSession.revokedAt),
        gt(appSession.expiresAt, new Date().toISOString())
      )
    )
    .limit(1)

  return sessions[0]?.userId ?? null
}

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

membershipRouter.post("/webhook/dodo", async (c) => {
  const db = createDb(c.env.DB)
  const rawBody = await c.req.text()

  try {
    await handleDodoWebhook(db, c.env, rawBody, {
      "webhook-id": c.req.header("webhook-id") ?? "",
      "webhook-signature": c.req.header("webhook-signature") ?? "",
      "webhook-timestamp": c.req.header("webhook-timestamp") ?? "",
    })
    return c.json({ code: 0, msg: "Notification processed" })
  } catch (error) {
    if (error instanceof DodoWebhookVerificationError) {
      return c.json({ code: 1, msg: "Invalid webhook signature" }, 401)
    }
    return c.json({ code: 1, msg: String(error) }, 500)
  }
})

membershipRouter.post("/sync", zValidator("json", SyncMembershipSchema), async (c) => {
  const db = createDb(c.env.DB)
  const body = c.req.valid("json")
  const signedTransaction = body.signedTransaction
  const environment = body.environment || "Production"

  const userId = await getUserIdFromRequest(db, c.req.header("Authorization"))
  if (!userId) {
    return c.json({ code: 1, msg: "Authorization required" }, 401)
  }

  try {
    const status = await syncMembershipForUser(db, signedTransaction, environment, userId)
    return c.json({ code: 0, msg: "Membership synced", data: status })
  } catch (error) {
    return c.json({ code: 1, msg: String(error) })
  }
})

membershipRouter.post("/checkout", zValidator("json", CreateCheckoutSchema), async (c) => {
  const db = createDb(c.env.DB)
  const userId = await getUserIdFromRequest(db, c.req.header("Authorization"))
  if (!userId) {
    return c.json({ code: 1, msg: "Authorization required" }, 401)
  }

  const { plan } = c.req.valid("json")

  try {
    const result = await createDodoCheckoutSession(db, c.env, userId, plan)
    return c.json({ code: 0, msg: "Success", data: result })
  } catch (error) {
    return c.json({ code: 1, msg: String(error) }, 500)
  }
})

membershipRouter.post("/portal", async (c) => {
  const db = createDb(c.env.DB)
  const userId = await getUserIdFromRequest(db, c.req.header("Authorization"))
  if (!userId) {
    return c.json({ code: 1, msg: "Authorization required" }, 401)
  }

  try {
    const url = await createDodoPortalSession(db, c.env, userId)
    return c.json({ code: 0, msg: "Success", data: { url } })
  } catch (error) {
    return c.json({ code: 1, msg: String(error) }, 500)
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
