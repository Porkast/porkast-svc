export function decodeDatabaseText(value: unknown): string {
    if (value == null) {
        return ''
    }

    if (typeof value === 'string') {
        return value
    }

    if (value instanceof Uint8Array) {
        return new TextDecoder('utf-8').decode(value)
    }

    if (Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
        return new TextDecoder('utf-8').decode(new Uint8Array(value))
    }

    if (typeof value === 'object') {
        const bufferLike = value as { data?: unknown; type?: unknown; buffer?: unknown }

        if (Array.isArray(bufferLike.data) && bufferLike.data.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
            return new TextDecoder('utf-8').decode(new Uint8Array(bufferLike.data))
        }

        if (bufferLike.buffer instanceof ArrayBuffer) {
            return new TextDecoder('utf-8').decode(new Uint8Array(bufferLike.buffer))
        }
    }

    return String(value)
}
