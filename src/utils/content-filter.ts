export const CONTENT_POLICY_ERROR = 'CONTENT_BLOCKED_BY_POLICY'

const BLOCKED_PHRASES = [
  'porn',
  'xxx',
  'nsfw',
  'hentai',
  'onlyfans',
  'only fans',
  'erotic',
  'fetish',
  'bdsm',
  'camgirl',
  'cam girl',
  'sex tape',
  'sex toy',
  'sex doll',
  'sex chat',
  'sex cam',
  'sexting',
  'strip club',
  'stripper',
  'milf',
  'blowjob',
  'handjob',
  'cumshot',
  'gangbang',
  'creampie',
  'bukkake',
  'orgy',
  'dominatrix',
  'adult film',
  'adult video',
  'nude photo',
  'sugar baby',
  'sugar daddy',
  'swinger',
  'dildo',
  'vibrator',
  'masturbat',
  'sexual massage',
  'happy ending massage',
  'escort service',
  'sex with',
  'sexual',
  'sex advice',
  'sex podcast',
  'adults only',
  '18+',
  'kink',
  'kinky',
  'threesome',
  'orgasm',
  'ejaculat',
  'phone sex',
  'dirty talk',
  'fansly',
  'cam sex',
  'erection',
  'penis',
  'vagina',
  'boobs',
  'lingerie',
  'striptease',
  'hook up',
  'one night stand',
  '色情',
  '情色',
  '裸照',
  '裸聊',
  '约炮',
  '性爱',
  '做爱',
  '黄片',
  '三级片',
  '里番',
  '卖淫',
  '嫖娼',
  '成人视频',
  '成人影片',
  '成人内容',
  '成人网站',
  '成人小说',
  '成人漫画',
  '成人游戏',
  '福利姬',
  '援助交际',
  '乱伦',
  '自慰',
  '打飞机',
  '口交',
  '肛交',
  '群交',
  'adult audio',
  'erotic audio',
  'erotic story',
  'erotic stories',
  'erotica',
  'sensual massage',
]

const BLOCKED_WORDS = ['porno', 'nudes', 'nude', 'escort', 'hookup', 'erotica', 'incest', 'intercourse', 'anal']

const BLOCKED_CATEGORIES = ['sexuality', 'adult', 'erotic', 'pornography', 'nsfw', 'sex', 'mature']

function normalize(value?: string | null): string {
  return (value || '').toLowerCase()
}

export function isExplicitFlag(value?: string | boolean | number | null): boolean {
  if (value === true) {
    return true
  }
  if (typeof value === 'number') {
    return value > 0
  }
  const normalized = normalize(String(value ?? ''))
  return normalized === 'true' || normalized === 'yes' || normalized === 'explicit' || normalized === '1'
}

export function isBlockedCategory(categories?: string[] | null): boolean {
  if (!categories || categories.length === 0) {
    return false
  }
  return categories.some((category) => {
    const normalized = normalize(category)
    return BLOCKED_CATEGORIES.some((blocked) => normalized === blocked || normalized.includes(blocked))
  })
}

export function containsBlockedKeyword(...texts: Array<string | null | undefined>): boolean {
  const combined = texts
    .filter((text): text is string => typeof text === 'string' && text.length > 0)
    .map((text) => normalize(text))
    .join(' ')
  if (!combined) {
    return false
  }
  if (BLOCKED_PHRASES.some((phrase) => combined.includes(phrase))) {
    return true
  }
  return BLOCKED_WORDS.some((word) => new RegExp(`\\b${word}\\b`).test(combined))
}

export function isBlockedSearchQuery(query: string): boolean {
  return containsBlockedKeyword(query)
}

export interface ContentCheckInput {
  title?: string | null
  channelTitle?: string | null
  description?: string | null
  categories?: string[] | null
  explicit?: string | boolean | number | null
}

export function isBlockedContent(input: ContentCheckInput): boolean {
  if (isExplicitFlag(input.explicit)) {
    return true
  }
  if (isBlockedCategory(input.categories)) {
    return true
  }
  return containsBlockedKeyword(input.title, input.channelTitle, input.description)
}

export function isBlockedRssUrl(url: string): boolean {
  const normalized = normalize(url)
  return BLOCKED_PHRASES.some((phrase) => normalized.includes(phrase))
}

export function filterBlockedFeedItems<T extends {
  Title?: string | null
  ChannelTitle?: string | null
  Description?: string | null
  Explicit?: string | null
}>(items: T[]): T[] {
  return items.filter((item) => !isBlockedContent({
    title: item.Title,
    channelTitle: item.ChannelTitle,
    description: item.Description,
    explicit: item.Explicit
  }))
}
