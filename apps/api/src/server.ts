import { buildApp } from './app.js'

async function start() {
  const app = await buildApp()

  const port = Number(process.env.PORT) || 3001

  await app.listen({ port, host: '0.0.0.0' })
  console.log(`Server running on http://localhost:${port}`)
}

start()
