import { Hono } from 'hono'
import { IniteBakerJobs } from './jobs/job_register'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

IniteBakerJobs()

export default app
