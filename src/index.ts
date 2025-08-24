import { Hono } from 'hono'
import { cors } from 'hono/cors'
import teleBot from './telegram/bot.hook'
import { IniteBakerJobs } from './jobs/job_register'
import { marked } from 'marked'
import { InitTelegramBot } from './telegram/bot.setup'
import { userRouter } from './api/user/route'
import { subscribeRouter } from './api/subscribe/route'
import { playlistRoute } from './api/playlist/route'
import { listenLaterRoute } from './api/listenlater/route'
import { rssRoute } from './api/rss/route'

const app = new Hono()
app.use(
  cors({
    origin: '*',
    allowHeaders: [
      'X-Custom-Header',
      'Upgrade-Insecure-Requests',
      'Content-Type',
      'Authorization'
    ],
    allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  })
);
app.get('/', async (c) => {
  const readme = await Bun.file('./README.md').text()
  const readmeHtml = marked.parse(readme)
  return c.html(readmeHtml)
})

app.route('/telegram', teleBot)
app.route('/api/user', userRouter)
app.route('/api/subscribe', subscribeRouter)
app.route('/api/playlist', playlistRoute)
app.route('/api/listenlater', listenLaterRoute)
app.route('/api/rss', rssRoute)

InitTelegramBot()
IniteBakerJobs()

const routeMap: Map<string, string> = new Map()
app.routes.forEach((route) => {
  routeMap.set(route.path, route.method)
});

console.log('======== Routes ========')
routeMap.forEach((method, path) => {
  console.log(`${method}: ${path}`)
})
console.log('======== Routes ========')
export default app
