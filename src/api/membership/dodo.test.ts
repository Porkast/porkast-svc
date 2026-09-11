import { beforeEach, describe, expect, it, mock } from 'bun:test'
import * as schema from '../../db/schema'
import type { Env } from '../../env'

interface RecordedWrite {
  table: unknown
  values: Record<string, unknown>
}

interface FakeDbState {
  subscriptionRows: Array<Record<string, unknown>>
  userRows: Array<Record<string, unknown>>
  inserted: RecordedWrite[]
  updated: RecordedWrite[]
}

const state: FakeDbState = {
  subscriptionRows: [],
  userRows: [],
  inserted: [],
  updated: [],
}

function createFakeDb() {
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === schema.userMembership) return state.subscriptionRows
            if (table === schema.userInfo) return state.userRows
            return []
          },
          orderBy: () => ({
            limit: async () => state.subscriptionRows,
          }),
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        state.inserted.push({ table, values })
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          state.updated.push({ table, values })
        },
      }),
    }),
  }
  return db as never
}

const env = {
  DODO_PAYMENTS_API_KEY: 'test_api_key',
  DODO_PAYMENTS_WEBHOOK_KEY: 'whsec_test',
  DODO_ENVIRONMENT: 'test_mode',
  DODO_PRODUCT_PRO: 'pdt_pro',
  DODO_PRODUCT_UNLIMITED: 'pdt_unlimited',
  PORKAST_WEB_BASE_URL: 'https://porkast.com',
} as unknown as Env

let unwrapResult: unknown = null
let unwrapError: Error | null = null

class FakeDodoPayments {
  constructor(_options: unknown) {}
  webhooks = {
    unwrap: () => {
      if (unwrapError) {
        throw unwrapError
      }
      return unwrapResult
    },
  }
}

mock.module('dodopayments', () => ({ default: FakeDodoPayments }))

const { handleDodoWebhook, DodoWebhookVerificationError } = await import('./dodo')

const headers = {
  'webhook-id': 'evt_1',
  'webhook-signature': 'sig',
  'webhook-timestamp': '123',
}

function subscriptionEvent(type: string, data: Record<string, unknown>) {
  return {
    business_id: 'bus_test',
    type,
    timestamp: new Date().toISOString(),
    data: {
      payload_type: 'Subscription',
      ...data,
    },
  }
}

beforeEach(() => {
  state.subscriptionRows = []
  state.userRows = []
  state.inserted = []
  state.updated = []
  unwrapResult = null
  unwrapError = null
})

describe('handleDodoWebhook', () => {
  it('inserts a pro membership on subscription.active', async () => {
    const nextBilling = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    unwrapResult = subscriptionEvent('subscription.active', {
      subscription_id: 'sub_123',
      product_id: 'pdt_pro',
      status: 'active',
      next_billing_date: nextBilling,
      cancel_at_next_billing_date: false,
      metadata: { userId: 'user_1', plan: 'pro' },
      customer: { customer_id: 'cus_1', email: 'a@b.com', name: 'A' },
    })

    await handleDodoWebhook(createFakeDb(), env, JSON.stringify(unwrapResult), headers)

    expect(state.inserted).toHaveLength(1)
    expect(state.updated).toHaveLength(0)
    const values = state.inserted[0].values
    expect(values.userId).toBe('user_1')
    expect(values.tier).toBe('pro')
    expect(values.originalTransactionId).toBe('sub_123')
    expect(values.isActive).toBe(true)
    expect(values.willRenew).toBe(true)
    expect(values.provider).toBe('dodo')
    expect(values.providerCustomerId).toBe('cus_1')
    expect(values.environment).toBe('test_mode')
  })

  it('maps the unlimited product to the unlimited tier', async () => {
    unwrapResult = subscriptionEvent('subscription.renewed', {
      subscription_id: 'sub_456',
      product_id: 'pdt_unlimited',
      status: 'active',
      next_billing_date: new Date(Date.now() + 1000).toISOString(),
      metadata: { userId: 'user_2' },
      customer: { customer_id: 'cus_2' },
    })

    await handleDodoWebhook(createFakeDb(), env, JSON.stringify(unwrapResult), headers)

    expect(state.inserted[0].values.tier).toBe('unlimited')
    expect(state.inserted[0].values.isActive).toBe(true)
  })

  it('keeps access until period end when cancelled at next billing date', async () => {
    const nextBilling = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    state.subscriptionRows = [{ id: 'row_1', userId: 'user_1', providerCustomerId: 'cus_1' }]
    unwrapResult = subscriptionEvent('subscription.cancelled', {
      subscription_id: 'sub_123',
      product_id: 'pdt_pro',
      status: 'active',
      next_billing_date: nextBilling,
      cancel_at_next_billing_date: true,
      metadata: { userId: 'user_1' },
      customer: { customer_id: 'cus_1' },
    })

    await handleDodoWebhook(createFakeDb(), env, JSON.stringify(unwrapResult), headers)

    expect(state.updated).toHaveLength(1)
    expect(state.updated[0].values.willRenew).toBe(false)
    expect(state.updated[0].values.isActive).toBe(true)
  })

  it('deactivates membership on subscription.expired', async () => {
    state.subscriptionRows = [{ id: 'row_1', userId: 'user_1', providerCustomerId: 'cus_1' }]
    unwrapResult = subscriptionEvent('subscription.expired', {
      subscription_id: 'sub_123',
      product_id: 'pdt_pro',
      status: 'expired',
      next_billing_date: new Date(Date.now() - 1000).toISOString(),
      metadata: { userId: 'user_1' },
      customer: { customer_id: 'cus_1' },
    })

    await handleDodoWebhook(createFakeDb(), env, JSON.stringify(unwrapResult), headers)

    expect(state.updated).toHaveLength(1)
    expect(state.updated[0].values.isActive).toBe(false)
    expect(state.updated[0].values.willRenew).toBe(false)
  })

  it('ignores events when the user cannot be resolved', async () => {
    unwrapResult = subscriptionEvent('subscription.active', {
      subscription_id: 'sub_999',
      product_id: 'pdt_pro',
      status: 'active',
      next_billing_date: new Date(Date.now() + 1000).toISOString(),
      customer: { customer_id: 'cus_999', email: 'unknown@b.com' },
    })

    await handleDodoWebhook(createFakeDb(), env, JSON.stringify(unwrapResult), headers)

    expect(state.inserted).toHaveLength(0)
    expect(state.updated).toHaveLength(0)
  })

  it('throws a verification error for invalid signatures', async () => {
    unwrapError = new Error('bad signature')

    await expect(
      handleDodoWebhook(createFakeDb(), env, '{}', headers)
    ).rejects.toBeInstanceOf(DodoWebhookVerificationError)
  })
})
