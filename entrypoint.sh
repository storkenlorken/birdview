#!/bin/sh

PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting BirdView with PUID: $PUID, PGID: $PGID"

# Ensure the group exists with the correct PGID
GROUP_NAME=$(grep ":${PGID}:" /etc/group | cut -d: -f1)
if [ -z "$GROUP_NAME" ]; then
    GROUP_NAME="appgroup"
    addgroup -g "$PGID" "$GROUP_NAME"
else
    echo "Using existing group $GROUP_NAME for PGID $PGID"
fi

# Ensure the user exists with the correct PUID
USER_NAME=$(grep ":x:${PUID}:" /etc/passwd | cut -d: -f1)
if [ -z "$USER_NAME" ]; then
    USER_NAME="appuser"
    adduser -u "$PUID" -G "$GROUP_NAME" -D -s /bin/sh "$USER_NAME"
else
    echo "Using existing user $USER_NAME for PUID $PUID"
    # Ensure user is in the correct group
    addgroup "$USER_NAME" "$GROUP_NAME" 2>/dev/null || true
fi

# Ensure correct permissions on the application's data directory
mkdir -p /app/data
chown -R "$USER_NAME":"$GROUP_NAME" /app/data

# Drop privileges and run the provided command
exec su-exec "$USER_NAME" "$@"
