import { describe, it, expect } from 'bun:test'
import {
  DEFAULT_OG_IMAGE,
  getEpisodeIdCandidates,
  normalizePreviewImageUrl,
  stripHtmlAndTruncate,
} from './og'

describe('OG metadata helpers', () => {
  it('strips HTML tags, decodes entities, and truncates long descriptions', () => {
    const html = '<p>Hello &amp; welcome to <strong>Porkast</strong>!<br/>This is an episode summary.</p>'
    expect(stripHtmlAndTruncate(html, 200)).toBe('Hello & welcome to Porkast! This is an episode summary.')

    const longText = 'word '.repeat(60)
    const truncated = stripHtmlAndTruncate(longText, 50)
    expect(truncated.length).toBeLessThanOrEqual(50)
    expect(truncated.endsWith('…')).toBe(true)
  })

  it('upgrades http image URLs to https and falls back to default logo', () => {
    expect(normalizePreviewImageUrl('http://cdn.example.com/cover.jpg')).toBe('https://cdn.example.com/cover.jpg')
    expect(normalizePreviewImageUrl('https://cdn.example.com/cover.jpg')).toBe('https://cdn.example.com/cover.jpg')
    expect(normalizePreviewImageUrl('')).toBe(DEFAULT_OG_IMAGE)
    expect(normalizePreviewImageUrl('not-a-url')).toBe(DEFAULT_OG_IMAGE)
  })

  it('generates episode GUID candidates from double-encoded and collapsed protocol URLs', () => {
    const doubleEncoded = encodeURIComponent(encodeURIComponent('https://www.gcores.com/originals/222330'))
    const candidates = getEpisodeIdCandidates(doubleEncoded)
    expect(candidates).toContain('https://www.gcores.com/originals/222330')

    const collapsed = getEpisodeIdCandidates('https:/www.gcores.com/originals/222330', '?token=1')
    expect(collapsed).toContain('https://www.gcores.com/originals/222330?token=1')
  })
})
