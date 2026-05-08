# Fluvius Frontend

Frontend for the Fluvius customer support SaaS.
Built with React, Vite, and TypeScript.

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run development server:
   ```bash
   pnpm dev
   ```

The app will connect to the backend API running at `http://localhost:8000/api`.

For local development, create a `.env` file with:

```env
VITE_API_URL=http://localhost:8000/api
VITE_WS_URL=ws://localhost:8000/ws
```

The browser should not use Docker bridge addresses such as `172.17.0.1`; those are only a fallback for container-to-host webhook calls.

When exposing the backend through ngrok, use the secure WebSocket URL:

```env
VITE_API_URL=https://your-ngrok-domain.ngrok-free.app/api
VITE_WS_URL=wss://your-ngrok-domain.ngrok-free.app/ws
```
