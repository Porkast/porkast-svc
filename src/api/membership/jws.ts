export function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function decodeJWSPayload<T>(signedPayload: string): T {
  const parts = signedPayload.split(".")
  const payloadJson = parts.length >= 3
    ? new TextDecoder().decode(base64UrlDecode(parts[1]))
    : signedPayload

  return JSON.parse(payloadJson) as T
}
