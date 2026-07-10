import { ProxyAgent, fetch as undiciFetch } from 'undici'

const proxyUrlFromEnv = process.env.WEBSHARE_PROXY_URL || ''

const server = Bun.serve({
  port: 8080,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname
    const proxyUrl = req.headers.get('X-Proxy-Url') || proxyUrlFromEnv
    const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : null

    if (path === '/health') {
      return new Response('OK')
    }

    if (path === '/search' && req.method === 'GET') {
      const term = url.searchParams.get('term')
      const entity = url.searchParams.get('entity')
      const country = url.searchParams.get('country')
      const limit = url.searchParams.get('limit')

      if (!term) return new Response('Missing term', { status: 400 })

      const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity || ''}&media=podcast&country=${country || 'US'}&limit=${limit || '200'}`

      try {
        const res = proxyAgent
          ? await undiciFetch(searchUrl, { dispatcher: proxyAgent })
          : await fetch(searchUrl)
        return new Response(await res.text(), {
          status: res.status,
          statusText: res.statusText,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': res.headers.get('Retry-After') || '',
          },
        })
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 502 })
      }
    }

    if (path === '/lookup' && req.method === 'GET') {
      const id = url.searchParams.get('id')
      if (!id) return new Response('Missing id', { status: 400 })

      const lookupUrl = `https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&entity=podcast`

      try {
        const res = proxyAgent
          ? await undiciFetch(lookupUrl, { dispatcher: proxyAgent })
          : await fetch(lookupUrl)
        return new Response(await res.text(), {
          status: res.status,
          statusText: res.statusText,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': res.headers.get('Retry-After') || '',
          },
        })
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 502 })
      }
    }

    return new Response('Not Found', { status: 404 })
  },
})

console.log(`iTunes proxy server running on port ${server.port}`)
