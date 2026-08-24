export const NICKNAME_MAX_LENGTH = 32

// Disallowed: whitespace, ASCII control chars, URL-reserved characters.
// Unicode letters (e.g. Chinese) ARE allowed — links are percent-encoded.
const INVALID_NICKNAME_CHAR = /[\s\u0000-\u001F\u007F%\/?#&=+]/
const NICKNAME_PATTERN = /^[^\s\u0000-\u001F\u007F%\/?#&=+]{1,32}$/u

export function stripInvalidNicknameChars(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .filter((char) => !INVALID_NICKNAME_CHAR.test(char))
    .join('')
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
