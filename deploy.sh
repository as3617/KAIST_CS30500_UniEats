#!/usr/bin/env sh
set -eu

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  sh deploy.sh [options]

Options:
  --ocr-provider VALUE          OCR provider name, e.g. tesseract or clova
  --smtp-host VALUE             SMTP host used by the backend mailer
  --smtp-from VALUE             Sender email address used by the backend mailer
  --kakao-map-app-key VALUE     Kakao JavaScript map app key for the frontend
  --app-public-url VALUE        Public app origin. Also sets CORS_ORIGIN and TLS_DOMAIN
  --dry-run                     Generate deploy/.env without starting containers
  -h, --help                    Show this help message

Environment-style arguments are also accepted:
  sh deploy.sh OCR_PROVIDER=tesseract APP_PUBLIC_URL=https://unieats.ssrf.kr

If an option is omitted, the script keeps the existing deploy/.env value when
present, otherwise it uses a local-safe default. OCR_WEBHOOK_SECRET is generated
randomly on every run.
EOF
}

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ENV_FILE="$SCRIPT_DIR/deploy/.env"
COMPOSE_FILE="$SCRIPT_DIR/deploy/docker-compose.yml"

DRY_RUN=0
OCR_PROVIDER_ARG=""
SMTP_HOST_ARG=""
SMTP_FROM_ARG=""
KAKAO_MAP_APP_KEY_ARG=""
APP_PUBLIC_URL_ARG=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --ocr-provider=*)
      OCR_PROVIDER_ARG=${1#*=}
      ;;
    --ocr-provider)
      [ "$#" -ge 2 ] || die "Missing value for --ocr-provider"
      shift
      OCR_PROVIDER_ARG=$1
      ;;
    OCR_PROVIDER=*)
      OCR_PROVIDER_ARG=${1#*=}
      ;;
    --smtp-host=*)
      SMTP_HOST_ARG=${1#*=}
      ;;
    --smtp-host)
      [ "$#" -ge 2 ] || die "Missing value for --smtp-host"
      shift
      SMTP_HOST_ARG=$1
      ;;
    SMTP_HOST=*)
      SMTP_HOST_ARG=${1#*=}
      ;;
    --smtp-from=*)
      SMTP_FROM_ARG=${1#*=}
      ;;
    --smtp-from)
      [ "$#" -ge 2 ] || die "Missing value for --smtp-from"
      shift
      SMTP_FROM_ARG=$1
      ;;
    SMTP_FROM=*)
      SMTP_FROM_ARG=${1#*=}
      ;;
    --kakao-map-app-key=*)
      KAKAO_MAP_APP_KEY_ARG=${1#*=}
      ;;
    --kakao-map-app-key)
      [ "$#" -ge 2 ] || die "Missing value for --kakao-map-app-key"
      shift
      KAKAO_MAP_APP_KEY_ARG=$1
      ;;
    KAKAO_MAP_APP_KEY=*)
      KAKAO_MAP_APP_KEY_ARG=${1#*=}
      ;;
    --app-public-url=*)
      APP_PUBLIC_URL_ARG=${1#*=}
      ;;
    --app-public-url)
      [ "$#" -ge 2 ] || die "Missing value for --app-public-url"
      shift
      APP_PUBLIC_URL_ARG=$1
      ;;
    APP_PUBLIC_URL=*)
      APP_PUBLIC_URL_ARG=${1#*=}
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
  shift
done

read_env_value() {
  key=$1
  default_value=$2
  value=""

  if [ -f "$ENV_FILE" ]; then
    value=$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | sed "s/^${key}=//" || true)
  fi

  if [ -n "$value" ]; then
    printf '%s' "$value"
  else
    printf '%s' "$default_value"
  fi
}

pick_value() {
  provided=$1
  key=$2
  default_value=$3

  if [ -n "$provided" ]; then
    printf '%s' "$provided"
  else
    read_env_value "$key" "$default_value"
  fi
}

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi

  if [ -r /dev/urandom ] && command -v od >/dev/null 2>&1; then
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
    return
  fi

  die "Cannot generate a random secret because neither openssl nor /dev/urandom is available"
}

normalize_public_origin() {
  input=$1
  [ -n "$input" ] || die "APP_PUBLIC_URL cannot be empty"

  case "$input" in
    http://*|https://*)
      ;;
    *)
      input="https://$input"
      ;;
  esac

  case "$input" in
    http://*)
      scheme="http"
      rest=${input#http://}
      ;;
    https://*)
      scheme="https"
      rest=${input#https://}
      ;;
    *)
      die "APP_PUBLIC_URL must use http or https"
      ;;
  esac

  authority=${rest%%/*}
  [ -n "$authority" ] || die "APP_PUBLIC_URL must include a host"

  printf '%s://%s' "$scheme" "$authority"
}

domain_from_origin() {
  origin=$1
  rest=${origin#http://}
  rest=${rest#https://}
  host=${rest%%:*}
  [ -n "$host" ] || die "Cannot derive TLS_DOMAIN from APP_PUBLIC_URL"
  printf '%s' "$host"
}

APP_PUBLIC_URL_VALUE=$(pick_value "$APP_PUBLIC_URL_ARG" APP_PUBLIC_URL "https://unieats.ssrf.kr")
APP_PUBLIC_URL_VALUE=$(normalize_public_origin "$APP_PUBLIC_URL_VALUE")
TLS_DOMAIN_VALUE=$(domain_from_origin "$APP_PUBLIC_URL_VALUE")

ACCESS_TOKEN_SECRET_VALUE=$(read_env_value ACCESS_TOKEN_SECRET "")
case "$ACCESS_TOKEN_SECRET_VALUE" in
  ""|replace-with-a-long-random-secret)
    ACCESS_TOKEN_SECRET_VALUE=$(random_hex)
    ;;
esac

OCR_WEBHOOK_SECRET_VALUE=$(random_hex)

APP_PORT_VALUE=$(read_env_value APP_PORT "80")
APP_HTTPS_PORT_VALUE=$(read_env_value APP_HTTPS_PORT "443")
TLS_CERT_NAME_VALUE=$(read_env_value TLS_CERT_NAME "local-selfsigned")
LETSENCRYPT_EMAIL_VALUE=$(read_env_value LETSENCRYPT_EMAIL "")
MONGO_INITDB_DATABASE_VALUE=$(read_env_value MONGO_INITDB_DATABASE "unieats")
ACCESS_TOKEN_TTL_SECONDS_VALUE=$(read_env_value ACCESS_TOKEN_TTL_SECONDS "900")
REFRESH_TOKEN_TTL_DAYS_VALUE=$(read_env_value REFRESH_TOKEN_TTL_DAYS "30")
KAKAO_MAP_APP_KEY_VALUE=$(pick_value "$KAKAO_MAP_APP_KEY_ARG" KAKAO_MAP_APP_KEY "")
SMTP_HOST_VALUE=$(pick_value "$SMTP_HOST_ARG" SMTP_HOST "")
SMTP_FROM_VALUE=$(pick_value "$SMTP_FROM_ARG" SMTP_FROM "")
LOCAL_EMAIL_VERIFY_TOKEN_VALUE=$(read_env_value LOCAL_EMAIL_VERIFY_TOKEN "local-email-verify-token")
LOCAL_PASSWORD_RESET_TOKEN_VALUE=$(read_env_value LOCAL_PASSWORD_RESET_TOKEN "local-password-reset-token")
LOCAL_PASSWORD_RESET_PASSWORD_VALUE=$(read_env_value LOCAL_PASSWORD_RESET_PASSWORD "UnieatsReset123!")
OCR_PROVIDER_VALUE=$(pick_value "$OCR_PROVIDER_ARG" OCR_PROVIDER "tesseract")
OCR_SERVICE_URL_VALUE=$(read_env_value OCR_SERVICE_URL "http://ocr:5000/process")
OCR_WEBHOOK_URL_VALUE=$(read_env_value OCR_WEBHOOK_URL "http://backend:4000/api/receipts/webhook")
KAIST_MENU_SYNC_INTERVAL_SECONDS_VALUE=$(read_env_value KAIST_MENU_SYNC_INTERVAL_SECONDS "86400")
KAIST_MENU_SYNC_RETRY_SECONDS_VALUE=$(read_env_value KAIST_MENU_SYNC_RETRY_SECONDS "300")
KAIST_MENU_SYNC_DAYS_VALUE=$(read_env_value KAIST_MENU_SYNC_DAYS "7")
KAIST_MENU_SYNC_START_DATE_VALUE=$(read_env_value KAIST_MENU_SYNC_START_DATE "")

cat > "$ENV_FILE" <<EOF
APP_PORT=$APP_PORT_VALUE
APP_HTTPS_PORT=$APP_HTTPS_PORT_VALUE
TLS_DOMAIN=$TLS_DOMAIN_VALUE
TLS_CERT_NAME=$TLS_CERT_NAME_VALUE
LETSENCRYPT_EMAIL=$LETSENCRYPT_EMAIL_VALUE
MONGO_INITDB_DATABASE=$MONGO_INITDB_DATABASE_VALUE
CORS_ORIGIN=$APP_PUBLIC_URL_VALUE
ACCESS_TOKEN_SECRET=$ACCESS_TOKEN_SECRET_VALUE
ACCESS_TOKEN_TTL_SECONDS=$ACCESS_TOKEN_TTL_SECONDS_VALUE
REFRESH_TOKEN_TTL_DAYS=$REFRESH_TOKEN_TTL_DAYS_VALUE
APP_PUBLIC_URL=$APP_PUBLIC_URL_VALUE
KAKAO_MAP_APP_KEY=$KAKAO_MAP_APP_KEY_VALUE
SMTP_HOST=$SMTP_HOST_VALUE
SMTP_FROM=$SMTP_FROM_VALUE
LOCAL_EMAIL_VERIFY_TOKEN=$LOCAL_EMAIL_VERIFY_TOKEN_VALUE
LOCAL_PASSWORD_RESET_TOKEN=$LOCAL_PASSWORD_RESET_TOKEN_VALUE
LOCAL_PASSWORD_RESET_PASSWORD=$LOCAL_PASSWORD_RESET_PASSWORD_VALUE
OCR_PROVIDER=$OCR_PROVIDER_VALUE
OCR_SERVICE_URL=$OCR_SERVICE_URL_VALUE
OCR_WEBHOOK_URL=$OCR_WEBHOOK_URL_VALUE
OCR_WEBHOOK_SECRET=$OCR_WEBHOOK_SECRET_VALUE
KAIST_MENU_SYNC_INTERVAL_SECONDS=$KAIST_MENU_SYNC_INTERVAL_SECONDS_VALUE
KAIST_MENU_SYNC_RETRY_SECONDS=$KAIST_MENU_SYNC_RETRY_SECONDS_VALUE
KAIST_MENU_SYNC_DAYS=$KAIST_MENU_SYNC_DAYS_VALUE
KAIST_MENU_SYNC_START_DATE=$KAIST_MENU_SYNC_START_DATE_VALUE
EOF

if command -v chmod >/dev/null 2>&1; then
  chmod 600 "$ENV_FILE" 2>/dev/null || true
fi

printf 'Wrote %s\n' "$ENV_FILE"
printf 'APP_PUBLIC_URL=%s\n' "$APP_PUBLIC_URL_VALUE"
printf 'CORS_ORIGIN=%s\n' "$APP_PUBLIC_URL_VALUE"
printf 'TLS_DOMAIN=%s\n' "$TLS_DOMAIN_VALUE"
printf 'OCR_WEBHOOK_SECRET=randomized\n'

if [ "$DRY_RUN" -eq 1 ]; then
  printf 'Dry run complete; Docker Compose was not started.\n'
  exit 0
fi

command -v docker >/dev/null 2>&1 || die "docker command is required to deploy"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate --no-deps nginx
