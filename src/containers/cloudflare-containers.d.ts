declare module '@cloudflare/containers' {
  import { DurableObject } from 'cloudflare:workers'

  export interface ContainerOptions {
    envVars?: Record<string, string>
  }

  export class Container extends DurableObject {
    defaultPort?: number
    requiredPorts?: number[]
    sleepAfter?: string
    enableInternet?: boolean
    pingEndpoint?: string
    envVars?: Record<string, string>
    entrypoint?: string[]

    onStart?(): void
    onStop?(): void
    onError?(error: Error): void
    onActivityExpired?(): boolean
    alarm?(): Promise<void>

    startAndWaitForPorts(opts?: { ports?: number[]; startOptions?: ContainerOptions }): Promise<void>
    fetch(input: RequestInfo, init?: RequestInit): Promise<Response>
  }
}
