import prisma from "../../db/prisma.client"
import { v4 as uuidv4 } from "uuid"
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
  signedTransaction: string,
  environment: string
): Promise<MembershipStatusResult> {
  const decoded = decodeJWSPayload(signedTransaction)
  const productId = decoded.productId
  const tier = resolveTier(productId)
  const originalTransactionId = decoded.originalTransactionId
  const latestTransactionId = decoded.transactionId
  const expiresDate = decoded.expiresDate
    ? new Date(decoded.expiresDate)
    : null
  const isRevoked = decoded.revocationDate != null
  const now = new Date()
  const isActive = !isRevoked && expiresDate != null && expiresDate > now
  const willRenew = decoded.offerType !== 1 // type 1 = introductory, but we check revocation instead

  // Find the user who owns this transaction. For new purchases, we need userId from auth context.
  // We'll look up existing membership by original_transaction_id.
  // If not found, this is a new purchase — the route handler will extract userId from auth.
  const existing = await prisma.user_membership.findUnique({
    where: { original_transaction_id: originalTransactionId },
  })

  let userId: string
  if (existing) {
    userId = existing.user_id
  } else {
    // For new purchases, userId must be provided separately via route handler
    throw new Error(
      "Membership not found. Provide userId for new purchases."
    )
  }

  const membershipData = {
    user_id: userId,
    product_id: productId,
    tier,
    original_transaction_id: originalTransactionId,
    latest_transaction_id: latestTransactionId,
    expires_date: expiresDate,
    is_active: isActive,
    will_renew: willRenew,
    is_in_billing_retry: false,
    environment,
  }

  if (existing) {
    await prisma.user_membership.update({
      where: { id: existing.id },
      data: membershipData,
    })
  }

  return getUserMembershipStatus(userId)
}

export async function syncMembershipForUser(
  signedTransaction: string,
  environment: string,
  userId: string
): Promise<MembershipStatusResult> {
  const decoded = decodeJWSPayload(signedTransaction)
  const productId = decoded.productId
  const tier = resolveTier(productId)
  const originalTransactionId = decoded.originalTransactionId
  const latestTransactionId = decoded.transactionId
  const expiresDate = decoded.expiresDate
    ? new Date(decoded.expiresDate)
    : null
  const isRevoked = decoded.revocationDate != null
  const now = new Date()
  const isActive = !isRevoked && expiresDate != null && expiresDate > now

  const existing = await prisma.user_membership.findFirst({
    where: { original_transaction_id: originalTransactionId },
  })

  const membershipData = {
    user_id: userId,
    product_id: productId,
    tier,
    original_transaction_id: originalTransactionId,
    latest_transaction_id: latestTransactionId,
    expires_date: expiresDate,
    is_active: isActive,
    will_renew: true,
    is_in_billing_retry: false,
    environment,
  }

  if (existing) {
    if (existing.user_id !== userId) {
      throw new Error("Transaction belongs to a different user")
    }
    await prisma.user_membership.update({
      where: { id: existing.id },
      data: membershipData,
    })
  } else {
    await prisma.user_membership.create({
      data: {
        id: uuidv4(),
        ...membershipData,
      },
    })
  }

  return getUserMembershipStatus(userId)
}

export async function getUserMembershipStatus(
  userId: string
): Promise<MembershipStatusResult> {
  const membership = await prisma.user_membership.findFirst({
    where: {
      user_id: userId,
      is_active: true,
      expires_date: { gt: new Date() },
    },
    orderBy: { expires_date: "desc" },
  })

  const keywordsUsed = await prisma.user_subscription.count({
    where: { user_id: userId, status: 1 },
  })

  if (membership) {
    const tier = membership.tier
    return {
      tier,
      productId: membership.product_id,
      expiresDate: membership.expires_date?.toISOString() ?? null,
      isActive: true,
      willRenew: membership.will_renew,
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

export async function getUserTier(userId: string): Promise<string> {
  const status = await getUserMembershipStatus(userId)
  return status.tier
}

export async function getUserKeywordsLimit(
  userId: string
): Promise<number | null> {
  const status = await getUserMembershipStatus(userId)
  return status.keywordsLimit
}

export async function getUserKeywordsUsed(userId: string): Promise<number> {
  const status = await getUserMembershipStatus(userId)
  return status.keywordsUsed
}

export async function checkKeywordLimit(
  userId: string
): Promise<{ allowed: boolean; limit: number | null; used: number }> {
  const status = await getUserMembershipStatus(userId)
  const limit = status.keywordsLimit
  const used = status.keywordsUsed
  if (limit === null) {
    return { allowed: true, limit: null, used }
  }
  return { allowed: used < limit, limit, used }
}
