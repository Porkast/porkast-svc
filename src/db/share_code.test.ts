import { describe, it, expect } from 'bun:test'
import { generateShareCode } from './share_code'

describe('generateShareCode()', () => {
    it('generates an 8-character alphanumeric code', () => {
        const code = generateShareCode()
        expect(code.length).toBe(8)
        expect(code).toMatch(/^[0-9a-zA-Z]{8}$/)
    })

    it('generates unique codes for repeated calls', () => {
        const codes = new Set(Array.from({ length: 200 }, () => generateShareCode()))
        expect(codes.size).toBe(200)
    })
})
