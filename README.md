# UniEats

UniEats is a mobile-friendly campus dining platform for KAIST members. It helps users browse cafeteria menus, check meal details and availability, apply dietary filters, and share receipt-verified feedback so cafeteria managers can improve meal quality with reliable user data.


## Project Goals

- Provide real-time access to KAIST cafeteria menus, prices, ingredients, nutrition facts, allergy warnings, and availability.
- Support personalized meal discovery through allergy, ingredient, cuisine, and dietary preference filters.
- Improve review reliability with receipt-based verification before users can submit official meal feedback.
- Give cafeteria managers tools to update menus, mark sold-out items, monitor feedback, and respond to reviews.
- Use aggregated verified feedback to surface weekly recommendations and cafeteria ranking insights.

## User Roles

### Users

KAIST students and staff who use the service to:

- Register and log in with a verified `kaist.ac.kr` email address.
- Browse daily and weekly menus by cafeteria, cuisine, and dietary category.
- Manage allergy and ingredient preference profiles.
- Upload receipts for review eligibility.
- Submit verified ratings and reviews.
- Track their own reviews and manager responses.

### Managers

Cafeteria managers who use the service to:

- Add and update menu information.
- Mark meals as available or sold out in real time.
- Review user feedback trends.
- Reply to verified reviews.
- Monitor ranking and satisfaction analytics.

## Core Features

### Authentication

- KAIST email based registration and verification.
- Secure login and session handling.
- Access control for user and manager capabilities.

### Menu Discovery

- Dashboard for daily and weekly menus.
- Cuisine and dietary categories such as Korean, Western, Halal, vegetarian, and salad.
- Meal detail pages with price, ingredients, nutritional facts, allergy warnings, and availability status.
- Campus map view for cafeteria locations and operating hours.

### Search and Filtering

- Search by meal or cafeteria.
- Filter by cuisine type, cafeteria, allergens, and dietary preferences.
- Personalized warnings for meals that conflict with a user's allergy profile.

### Verified Feedback

- Receipt upload flow for verified review eligibility.
- OCR-based receipt checking for date, cafeteria, and purchased meal.
- One receipt, one review policy.
- Meal ratings on a 1-5 scale with itemized criteria such as taste, price, and portion size.
- Manager responses shown on the user's review history.

### Analytics and Recommendations

- Weekly best meals based on verified rating averages and review volume.
- Cafeteria ranking charts based on cumulative satisfaction.
- Feedback summaries for cafeteria managers.

## Planned Application Screens

- Login
- Registration
- Dashboard
- Campus map
- Search
- Meal detail
- Meal review
- My Page
- My Reviews
- Receipt upload and verification
- Manager dashboard

## Non-Functional Targets

- Page transitions and menu updates should complete within 2 seconds under normal conditions.
- The system should support at least 500 concurrent users during peak meal hours.
- The responsive web app should support modern Chromium-based browsers and Safari.
- Mobile support should target Android 9+ and iOS 15+.
- Personal data, allergy profiles, receipt images, and dining history must be protected with encryption and HTTPS.
- The codebase should be modular so new cafeterias, categories, and integrations can be added cleanly.

## Planned Technical Direction

The current development stack is:

- Frontend: Next.js
- Backend: NestJS
- Database: MongoDB
- Reverse proxy: nginx
- Container orchestration: Docker Compose

The frontend and backend are developed as separate applications. In the deployment setup, nginx serves as the public entrypoint and proxies `/api/` requests to the NestJS backend.

## Local Development

Install workspace dependencies from the repository root:

```bash
npm install
```

Run the backend:

```bash
npm run dev:backend
```

Run the frontend:

```bash
npm run dev:frontend
```

The frontend runs on `http://localhost:3000` and rewrites `/api/*` requests to the backend at `http://localhost:4000` during local development.

## Configuration Files

- Root `package.json`: npm workspace and repository-level scripts.
- `apps/frontend/package.json`: Next.js frontend dependencies and scripts.
- `apps/frontend/.env.example`: frontend environment variables (mock API toggle, backend base URL).
- `apps/backend/package.json`: NestJS backend dependencies and scripts.
- `apps/backend/.env.example`: local backend development environment variables.
- `deploy/.env.example`: Docker Compose environment variables, such as the exposed nginx host port.

### Frontend mock API

The frontend ships with in-app mock route handlers under `apps/frontend/src/app/api/*`
that match the team17 API envelope. They are used while the NestJS backend is
still being built so that pages can be developed independently.

To enable them, copy `apps/frontend/.env.example` to `apps/frontend/.env.local`
and keep `NEXT_PUBLIC_USE_MOCK=true`. Once the real backend is reachable, set it
to `false` (or remove the variable) to restore the `/api/*` -> backend rewrite
configured in `apps/frontend/next.config.js`.

## Docker Development

Start the full stack with nginx, frontend, backend, and MongoDB:

```bash
npm run docker:up
```

For deployment-style startup, generate `deploy/.env` and start the stack with:

```bash
sh deploy.sh APP_PUBLIC_URL=https://unieats.ssrf.kr KAKAO_MAP_APP_KEY=your-kakao-key
```

The deploy script accepts optional `OCR_PROVIDER`, `SMTP_HOST`, `SMTP_FROM`,
`KAKAO_MAP_APP_KEY`, `APP_PUBLIC_URL`, and `LETSENCRYPT_EMAIL` values.
`APP_PUBLIC_URL` is also used as `CORS_ORIGIN`, and its host is used as
`TLS_DOMAIN`. The script generates a fresh `OCR_WEBHOOK_SECRET` each time it
runs. Add `--issue-cert` with `LETSENCRYPT_EMAIL` on a public server to request
and install a Let's Encrypt certificate automatically.

By default, nginx listens on `http://localhost` and `https://localhost`.
Set `TLS_DOMAIN=unieats.ssrf.kr` and map that domain to the deployment host to
use the configured HTTPS virtual host.

Request flow:

```text
Browser
  └─ http://localhost or https://unieats.ssrf.kr
      ├─ /api/*  -> nginx -> NestJS backend
      └─ /*      -> nginx -> Next.js frontend
```

For local HTTPS testing and production Let's Encrypt issuance, see
`docs/https-letsencrypt.md`.

## Stacks
 - Next.js
 - NestJS

## Structure

```text
/
├─ package.json
├─ apps/
│  ├─ frontend/
│  │  ├─ src/
│  │  │  ├─ app/           # App Router routes, including mock /api handlers
│  │  │  ├─ components/    # Shared and shadcn/ui components
│  │  │  ├─ lib/           # API client, auth storage, validation, date helpers
│  │  │  ├─ mocks/         # Fixture data + response helpers
│  │  │  └─ types/         # Shared enums, API envelope, domain models
│  │  ├─ next.config.js
│  │  ├─ tailwind.config.ts
│  │  └─ package.json
│  └─ backend/
│     ├─ src/
│     │  ├─ app.module.ts
│     │  ├─ main.ts
│     │  └─ health/
│     ├─ nest-cli.json
│     └─ package.json
├─ deploy/
│  ├─ .env.example
│  ├─ docker-compose.yml
│  ├─ nginx/
│  │  └─ templates/
│  │     └─ default.conf.template
│  ├─ frontend/
│  │  └─ Dockerfile
│  └─ backend/
│     └─ Dockerfile
├─ docs/
├─ .dockerignore
├─ .gitignore
└─ README.md
```
