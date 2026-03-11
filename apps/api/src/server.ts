import { buildApp } from './app.js'
import { env } from './config/env.js'

async function start() {
  const app = await buildApp()

  const port = env.PORT

  await app.listen({ port, host: '0.0.0.0' })
  console.log(`Server running on http://localhost:${port}`)
}

start()
