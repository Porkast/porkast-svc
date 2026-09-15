import DodoPayments from "dodopayments"
import { and, desc, eq } from "drizzle-orm"
import type { DbClient } from "../../db/types"
import type { Env } from "../../env"
import * as schema from "../../db/schema"
import { logger } from "../../utils/logger"
import {
  DODO_PROVIDER,
  MembershipPlan,
} from "./types"

const DODO_ENVIRONMENTS = ["test_mode", "live_mode"] as const
type DodoEnvironment = (typeof DODO_ENVIRONMENTS)[number]

function resolveDodoEnvironment(env: Env): DodoEnvironment {
  return env.DODO_ENVIRONMENT === "test_mode" ? "test_mode" : "live_mode"
}

function createDodoClient(env: Env): DodoPayments {
  return new DodoPayments({
    bearerToken: env.DODO_PAYMENTS_API_KEY || "unused",
    webhookKey: env.DODO_PAYMENTS_WEBHOOK_KEY,
    environment: resolveDodoEnvironment(env),
  })
}

function requireDodoApiKey(env: Env): void {
  if (!env.DODO_PAYMENTS_API_KEY) {
    throw new Error("DODO_PAYMENTS_API_KEY is not configured")
  }
}

function resolveProductId(env: Env, plan: MembershipPlan): string {
  const productId = plan === "pro" ? env.DODO_PRODUCT_PRO : env.DODO_PRODUCT_UNLIMITED
  if (!productId) {
    throw new Error(`No Dodo product configured for plan: ${plan}`)
  }
  return productId
}

function resolveTierFromProductId(env: Env, productId: string): string {
  if (productId === env.DODO_PRODUCT_PRO) return "pro"
  if (productId === env.DODO_PRODUCT_UNLIMITED) return "unlimited"
  return "free"
}

function getWebBaseUrl(env: Env): string {
  return (env.PORKAST_WEB_BASE_URL || "https://porkast.com").replace(/\/$/, "")
}

export class DodoWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DodoWebhookVerificationError"
  }
}

export interface CheckoutResult {
  checkoutUrl: string | null
  alreadySubscribed: boolean
  currentPlan: MembershipPlan | null
  provider: string | null
}

export async function createDodoCheckoutSession(
  db: DbClient,
  env: Env,
  userId: string,
  plan: MembershipPlan
): Promise<CheckoutResult> {
  const users = await db
    .select()
    .from(schema.userInfo)
    .where(eq(schema.userInfo.id, userId))
    .limit(1)

  const user = users[0]
  if (!user?.email) {
    throw new Error("User email is required for checkout")
  }

  const activeMembership = await getActiveMembership(db, userId)
  if (activeMembership) {
    return {
      checkoutUrl: null,
      alreadySubscribed: true,
      currentPlan: resolvePlanFromMembership(env, activeMembership),
      provider: activeMembership.provider ?? null,
    }
  }

  requireDodoApiKey(env)
  const client = createDodoClient(env)
  const webBaseUrl = getWebBaseUrl(env)

  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: resolveProductId(env, plan), quantity: 1 }],
    customer: { email: user.email, name: user.nickname ?? undefined },
    metadata: { userId, plan, provider: DODO_PROVIDER },
    return_url: `${webBaseUrl}/pricing?checkout=success&plan=${plan}`,
    cancel_url: `${webBaseUrl}/pricing?checkout=cancelled`,
    feature_flags: {
      allow_currency_selection: false,
      redirect_immediately: true,
    },
    customization: {
      force_language: "en",
      theme: "system",
    },
  })

  if (!session.checkout_url) {
    throw new Error("Dodo did not return a checkout URL")
  }

  logger.info(`Dodo checkout session created: userId=${userId} plan=${plan} sessionId=${session.session_id}`)

  return {
    checkoutUrl: session.checkout_url,
    alreadySubscribed: false,
    currentPlan: null,
    provider: null,
  }
}

export async function createDodoPortalSession(
  db: DbClient,
  env: Env,
  userId: string
): Promise<string> {
  const memberships = await db
    .select()
    .from(schema.userMembership)
    .where(
      and(
        eq(schema.userMembership.userId, userId),
        eq(schema.userMembership.provider, DODO_PROVIDER)
      )
    )
    .orderBy(desc(schema.userMembership.expiresDate))
    .limit(1)

  const membership = memberships[0]
  if (!membership?.providerCustomerId) {
    throw new Error(
      "No Dodo subscription found for this user. If you subscribed through the App Store, manage the subscription from your Apple ID settings."
    )
  }

  requireDodoApiKey(env)
  const client = createDodoClient(env)
  const portal = await client.customers.customerPortal.create(membership.providerCustomerId, {
    return_url: `${getWebBaseUrl(env)}/pricing`,
  })

  return portal.link
}

export async function handleDodoWebhook(
  db: DbClient,
  env: Env,
  rawBody: string,
  headers: Record<string, string>
): Promise<void> {
  const client = createDodoClient(env)

  let event: ReturnType<typeof client.webhooks.unwrap>
  try {
    event = client.webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id": headers["webhook-id"] ?? "",
        "webhook-signature": headers["webhook-signature"] ?? "",
        "webhook-timestamp": headers["webhook-timestamp"] ?? "",
      },
    })
  } catch (error) {
    throw new DodoWebhookVerificationError(
      error instanceof Error ? error.message : "Invalid webhook signature"
    )
  }

  if (event.type === "payment.succeeded" || event.type === "payment.failed") {
    logger.info(`Dodo payment event: type=${event.type}`)
    return
  }

  if (!event.type.startsWith("subscription.")) {
    return
  }

  const data = event.data as unknown as DodoSubscriptionPayload
  const userId = await resolveUserId(db, data)
  if (!userId) {
    logger.warn(
      `Dodo webhook for unknown user: type=${event.type} subscriptionId=${data.subscription_id} customerId=${data.customer?.customer_id ?? "none"}`
    )
    return
  }

  const tier = resolveTierFromProductId(env, data.product_id)
  const state = deriveMembershipState(data)
  const nowISO = new Date().toISOString()

  const existingResult = await db
    .select()
    .from(schema.userMembership)
    .where(eq(schema.userMembership.originalTransactionId, data.subscription_id))
    .limit(1)

  const existing = existingResult[0]

  if (existing && existing.userId !== userId) {
    logger.warn(
      `Dodo webhook subscription belongs to a different user: subscriptionId=${data.subscription_id}`
    )
    return
  }

  const membershipData = {
    userId,
    productId: data.product_id,
    tier,
    originalTransactionId: data.subscription_id,
    expiresDate: state.expiresDate,
    isActive: state.isActive,
    willRenew: state.willRenew,
    isInBillingRetry: state.isInBillingRetry,
    environment: resolveDodoEnvironment(env),
    provider: DODO_PROVIDER,
    providerCustomerId: data.customer?.customer_id ?? existing?.providerCustomerId ?? null,
    updatedAt: nowISO,
  }

  if (existing) {
    await db
      .update(schema.userMembership)
      .set(membershipData)
      .where(eq(schema.userMembership.id, existing.id))
  } else {
    await db.insert(schema.userMembership).values({
      id: crypto.randomUUID(),
      ...membershipData,
      latestTransactionId: null,
      createdAt: nowISO,
    })
  }

  logger.info(
    `Dodo membership synced: type=${event.type} userId=${userId} tier=${tier} active=${state.isActive} willRenew=${state.willRenew} expires=${state.expiresDate ?? "none"}`
  )
}

function resolvePlanFromProductId(env: Env, productId: string): MembershipPlan | null {
  if (productId === env.DODO_PRODUCT_PRO) return "pro"
  if (productId === env.DODO_PRODUCT_UNLIMITED) return "unlimited"
  return null
}

function resolvePlanFromMembership(
  env: Env,
  membership: { productId: string; tier: string }
): MembershipPlan | null {
  const planFromProduct = resolvePlanFromProductId(env, membership.productId)
  if (planFromProduct) {
    return planFromProduct
  }
  if (membership.tier === "pro" || membership.tier === "unlimited") {
    return membership.tier
  }
  return null
}

async function getActiveMembership(db: DbClient, userId: string) {
  const result = await db
    .select()
    .from(schema.userMembership)
    .where(
      and(
        eq(schema.userMembership.userId, userId),
        eq(schema.userMembership.isActive, true)
      )
    )
    .orderBy(desc(schema.userMembership.expiresDate))
    .limit(1)
  return result[0] ?? null
}

interface DodoSubscriptionPayload {
  subscription_id: string
  product_id: string
  status: string
  next_billing_date?: string | null
  cancel_at_next_billing_date?: boolean
  past_due_ends_at?: string | null
  expires_at?: string | null
  metadata?: Record<string, string> | null
  customer?: {
    customer_id?: string
    email?: string
    name?: string
  } | null
}

async function resolveUserId(
  db: DbClient,
  data: DodoSubscriptionPayload
): Promise<string | null> {
  const metadataUserId = data.metadata?.userId
  if (metadataUserId) {
    return metadataUserId
  }

  const bySubscription = await db
    .select()
    .from(schema.userMembership)
    .where(eq(schema.userMembership.originalTransactionId, data.subscription_id))
    .limit(1)
  if (bySubscription[0]) {
    return bySubscription[0].userId
  }

  const customerId = data.customer?.customer_id
  if (customerId) {
    const byCustomer = await db
      .select()
      .from(schema.userMembership)
      .where(eq(schema.userMembership.providerCustomerId, customerId))
      .limit(1)
    if (byCustomer[0]) {
      return byCustomer[0].userId
    }
  }

  const email = data.customer?.email
  if (email) {
    const byEmail = await db
      .select()
      .from(schema.userInfo)
      .where(eq(schema.userInfo.email, email))
      .limit(1)
    if (byEmail[0]) {
      return byEmail[0].id
    }
  }

  return null
}

function deriveMembershipState(data: DodoSubscriptionPayload) {
  const now = Date.now()
  const expiresDate = data.next_billing_date ?? data.expires_at ?? null
  const expiresMs = expiresDate ? Date.parse(expiresDate) : Number.NaN
  const expiresInFuture = Number.isFinite(expiresMs) && expiresMs > now

  let isActive: boolean
  switch (data.status) {
    case "active":
      isActive = Number.isFinite(expiresMs) ? expiresInFuture : true
      break
    case "past_due": {
      const graceEndsMs = data.past_due_ends_at ? Date.parse(data.past_due_ends_at) : Number.NaN
      isActive = Number.isFinite(graceEndsMs) && graceEndsMs > now
      break
    }
    case "cancelled":
      isActive = !!data.cancel_at_next_billing_date && expiresInFuture
      break
    default:
      isActive = false
  }

  return {
    isActive,
    willRenew: data.status === "active" && !data.cancel_at_next_billing_date,
    isInBillingRetry: data.status === "past_due" || data.status === "on_hold",
    expiresDate,
  }
}
