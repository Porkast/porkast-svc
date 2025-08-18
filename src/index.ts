import { Hono } from 'hono'
import { cors } from 'hono/cors'
import teleBot from './telegram/bot.hook'
import { IniteBakerJobs } from './jobs/job_register'
import { marked } from 'marked'
import { InitTelegramBot } from './telegram/bot.setup'
import { userRouter } from './api/user/route'
import { subscribeRouter } from './api/subscribe/route'
import { playlistRoute } from './api/playlist/route'

const app = new Hono()
app.use("/", cors({ origin: "*" }))
app.get('/', async (c) => {
  const readme = await Bun.file('./README.md').text()
  const readmeHtml = marked.parse(readme)
  return c.html(readmeHtml)
})

app.route('/telegram', teleBot)
app.route('/api/user', userRouter)
app.route('/api/subscribe', subscribeRouter)
app.route('/api/playlist', playlistRoute)

InitTelegramBot()
IniteBakerJobs()

app.routes.forEach((route) => {
  const routeInfo = `Method: ${route.method}, Path: ${route.path}`
  console.log(routeInfo)
});
export default app
