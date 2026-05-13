import prisma from "../../db/prisma.client"
import { logger } from "../../utils/logger"
import {
  PRODUCT_TIER_MAP,
  TIER_KEYWORDS_LIMIT,
} from "./types"

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

  const membership = await prisma.user_membership.findUnique({
    where: { original_transaction_id: originalTransactionId },
  })

  if (!membership) {
    logger.warn(
      `App Store notification for unknown transaction: originalTransactionId=${originalTransactionId} productId=${productId}`
    )
    return
  }

  switch (notification.notificationType) {
    case "SUBSCRIBED":
      await handleSubscribed(membership.id, transactionInfo, tier, environment)
      break

    case "DID_CHANGE_RENEWAL_STATUS":
    case "DID_CHANGE_RENEWAL_PREF":
      await handleRenewalChange(membership.id, transactionInfo, renewalInfo, tier)
      break

    case "DID_FAIL_TO_RENEW":
      await handleFailedRenew(membership.id, transactionInfo)
      break

    case "DID_RENEW":
      await handleRenew(membership.id, transactionInfo, tier)
      break

    case "EXPIRED":
      await handleExpired(membership.id, transactionInfo)
      break

    case "REFUND":
    case "REVOKE":
      await handleRevocation(membership.id, transactionInfo)
      break

    case "OFFER_REDEEMED":
      await handleSubscribed(membership.id, transactionInfo, tier, environment)
      break

    default:
      logger.info(
        `Unhandled notification type: ${notification.notificationType}`
      )
  }
}

async function handleSubscribed(
  membershipId: string,
  tx: TransactionInfo,
  tier: string,
  environment: string
) {
  const expiresDate = tx.expiresDate ? new Date(tx.expiresDate) : null
  const isActive = tx.revocationDate == null && expiresDate != null && expiresDate > new Date()

  await prisma.user_membership.update({
    where: { id: membershipId },
    data: {
      tier,
      product_id: tx.productId,
      latest_transaction_id: tx.transactionId,
      expires_date: expiresDate,
      is_active: isActive,
      will_renew: true,
      is_in_billing_retry: false,
      environment,
    },
  })

  logger.info(`Membership subscribed: id=${membershipId} tier=${tier} expires=${expiresDate?.toISOString() ?? "none"}`)
}

async function handleRenew(
  membershipId: string,
  tx: TransactionInfo,
  tier: string
) {
  const expiresDate = tx.expiresDate ? new Date(tx.expiresDate) : null
  const isActive = expiresDate != null && expiresDate > new Date()

  await prisma.user_membership.update({
    where: { id: membershipId },
    data: {
      tier,
      product_id: tx.productId,
      latest_transaction_id: tx.transactionId,
      expires_date: expiresDate,
      is_active: isActive,
      will_renew: true,
      is_in_billing_retry: false,
    },
  })

  logger.info(`Membership renewed: id=${membershipId} tier=${tier} expires=${expiresDate?.toISOString() ?? "none"}`)
}

async function handleRenewalChange(
  membershipId: string,
  tx: TransactionInfo,
  renewal: RenewalInfo | null,
  tier: string
) {
  const expiresDate = tx.expiresDate ? new Date(tx.expiresDate) : null
  const isActive = tx.revocationDate == null && expiresDate != null && expiresDate > new Date()

  // Handle upgrade/downgrade by checking if productId changed
  const resolvedTier = tier
  const resolvedProductId = renewal?.autoRenewProductId ?? tx.productId

  await prisma.user_membership.update({
    where: { id: membershipId },
    data: {
      tier: resolveTier(resolvedProductId),
      product_id: resolvedProductId,
      latest_transaction_id: tx.transactionId,
      expires_date: expiresDate,
      is_active: isActive,
      will_renew: renewal?.autoRenewStatus === 1,
      is_in_billing_retry: renewal?.isInBillingRetryPeriod ?? false,
    },
  })

  logger.info(
    `Membership renewal changed: id=${membershipId} productId=${resolvedProductId} willRenew=${renewal?.autoRenewStatus === 1}`
  )
}

async function handleFailedRenew(
  membershipId: string,
  tx: TransactionInfo
) {
  const expiresDate = tx.expiresDate ? new Date(tx.expiresDate) : null

  await prisma.user_membership.update({
    where: { id: membershipId },
    data: {
      latest_transaction_id: tx.transactionId,
      expires_date: expiresDate,
      will_renew: false,
      is_in_billing_retry: true,
    },
  })

  logger.warn(`Membership renewal failed: id=${membershipId}`)
}

async function handleExpired(
  membershipId: string,
  tx: TransactionInfo
) {
  await prisma.user_membership.update({
    where: { id: membershipId },
    data: {
      latest_transaction_id: tx.transactionId,
      expires_date: tx.expiresDate ? new Date(tx.expiresDate) : undefined,
      is_active: false,
      will_renew: false,
      is_in_billing_retry: false,
    },
  })

  logger.info(`Membership expired: id=${membershipId}`)
}

async function handleRevocation(
  membershipId: string,
  tx: TransactionInfo
) {
  await prisma.user_membership.update({
    where: { id: membershipId },
    data: {
      latest_transaction_id: tx.transactionId,
      is_active: false,
      will_renew: false,
      is_in_billing_retry: false,
    },
  })

  logger.info(`Membership revoked/refunded: id=${membershipId} reason=${tx.revocationReason ?? "unknown"}`)
}
