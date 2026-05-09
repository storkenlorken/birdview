#!/bin/sh

PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting BirdView with PUID: $PUID, PGID: $PGID"

# Modify the appuser to match PUID/PGID
deluser appuser 2>/dev/null || true
delgroup appgroup 2>/dev/null || true

addgroup -g ${PGID} appgroup
adduser -u ${PUID} -G appgroup -D -s /bin/sh appuser

# Ensure correct permissions on the application's data directory
# We don't chown /data because that's the host's directory we are just scanning
mkdir -p /app/data
chown -R appuser:appgroup /app/data

# Drop privileges and run the provided command
exec su-exec appuser "$@"
