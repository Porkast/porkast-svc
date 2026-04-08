import { describe, expect, it } from 'bun:test'
import { decodeDatabaseText } from './text'

describe('decodeDatabaseText()', () => {
    it('returns strings unchanged', () => {
        expect(decodeDatabaseText('小罐茶到底是不是大师造')).toBe('小罐茶到底是不是大师造')
    })

    it('decodes utf-8 bytes from Uint8Array', () => {
        const bytes = new Uint8Array([229, 176, 143, 231, 189, 144, 232, 140, 182, 229, 136, 176, 229, 186, 149, 230, 152, 175, 228, 184, 141, 230, 152, 175, 229, 164, 167, 229, 184, 136, 233, 128, 160])
        expect(decodeDatabaseText(bytes)).toBe('小罐茶到底是不是大师造')
    })

    it('decodes buffer-like objects from JSON serialization', () => {
        const bufferLike = {
            type: 'Buffer',
            data: [229, 176, 143, 231, 189, 144, 232, 140, 182, 229, 136, 176, 229, 186, 149, 230, 152, 175, 228, 184, 141, 230, 152, 175, 229, 164, 167, 229, 184, 136, 233, 128, 160],
        }
        expect(decodeDatabaseText(bufferLike)).toBe('小罐茶到底是不是大师造')
    })
})
