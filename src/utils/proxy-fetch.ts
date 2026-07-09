import net from 'node:net'
import tls from 'node:tls'

interface HttpHeaders {
  statusLine: string
  headers: Map<string, string>
  rest: Buffer
}

function readHttpHeaders(socket: net.Socket): Promise<HttpHeaders> {
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      chunks.push(chunk)
      const buf = Buffer.concat(chunks)
      const idx = buf.indexOf('\r\n\r\n')
      if (idx !== -1) {
        socket.off('data', onData)
        socket.off('error', onError)
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
        resolve({ statusLine, headers, rest: buf.subarray(idx + 4) })
      }
    }
    const onError = (err: Error) => {
      socket.off('data', onData)
      reject(err)
    }
    socket.on('data', onData)
    socket.on('error', onError)
  })
}

function readRemaining(socket: net.Socket, initial: Buffer): Promise<Buffer> {
  const chunks: Buffer[] = [initial]
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off('data', onData)
      socket.off('end', onEnd)
      socket.off('error', onError)
    }
    const onData = (chunk: Buffer) => chunks.push(chunk)
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks)) }
    const onError = (err: Error) => { cleanup(); reject(err) }
    socket.on('data', onData)
    socket.on('end', onEnd)
    socket.on('error', onError)
  })
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

  const socket = net.connect({ host: proxyHost, port: proxyPort })
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('error', reject)
  })

  let connectReq = `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n`
  if (proxyAuth) {
    connectReq += `Proxy-Authorization: Basic ${btoa(proxyAuth)}\r\n`
  }
  connectReq += '\r\n'
  socket.write(connectReq)

  const { statusLine: connectStatus } = await readHttpHeaders(socket)
  const connectCode = parseInt(connectStatus.match(/^HTTP\/\d\.\d\s+(\d+)/)?.[1] || '0')
  if (connectCode !== 200) {
    socket.destroy()
    throw new Error(`Proxy CONNECT failed: ${connectStatus}`)
  }

  const tlsSocket = tls.connect({
    socket,
    servername: targetHost,
    rejectUnauthorized: false,
  })
  await new Promise<void>((resolve, reject) => {
    tlsSocket.once('secureConnect', resolve)
    tlsSocket.once('error', reject)
  })

  tlsSocket.write(
    `GET ${targetUrl.pathname}${targetUrl.search} HTTP/1.1\r\n` +
      `Host: ${targetHost}\r\n` +
      `Accept: */*\r\n` +
      `Connection: close\r\n` +
      `\r\n`
  )

  const { statusLine, headers: respHeaders, rest } = await readHttpHeaders(tlsSocket as unknown as net.Socket)
  const body = await readRemaining(tlsSocket as unknown as net.Socket, rest)

  const statusMatch = statusLine.match(/^HTTP\/\d\.\d\s+(\d+)\s*(.*)/)
  const status = parseInt(statusMatch?.[1] || '502')

  const headers = new Headers()
  for (const [k, v] of respHeaders) {
    headers.set(k, v)
  }

  const ab = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
  return new Response(ab, { status, statusText: statusMatch?.[2] || '' })
}
