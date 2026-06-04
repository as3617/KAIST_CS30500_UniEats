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
  APP_PUBLIC_URL=https://unieats.ssrf.kr
```

`APP_PUBLIC_URL` is normalized to an origin and written to both `APP_PUBLIC_URL`
and `CORS_ORIGIN`. Its host is written to `TLS_DOMAIN`. `OCR_WEBHOOK_SECRET` is
randomized every time the script runs.

## Local HTTPS

For local testing, map `unieats.ssrf.kr` to `127.0.0.1`. The `cert-init` service
creates a short-lived self-signed certificate under the `local-selfsigned`
certificate name, so browsers may show a certificate warning.

```bash
sh deploy.sh --app-public-url https://unieats.ssrf.kr --dry-run
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

## Production certificate issuance

Before requesting a real certificate, ensure that:

- `unieats.ssrf.kr` points to the public deployment host.
- Ports 80 and 443 are reachable from the internet.
- `LETSENCRYPT_EMAIL` is set in `deploy/.env`.

Then request a certificate with the webroot challenge:

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env --profile tls run --rm certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$TLS_DOMAIN"
```

After issuance, set `TLS_CERT_NAME` to the domain certificate name if needed and
restart nginx:

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d nginx
```

For renewal, run the certbot renewal command and reload nginx:

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env --profile tls run --rm certbot renew \
  --webroot \
  --webroot-path /var/www/certbot
docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec nginx nginx -s reload
```
