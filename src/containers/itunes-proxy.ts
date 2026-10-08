import { Container } from '@cloudflare/containers'

export class ItunesProxyContainer extends Container {
  defaultPort = 8080
  sleepAfter = '2m'
  enableInternet = true
  pingEndpoint = '/health'
}
