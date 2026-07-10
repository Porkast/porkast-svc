import { connect } from 'cloudflare:sockets'

interface HttpHeaders {
  statusLine: string
  headers: Map<string, string>
  rest: Buffer
}

async function readHeadersFromStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<HttpHeaders> {
  const chunks: Buffer[] = []
  while (true) {
    const { value, done } = await reader.read()
    if (done) throw new Error('Connection closed before headers received')
    chunks.push(Buffer.from(value!))
    const buf = Buffer.concat(chunks)
    const idx = buf.indexOf('\r\n\r\n')
    if (idx !== -1) {
      const headerBlock = buf.toString('utf-8', 0, idx)
      const lines = headerBlock.split('\r\n')
      const statusLine = lines[0]
      const headers = new Map<string, string>()
      for (let i = 1; i < lines.length; i++) {
        const colonIdx = lines[i].indexOf(':')
        if (colonIdx > 0) {
          headers.set(
            lines[i].slice(0, colonIdx).trim().toLowerCase(),
            lines[i].slice(colonIdx + 1).trim()
          )
        }
      }
      return { statusLine, headers, rest: buf.subarray(idx + 4) }
    }
  }
}

async function readRemainingFromStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  initial: Buffer
): Promise<Buffer> {
  const chunks: Buffer[] = [initial]
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

function encode(data: string): Uint8Array {
  return new TextEncoder().encode(data)
}

export async function proxyFetch(url: string, proxyUrl: string): Promise<Response> {
  const proxyUrlObj = new URL(proxyUrl)
  const proxyHost = proxyUrlObj.hostname
  const proxyPort = parseInt(proxyUrlObj.port) || 80
  const proxyAuth = proxyUrlObj.username
    ? `${proxyUrlObj.username}:${proxyUrlObj.password}`
    : null

  const targetUrl = new URL(url)
  const targetHost = targetUrl.hostname
  const targetPort = parseInt(targetUrl.port) || 443

  const socket = connect(
    { hostname: proxyHost, port: proxyPort },
    { secureTransport: 'starttls', allowHalfOpen: false }
  )
  await socket.opened

  let connectReq = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n`
  if (proxyAuth) {
    connectReq += `Proxy-Authorization: Basic ${btoa(proxyAuth)}\r\n`
  }
  connectReq += '\r\n'

  const writer = socket.writable.getWriter()
  await writer.write(encode(connectReq))
  writer.releaseLock()

  const reader = socket.readable.getReader()
  const { statusLine: connectStatus } = await readHeadersFromStream(reader)
  reader.releaseLock()

  const connectCode = parseInt(connectStatus.match(/^HTTP\/\d\.\d\s+(\d+)/)?.[1] || '0')
  if (connectCode !== 200) {
    socket.close()
    throw new Error(`Proxy CONNECT failed: ${connectStatus}`)
  }

  const tlsSocket = socket.startTls()

  const tlsWriter = tlsSocket.writable.getWriter()
  await tlsWriter.write(
    encode(
      `GET ${targetUrl.pathname}${targetUrl.search} HTTP/1.1\r\n` +
        `Host: ${targetHost}\r\n` +
        `Accept: */*\r\n` +
        `Connection: close\r\n` +
        `\r\n`
    )
  )
  tlsWriter.releaseLock()

  const tlsReader = tlsSocket.readable.getReader()
  const { statusLine, headers: respHeaders, rest } =
    await readHeadersFromStream(tlsReader)
  const body = await readRemainingFromStream(tlsReader, rest)

  const statusMatch = statusLine.match(/^HTTP\/\d\.\d\s+(\d+)\s*(.*)/)
  const status = parseInt(statusMatch?.[1] || '502')

  const headers = new Headers()
  for (const [k, v] of respHeaders) {
    headers.set(k, v)
  }

  const ab = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
  return new Response(ab, { status, statusText: statusMatch?.[2] || '' })
}
