import { describe, it, expect, mock } from 'bun:test'
import { sendAggregatedSubscriptionUpdateEmail } from './service'
import type { AggregatedNotificationParams } from '../models/subscription'

describe('sendAggregatedSubscriptionUpdateEmail', () => {
  it('should format and send email for a single keyword update', async () => {
    let sentOptions: any = null
    const fakeEmailSender = {
      EMAIL: {
        send: mock(async (options: any) => {
          sentOptions = options
          return { messageId: 'msg-single-1' }
        }),
      },
    }

    const params: AggregatedNotificationParams = {
      to: 'user@example.com',
      nickname: 'Alex',
      totalUpdateCount: 2,
      keywordUpdates: [
        {
          subscriptionId: 'sub-1',
          keyword: 'TechNews',
          updateCount: 2,
          titleList: ['Episode 101: AI Agents', 'Episode 102: Workers'],
          link: 'https://porkast.com/subscription/user1/TechNews',
          latestKsId: 10,
          totalCount: 2,
        },
      ],
    }

    await sendAggregatedSubscriptionUpdateEmail(fakeEmailSender as any, params)

    expect(sentOptions).not.toBeNull()
    expect(sentOptions.to).toBe('user@example.com')
    expect(sentOptions.subject).toBe('#TechNews has new podcasts update')
    expect(sentOptions.html).toContain('Hello Alex')
    expect(sentOptions.html).toContain('#TechNews')
    expect(sentOptions.html).toContain('(2 new)')
    expect(sentOptions.html).toContain('Episode 101: AI Agents')
    expect(sentOptions.html).toContain('Episode 102: Workers')
    expect(sentOptions.text).toContain('There are 2 new podcast episodes updated for #TechNews')
  })

  it('should format and send email for multiple keyword updates (aggregated)', async () => {
    let sentOptions: any = null
    const fakeEmailSender = {
      EMAIL: {
        send: mock(async (options: any) => {
          sentOptions = options
          return { messageId: 'msg-multi-1' }
        }),
      },
    }

    const params: AggregatedNotificationParams = {
      to: 'user@example.com',
      nickname: 'Alex',
      totalUpdateCount: 5,
      keywordUpdates: [
        {
          subscriptionId: 'sub-1',
          keyword: 'AI',
          updateCount: 3,
          titleList: ['AI 1', 'AI 2', 'AI 3'],
          link: 'https://porkast.com/subscription/user1/AI',
          latestKsId: 10,
          totalCount: 3,
        },
        {
          subscriptionId: 'sub-2',
          keyword: 'Rust',
          updateCount: 2,
          titleList: ['Rust 1', 'Rust 2'],
          link: 'https://porkast.com/subscription/user1/Rust',
          latestKsId: 12,
          totalCount: 2,
        },
      ],
    }

    await sendAggregatedSubscriptionUpdateEmail(fakeEmailSender as any, params)

    expect(sentOptions).not.toBeNull()
    expect(sentOptions.to).toBe('user@example.com')
    expect(sentOptions.subject).toBe('5 new episodes across 2 subscriptions')
    expect(sentOptions.html).toContain('5 new podcast updates across 2 subscriptions')
    expect(sentOptions.html).toContain('#AI')
    expect(sentOptions.html).toContain('#Rust')
    expect(sentOptions.text).toContain('You have 5 new podcast episodes across 2 subscriptions')
    expect(sentOptions.text).toContain('#AI (3 new)')
    expect(sentOptions.text).toContain('#Rust (2 new)')
  })
})
