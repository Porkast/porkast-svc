import { describe, expect, it } from 'bun:test'
import { decodeJWSPayload } from './jws'

function toBase64Url(json: string): string {
  return Buffer.from(json, 'utf8').toString('base64url')
}

describe('decodeJWSPayload', () => {
  it('decodes the payload of a three-part JWS', () => {
    const payload = { transactionId: 'tx_1', productId: 'podcastsearch.pro20' }
    const jws = `header.${toBase64Url(JSON.stringify(payload))}.signature`

    expect(decodeJWSPayload(jws)).toEqual(payload)
  })

  it('decodes base64url payloads with unicode content', () => {
    const payload = { transactionId: 'tx_2', nickname: '播客爱好者' }
    const jws = `header.${toBase64Url(JSON.stringify(payload))}.signature`

    expect(decodeJWSPayload(jws)).toEqual(payload)
  })

  it('accepts a raw JSON payload (StoreKit jsonRepresentation)', () => {
    const payload = { transactionId: 'tx_3', originalTransactionId: 'otx_3' }

    expect(decodeJWSPayload(JSON.stringify(payload))).toEqual(payload)
  })

  it('throws for invalid payloads', () => {
    expect(() => decodeJWSPayload('not-a-payload')).toThrow()
  })
})
