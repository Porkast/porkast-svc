import { describe, expect, it } from 'bun:test'
import {
  containsBlockedKeyword,
  isBlockedCategory,
  isBlockedContent,
  isBlockedSearchQuery,
  isExplicitFlag,
} from './content-filter'

describe('content filter', () => {
  it('detects explicit flags from all source formats', () => {
    expect(isExplicitFlag('yes')).toBe(true)
    expect(isExplicitFlag('true')).toBe(true)
    expect(isExplicitFlag('explicit')).toBe(true)
    expect(isExplicitFlag(1)).toBe(true)
    expect(isExplicitFlag(true)).toBe(true)
    expect(isExplicitFlag('no')).toBe(false)
    expect(isExplicitFlag('false')).toBe(false)
    expect(isExplicitFlag('clean')).toBe(false)
    expect(isExplicitFlag('')).toBe(false)
  })

  it('blocks adult keywords in English and Chinese', () => {
    expect(containsBlockedKeyword('Best Porn Podcast')).toBe(true)
    expect(containsBlockedKeyword('NSFW stories')).toBe(true)
    expect(containsBlockedKeyword('色情电台')).toBe(true)
    expect(containsBlockedKeyword('成人影片合集')).toBe(true)
  })

  it('does not block ordinary podcast titles', () => {
    expect(containsBlockedKeyword('The History of Rome')).toBe(false)
    expect(containsBlockedKeyword('Sex Education for Parents')).toBe(false)
    expect(containsBlockedKeyword('Black Myth Wukong discussion')).toBe(false)
  })

  it('blocks adult categories', () => {
    expect(isBlockedCategory(['Sexuality'])).toBe(true)
    expect(isBlockedCategory(['Technology', 'Adult'])).toBe(true)
    expect(isBlockedCategory(['Technology', 'Society & Culture'])).toBe(false)
  })

  it('blocks prohibited content and allows clean content', () => {
    expect(isBlockedContent({ title: 'OnlyFans Stories', explicit: '' })).toBe(true)
    expect(isBlockedContent({ title: 'Sex With Emily', explicit: 'yes' })).toBe(true)
    expect(isBlockedContent({ title: 'Gaming talk', categories: ['Sexuality'], explicit: 'no' })).toBe(true)
    expect(isBlockedContent({ title: 'Comedy Central Stand-Up', explicit: 'yes' })).toBe(true)
    expect(isBlockedContent({ title: 'Comedy Central Stand-Up', explicit: 'clean' })).toBe(false)
    expect(isBlockedContent({ title: 'Gaming talk', channelTitle: 'Tech Weekly', explicit: 'no' })).toBe(false)
  })

  it('blocks prohibited search queries', () => {
    expect(isBlockedSearchQuery('porn')).toBe(true)
    expect(isBlockedSearchQuery('hentai audio')).toBe(true)
    expect(isBlockedSearchQuery('erotic stories')).toBe(true)
    expect(isBlockedSearchQuery('erotica')).toBe(true)
    expect(isBlockedSearchQuery('xxx')).toBe(true)
    expect(isBlockedSearchQuery('自慰')).toBe(true)
    expect(isBlockedSearchQuery('technology')).toBe(false)
    expect(isBlockedSearchQuery('science podcast')).toBe(false)
  })
})
