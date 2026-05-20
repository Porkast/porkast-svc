import { logger } from "../../utils/logger"
import {
  PRODUCT_TIER_MAP,
  TIER_KEYWORDS_LIMIT,
} from "./types"
import { eq, and } from 'drizzle-orm'
import * as schema from '../../db/schema'
import type { DbClient } from '../../db/types'

interface NotificationPayload {
  notificationType: string
  subtype?: string
  notificationUUID: string
  data?: {
    bundleId: string
    environment: string
    signedTransactionInfo: string
    signedRenewalInfo?: string
  }
  version?: string
  signedDate?: number
}

interface TransactionInfo {
  transactionId: string
  originalTransactionId: string
  productId: string
  expiresDate?: number
  revocationDate?: number
  revocationReason?: number
  type?: string
  inAppOwnershipType?: string
  signedDate?: number
  offerType?: number
  environment?: string
}

interface RenewalInfo {
  originalTransactionId: string
  autoRenewStatus?: number
  autoRenewProductId?: string
  expirationIntent?: number
  isInBillingRetryPeriod?: boolean
  signedDate?: number
}

function decodeJWSPayload<T>(signedPayload: string): T {
  const parts = signedPayload.split(".")
  if (parts.length < 3) {
    throw new Error(`Invalid JWS: expected 3 parts, got ${parts.length}`)
  }
  const payloadEncoded = parts[1]
  const payloadJson = atob(payloadEncoded)
  return JSON.parse(payloadJson)
}

function resolveTier(productId: string): string {
  return PRODUCT_TIER_MAP[productId] ?? "free"
}

export async function handleAppStoreNotification(
  db: DbClient,
  signedPayload: string
): Promise<void> {
  const notification = decodeJWSPayload<NotificationPayload>(signedPayload)

  logger.info(
    `App Store notification: type=${notification.notificationType} subtype=${notification.subtype ?? "none"} uuid=${notification.notificationUUID}`
  )

  const hasTransactionData =
    notification.data?.signedTransactionInfo != null

  if (!hasTransactionData) {
    logger.info(
      `App Store notification without transaction data, skipping: type=${notification.notificationType}`
    )
    return
  }

  const transactionInfo = decodeJWSPayload<TransactionInfo>(
    notification.data!.signedTransactionInfo
  )

  const renewalInfo = notification.data?.signedRenewalInfo
    ? decodeJWSPayload<RenewalInfo>(notification.data.signedRenewalInfo)
    : null

  const originalTransactionId = transactionInfo.originalTransactionId
  const productId = transactionInfo.productId
  const tier = resolveTier(productId)
  const environment = transactionInfo.environment ?? "Production"

  const membershipResult = await db
    .select()
    .from(schema.userMembership)
    .where(eq(schema.userMembership.originalTransactionId, originalTransactionId))
    .limit(1)

  const membership = membershipResult[0]

  if (!membership) {
    logger.warn(
      `App Store notification for unknown transaction: originalTransactionId=${originalTransactionId} productId=${productId}`
    )
    return
  }

  switch (notification.notificationType) {
    case "SUBSCRIBED":
      await handleSubscribed(db, membership.id, transactionInfo, tier, environment)
      break

    case "DID_CHANGE_RENEWAL_STATUS":
    case "DID_CHANGE_RENEWAL_PREF":
      await handleRenewalChange(db, membership.id, transactionInfo, renewalInfo, tier)
      break

    case "DID_FAIL_TO_RENEW":
      await handleFailedRenew(db, membership.id, transactionInfo)
      break

    case "DID_RENEW":
      await handleRenew(db, membership.id, transactionInfo, tier)
      break

    case "EXPIRED":
      await handleExpired(db, membership.id, transactionInfo)
      break

    case "REFUND":
    case "REVOKE":
      await handleRevocation(db, membership.id, transactionInfo)
      break

    case "OFFER_REDEEMED":
      await handleSubscribed(db, membership.id, transactionInfo, tier, environment)
      break

    default:
      logger.info(
        `Unhandled notification type: ${notification.notificationType}`
      )
  }
}

async function handleSubscribed(
  db: DbClient,
  membershipId: string,
  tx: TransactionInfo,
  tier: string,
  environment: string
) {
  const expiresDate = tx.expiresDate ? new Date(tx.expiresDate) : null
  const isActive = tx.revocationDate == null && expiresDate != null && expiresDate > new Date()

  await db.update(schema.userMembership)
    .set({
      tier,
      productId: tx.productId,
      latestTransactionId: tx.transactionId,
      expiresDate: expiresDate?.toISOString() ?? null,
      isActive,
      willRenew: true,
      isInBillingRetry: false,
      environment,
    })
    .where(eq(schema.userMembership.id, membershipId))

  logger.info(`Membership subscribed: id=${membershipId} tier=${tier} expires=${expiresDate?.toISOString() ?? "none"}`)
}

async function handleRenew(
  db: DbClient,
  membershipId: string,
  tx: TransactionInfo,
  tier: string
) {
  const expiresDate = tx.expiresDate ? new Date(tx.expiresDate) : null
  const isActive = expiresDate != null && expiresDate > new Date()

  await db.update(schema.userMembership)
    .set({
      tier,
      productId: tx.productId,
      latestTransactionId: tx.transactionId,
      expiresDate: expiresDate?.toISOString() ?? null,
      isActive,
      willRenew: true,
      isInBillingRetry: false,
    })
    .where(eq(schema.userMembership.id, membershipId))

  logger.info(`Membership renewed: id=${membershipId} tier=${tier} expires=${expiresDate?.toISOString() ?? "none"}`)
}

async function handleRenewalChange(
  db: DbClient,
  membershipId: string,
  tx: TransactionInfo,
  renewal: RenewalInfo | null,
  tier: string
) {
  const expiresDate = tx.expiresDate ? new Date(tx.expiresDate) : null
  const isActive = tx.revocationDate == null && expiresDate != null && expiresDate > new Date()

  const resolvedTier = tier
  const resolvedProductId = renewal?.autoRenewProductId ?? tx.productId

  await db.update(schema.userMembership)
    .set({
      tier: resolveTier(resolvedProductId),
      productId: resolvedProductId,
      latestTransactionId: tx.transactionId,
      expiresDate: expiresDate?.toISOString() ?? null,
      isActive,
      willRenew: renewal?.autoRenewStatus === 1,
      isInBillingRetry: renewal?.isInBillingRetryPeriod ?? false,
    })
    .where(eq(schema.userMembership.id, membershipId))

  logger.info(
    `Membership renewal changed: id=${membershipId} productId=${resolvedProductId} willRenew=${renewal?.autoRenewStatus === 1}`
  )
}

async function handleFailedRenew(
  db: DbClient,
  membershipId: string,
  tx: TransactionInfo
) {
  const expiresDate = tx.expiresDate ? new Date(tx.expiresDate) : null

  await db.update(schema.userMembership)
    .set({
      latestTransactionId: tx.transactionId,
      expiresDate: expiresDate?.toISOString() ?? null,
      willRenew: false,
      isInBillingRetry: true,
    })
    .where(eq(schema.userMembership.id, membershipId))

  logger.warn(`Membership renewal failed: id=${membershipId}`)
}

async function handleExpired(
  db: DbClient,
  membershipId: string,
  tx: TransactionInfo
) {
  await db.update(schema.userMembership)
    .set({
      latestTransactionId: tx.transactionId,
      expiresDate: tx.expiresDate ? new Date(tx.expiresDate).toISOString() : null,
      isActive: false,
      willRenew: false,
      isInBillingRetry: false,
    })
    .where(eq(schema.userMembership.id, membershipId))

  logger.info(`Membership expired: id=${membershipId}`)
}

async function handleRevocation(
  db: DbClient,
  membershipId: string,
  tx: TransactionInfo
) {
  await db.update(schema.userMembership)
    .set({
      latestTransactionId: tx.transactionId,
      isActive: false,
      willRenew: false,
      isInBillingRetry: false,
    })
    .where(eq(schema.userMembership.id, membershipId))

  logger.info(`Membership revoked/refunded: id=${membershipId} reason=${tx.revocationReason ?? "unknown"}`)
}
