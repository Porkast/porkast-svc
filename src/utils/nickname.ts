export const NICKNAME_MAX_LENGTH = 32
const NICKNAME_PATTERN = /^[A-Za-z0-9_-]*$/

export function stripInvalidNicknameChars(input: string): string {
  return input.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '')
}

export function isValidNicknameFormat(input: string): boolean {
  if (!input || input.length > NICKNAME_MAX_LENGTH) return false
  return NICKNAME_PATTERN.test(input)
}

export function normalizeNickname(input: string): string | null {
  const trimmed = input.trim().toLowerCase()
  if (trimmed.length === 0) return null
  const stripped = stripInvalidNicknameChars(trimmed)
  if (stripped.length === 0) return null
  return stripped.slice(0, NICKNAME_MAX_LENGTH)
}

export const isUuidLike = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
