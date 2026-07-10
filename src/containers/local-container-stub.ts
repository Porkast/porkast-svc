import { DurableObject } from 'cloudflare:workers'

export class Container extends DurableObject {
  defaultPort = 0
  requiredPorts: number[] = []
  sleepAfter = '5m'
  enableInternet = false
  pingEndpoint = '/health'
  envVars: Record<string, string> = {}
  entrypoint: string[] = []

  async startAndWaitForPorts(_opts?: any): Promise<void> {}
  async fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    return new Response('Container not available in local dev', { status: 502 })
  }
}
