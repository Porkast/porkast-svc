import { Hono } from 'hono'
import teleBot from './telegram/bot.hook'
import { IniteBakerJobs } from './jobs/job_register'
import { marked } from 'marked'

const app = new Hono()

app.get('/', async (c) => {
  const readme = await Bun.file('./README.md').text()
  const readmeHtml = marked.parse(readme)
  return c.html(readmeHtml)
})

app.route('/telegram', teleBot)

IniteBakerJobs()

export default app
