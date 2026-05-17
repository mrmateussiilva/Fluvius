# Stage 1: Build React App
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package.json and install dependencies
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Build the application
# Use relative paths for API so Nginx can proxy it correctly regardless of domain
ENV VITE_API_URL=/api
ENV VITE_WS_URL=

# Note: In the client code, if VITE_WS_URL is empty, it needs to be inferred from window.location.
# But we can also set it dynamically in client.ts. Or we can set it to a relative path if the WS client supports it.
RUN pnpm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
