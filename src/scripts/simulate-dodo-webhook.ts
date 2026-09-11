import { createHmac } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

type Plan = 'pro' | 'unlimited'

function readDevVars(): Record<string, string> {
  const path = resolve(process.cwd(), '.dev.vars')
  if (!existsSync(path)) {
    return {}
  }
  const vars: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    vars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return vars
}

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : undefined
}

async function main() {
  const userId = getArg('userId')
  const plan = (getArg('plan') ?? 'pro') as Plan
  const type = getArg('type') ?? 'subscription.active'
  const apiBaseUrl = getArg('api') ?? 'http://localhost:8787/api'

  if (!userId) {
    console.log('Usage: bun src/scripts/simulate-dodo-webhook.ts --userId=<userId> [--plan=pro|unlimited] [--type=subscription.active] [--api=http://localhost:8787/api]')
    process.exit(1)
  }

  const vars = readDevVars()
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY || vars.DODO_PAYMENTS_WEBHOOK_KEY
  const productId = plan === 'unlimited' ? vars.DODO_PRODUCT_UNLIMITED : vars.DODO_PRODUCT_PRO

  if (!webhookKey) {
    console.error('DODO_PAYMENTS_WEBHOOK_KEY is not set in .dev.vars')
    process.exit(1)
  }
  if (!productId) {
    console.error(`DODO_PRODUCT_${plan.toUpperCase()} is not set in .dev.vars`)
    process.exit(1)
  }

  const secret = Buffer.from(webhookKey.replace(/^whsec_/, ''), 'base64')
  const event = {
    business_id: 'local_simulation',
    type,
    timestamp: new Date().toISOString(),
    data: {
      payload_type: 'Subscription',
      subscription_id: `sub_sim_${plan}`,
      product_id: productId,
      status: 'active',
      next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_next_billing_date: false,
      metadata: { userId, plan },
      customer: { customer_id: `cus_sim_${userId}`, email: `${userId}@simulated.local` },
    },
  }

  const body = JSON.stringify(event)
  const id = `evt_sim_${Date.now()}`
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = createHmac('sha256', secret)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')

  const resp = await fetch(`${apiBaseUrl}/membership/webhook/dodo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': timestamp,
      'webhook-signature': `v1,${signature}`,
    },
    body,
  })

  console.log(`Sent ${type} for user=${userId} plan=${plan}: ${resp.status} ${await resp.text()}`)
}

main()
