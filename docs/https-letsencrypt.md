# HTTPS and Let's Encrypt

The Docker deployment stack exposes nginx on ports 80 and 443. nginx serves the
frontend, proxies `/api/*` to the backend, and uses certificates mounted from the
shared `letsencrypt` Docker volume.

## One-command deploy

Generate `deploy/.env` and start the stack:

```bash
sh deploy.sh APP_PUBLIC_URL=https://unieats.ssrf.kr KAKAO_MAP_APP_KEY=your-kakao-key
```

Optional values:

```bash
sh deploy.sh \
  OCR_PROVIDER=tesseract \
  SMTP_HOST=smtp.example.com \
  SMTP_FROM=no-reply@unieats.ssrf.kr \
  KAKAO_MAP_APP_KEY=your-kakao-key \
  LETSENCRYPT_EMAIL=admin@example.com \
  APP_PUBLIC_URL=https://unieats.ssrf.kr
```

`APP_PUBLIC_URL` is normalized to an origin and written to both `APP_PUBLIC_URL`
and `CORS_ORIGIN`. Its host is written to `TLS_DOMAIN`. `OCR_WEBHOOK_SECRET` is
randomized every time the script runs.

To request and install a Let's Encrypt certificate in the same deploy run:

```bash
sh deploy.sh \
  APP_PUBLIC_URL=https://unieats.ssrf.kr \
  KAKAO_MAP_APP_KEY=your-kakao-key \
  LETSENCRYPT_EMAIL=admin@example.com \
  --issue-cert
```

The script starts nginx with the local fallback certificate first so that the
HTTP-01 challenge path is reachable. If certificate issuance succeeds, it updates
`TLS_CERT_NAME` to the public domain and recreates nginx.

## Local HTTPS

For local testing, map `unieats.ssrf.kr` to `127.0.0.1`. The `cert-init` service
creates a short-lived self-signed certificate under the `local-selfsigned`
certificate name, so browsers may show a certificate warning.

```bash
sh deploy.sh --app-public-url https://unieats.ssrf.kr --dry-run
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

## Production certificate issuance

Before requesting a real certificate with `--issue-cert`, ensure that:

- `unieats.ssrf.kr` points to the public deployment host.
- Ports 80 and 443 are reachable from the internet.
- `LETSENCRYPT_EMAIL` is passed to `deploy.sh` or already set in `deploy/.env`.

Use the staging endpoint first if you want to test the ACME flow without hitting
production rate limits:

```bash
sh deploy.sh \
  APP_PUBLIC_URL=https://unieats.ssrf.kr \
  LETSENCRYPT_EMAIL=admin@example.com \
  --issue-cert \
  --staging
```

Then run against the production endpoint:

```bash
sh deploy.sh \
  APP_PUBLIC_URL=https://unieats.ssrf.kr \
  LETSENCRYPT_EMAIL=admin@example.com \
  --issue-cert
```

For renewal, run the certbot renewal command and reload nginx:

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env --profile tls run --rm certbot renew \
  --webroot \
  --webroot-path /var/www/certbot
docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec nginx nginx -s reload
```
