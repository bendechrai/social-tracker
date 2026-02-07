#!/bin/bash
set -e

# Start Tailscale daemon with userspace networking
tailscaled --tun=userspace-networking &

# Wait for Tailscale daemon to initialize
sleep 2

# Connect to Tailscale network
if [ -z "$TAILSCALE_AUTHKEY" ]; then
    echo "ERROR: TAILSCALE_AUTHKEY is required"
    exit 1
fi

echo "Connecting to Tailscale..."
tailscale up --authkey="$TAILSCALE_AUTHKEY" --hostname="$TAILSCALE_HOSTNAME" --accept-routes

# Enable Tailscale Funnel to expose port 3000 via HTTPS
echo "Configuring Tailscale Funnel on port 3000..."
tailscale funnel --bg 3000

# Run database migrations (allow failure if already applied)
echo "Running database migrations..."
npx drizzle-kit migrate || echo "Migrations already applied or failed — continuing"

# Start the Next.js application
echo "Starting social-tracker webapp..."
if [ "$NODE_ENV" = "development" ]; then
    echo "Development mode: using dev server with hot reload"
    exec npm run dev
else
    echo "Production mode: using optimized server"
    exec npm start
fi
