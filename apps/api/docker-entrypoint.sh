#!/bin/sh
set -eu

# Defaults only: TypeScript validates and reads explicit ENV or FILE inputs.
# DB is optional, so the password file default applies only when DB_HOST is set.
if [ "${DB_HOST+x}" = x ] && [ "${DB_PASSWORD+x}" != x ] && [ "${DB_PASSWORD_FILE+x}" != x ]; then
    export DB_PASSWORD_FILE=/run/secrets/db_password
fi

if [ "${NEOPLE_API_KEY+x}" != x ] && [ "${NEOPLE_API_KEY_FILE+x}" != x ]; then
    export NEOPLE_API_KEY_FILE=/run/secrets/neople_api_key
fi

exec "$@"
