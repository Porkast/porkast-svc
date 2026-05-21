import type { DbClient } from "../../db/types"
import { eq, and, desc, sql } from 'drizzle-orm'
import * as schema from '../../db/schema'
import {
  JWSTransactionDecoded,
  MembershipStatusResult,
  PRODUCT_TIER_MAP,
  TIER_KEYWORDS_LIMIT,
} from "./types"

function decodeJWSPayload(signedTransaction: string): JWSTransactionDecoded {
  const parts = signedTransaction.split(".")
  if (parts.length < 3) {
    throw new Error("Invalid JWS transaction: expected 3 parts")
  }
  const payloadEncoded = parts[1]
  const payloadJson = atob(payloadEncoded)
  const payload = JSON.parse(payloadJson)
  return {
    transactionId: payload.transactionId,
    originalTransactionId: payload.originalTransactionId,
    productId: payload.productId,
    expiresDate: payload.expiresDate,
    revocationDate: payload.revocationDate,
    revocationReason: payload.revocationReason,
    offerType: payload.offerType,
    offerIdentifier: payload.offerIdentifier,
    type: payload.type,
    inAppOwnershipType: payload.inAppOwnershipType,
    signedDate: payload.signedDate,
    environment: payload.environment,
  }
}

function resolveTier(productId: string): string {
  return PRODUCT_TIER_MAP[productId] ?? "free"
}

export async function syncMembership(
  db: DbClient,
  signedTransaction: string,
  environment: string
): Promise<MembershipStatusResult> {
  const decoded = decodeJWSPayload(signedTransaction)
  const productId = decoded.productId
  const tier = resolveTier(productId)
  const originalTransactionId = decoded.originalTransactionId
  const latestTransactionId = decoded.transactionId
  const expiresDateObj = decoded.expiresDate
    ? new Date(decoded.expiresDate)
    : null
  const isRevoked = decoded.revocationDate != null
  const now = new Date()
  const isActive = !isRevoked && expiresDateObj != null && expiresDateObj > now
  const willRenew = decoded.offerType !== 1

  const existingResult = await db
    .select()
    .from(schema.userMembership)
    .where(eq(schema.userMembership.originalTransactionId, originalTransactionId))
    .limit(1)

  const existing = existingResult[0] || null

  let userId: string
  if (existing) {
    userId = existing.userId
  } else {
    throw new Error(
      "Membership not found. Provide userId for new purchases."
    )
  }

  const membershipData = {
    userId,
    productId,
    tier,
    originalTransactionId,
    latestTransactionId,
    expiresDate: expiresDateObj?.toISOString() ?? null,
    isActive,
    willRenew,
    isInBillingRetry: false,
    environment,
  }

  if (existing) {
    await db
      .update(schema.userMembership)
      .set({
        ...membershipData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.userMembership.id, existing.id))
  }

  return getUserMembershipStatus(db, userId)
}

export async function syncMembershipForUser(
  db: DbClient,
  signedTransaction: string,
  environment: string,
  userId: string
): Promise<MembershipStatusResult> {
  const decoded = decodeJWSPayload(signedTransaction)
  const productId = decoded.productId
  const tier = resolveTier(productId)
  const originalTransactionId = decoded.originalTransactionId
  const latestTransactionId = decoded.transactionId
  const expiresDateObj = decoded.expiresDate
    ? new Date(decoded.expiresDate)
    : null
  const isRevoked = decoded.revocationDate != null
  const now = new Date()
  const isActive = !isRevoked && expiresDateObj != null && expiresDateObj > now

  const existingResult = await db
    .select()
    .from(schema.userMembership)
    .where(eq(schema.userMembership.originalTransactionId, originalTransactionId))
    .limit(1)

  const existing = existingResult[0] || null

  const nowISO = new Date().toISOString()

  const membershipData = {
    userId,
    productId,
    tier,
    originalTransactionId,
    latestTransactionId,
    expiresDate: expiresDateObj?.toISOString() ?? null,
    isActive,
    willRenew: true,
    isInBillingRetry: false,
    environment,
  }

  if (existing) {
    if (existing.userId !== userId) {
      throw new Error("Transaction belongs to a different user")
    }
    await db
      .update(schema.userMembership)
      .set({
        ...membershipData,
        updatedAt: nowISO,
      })
      .where(eq(schema.userMembership.id, existing.id))
  } else {
    await db.insert(schema.userMembership).values({
      id: crypto.randomUUID(),
      ...membershipData,
      createdAt: nowISO,
      updatedAt: nowISO,
    })
  }

  return getUserMembershipStatus(db, userId)
}

export async function getUserMembershipStatus(
  db: DbClient,
  userId: string
): Promise<MembershipStatusResult> {
  const membershipResult = await db
    .select()
    .from(schema.userMembership)
    .where(
      and(
        eq(schema.userMembership.userId, userId),
        eq(schema.userMembership.isActive, true),
        sql`${schema.userMembership.expiresDate} > ${new Date().toISOString()}`,
      )
    )
    .orderBy(desc(schema.userMembership.expiresDate))
    .limit(1)

  const membership = membershipResult[0] || null

  const keywordsUsed = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.userSubscription)
    .where(
      and(
        eq(schema.userSubscription.userId, userId),
        eq(schema.userSubscription.status, 1),
      )
    )
    .then(r => r[0]?.count || 0)

  if (membership) {
    const tier = membership.tier
    return {
      tier,
      productId: membership.productId,
      expiresDate: membership.expiresDate?.toString() ?? null,
      isActive: true,
      willRenew: membership.willRenew ?? true,
      keywordsLimit: TIER_KEYWORDS_LIMIT[tier] ?? null,
      keywordsUsed,
    }
  }

  return {
    tier: "free",
    productId: null,
    expiresDate: null,
    isActive: false,
    willRenew: false,
    keywordsLimit: TIER_KEYWORDS_LIMIT["free"],
    keywordsUsed,
  }
}

export async function getUserTier(db: DbClient, userId: string): Promise<string> {
  const status = await getUserMembershipStatus(db, userId)
  return status.tier
}

export async function getUserKeywordsLimit(
  db: DbClient,
  userId: string
): Promise<number | null> {
  const status = await getUserMembershipStatus(db, userId)
  return status.keywordsLimit
}

export async function getUserKeywordsUsed(db: DbClient, userId: string): Promise<number> {
  const status = await getUserMembershipStatus(db, userId)
  return status.keywordsUsed
}

export async function checkKeywordLimit(
  db: DbClient,
  userId: string
): Promise<{ allowed: boolean; limit: number | null; used: number }> {
  const status = await getUserMembershipStatus(db, userId)
  const limit = status.keywordsLimit
  const used = status.keywordsUsed
  if (limit === null) {
    return { allowed: true, limit: null, used }
  }
  return { allowed: used < limit, limit, used }
}
