import { z } from "zod"

export const SyncMembershipSchema = z.object({
  signedTransaction: z.string(),
  environment: z.enum(["Sandbox", "Production"]).default("Production"),
})

export const TIER_KEYWORDS_LIMIT: Record<string, number | null> = {
  free: 5,
  pro: 20,
  unlimited: null, // null = unlimited
}

export const PRODUCT_TIER_MAP: Record<string, string> = {
  "podcastsearch.pro20": "pro",
  "podcastsearch.unlimited": "unlimited",
}

export interface JWSTransactionDecoded {
  transactionId: string
  originalTransactionId: string
  productId: string
  expiresDate?: number // ms since 1970
  revocationDate?: number
  revocationReason?: number
  offerType?: number
  offerIdentifier?: string
  type?: string // "Auto-Renewable Subscription"
  inAppOwnershipType?: string
  signedDate?: number
  environment?: string
}

export interface MembershipStatusResult {
  tier: string
  productId: string | null
  expiresDate: string | null
  isActive: boolean
  willRenew: boolean
  keywordsLimit: number | null
  keywordsUsed: number
}
