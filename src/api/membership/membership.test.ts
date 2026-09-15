import { describe, expect, it } from 'bun:test'
import { pickBestMembership } from './membership'

const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
const laterDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

describe('pickBestMembership', () => {
  it('returns null when there are no memberships', () => {
    expect(pickBestMembership([])).toBeNull()
  })

  it('prefers the highest tier over a longer expiry', () => {
    const result = pickBestMembership([
      { tier: 'pro', expiresDate: laterDate },
      { tier: 'unlimited', expiresDate: futureDate },
    ])

    expect(result?.tier).toBe('unlimited')
  })

  it('breaks ties by latest expiry date', () => {
    const result = pickBestMembership([
      { tier: 'pro', expiresDate: futureDate },
      { tier: 'pro', expiresDate: laterDate },
    ])

    expect(result?.expiresDate).toBe(laterDate)
  })

  it('prefers a paid tier over unknown tiers', () => {
    const result = pickBestMembership([
      { tier: 'mystery', expiresDate: laterDate },
      { tier: 'pro', expiresDate: futureDate },
    ])

    expect(result?.tier).toBe('pro')
  })
})
