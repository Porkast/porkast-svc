import { Container } from '@cloudflare/containers'

export class ItunesProxyContainer extends Container {
  defaultPort = 8080
  sleepAfter = '30m'
  enableInternet = true
  pingEndpoint = '/health'
}
