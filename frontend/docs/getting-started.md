# Getting Started

## Prerequisites

- **Node.js 18+** (any LTS is fine; CRA + React 19 work on 18/20/22).
- **Yarn** — this project pins with `yarn.lock`; do not use `npm install` (it will churn the lockfile).
- A running instance of the **RestaurantPos backend** at `http://localhost:8080` (or whatever `REACT_APP_API_BASE_URL` points at).

## Install

```bash
cd frontend
yarn install
```

## Configure

Create `frontend/.env`:

```
REACT_APP_API_BASE_URL=http://localhost:8080
REACT_APP_WS_BASE_URL=http://localhost:8080/ws
```

Both variables must be present. Never hardcode URLs elsewhere — everything routes through these two.

> **CORS reminder**: the backend's `SecurityConfig`/`WebSocketConfig` restricts origins to `http://localhost:3000` by default. If you must run on a different port, change it there — the frontend can't work around a CORS block.

## Run

```bash
yarn start
```

Opens on `http://localhost:3000`. Hot reload is on.

## First-time sanity checks

1. **Menu loads at `/`?** Go to `http://localhost:3000/?qr=a91c92e8-0f41-4812-aab4-99a7c495f9fd` — you should see the phone-number entry page for Table T1. If you see a "Cannot reach backend" toast, the backend is down or CORS is misconfigured (see the Debug Console below).
2. **Staff login works?** Go to `/staff/login`. Seeded credentials: `waiter1 / password123`, `kitchen1 / password123`, `cashier1 / password123`, `admin1 / password123`.
3. **Debug console?** Every screen has a floating "Debug" button in the bottom-right. Tap it to see every API request, WebSocket event, and error inline. Invaluable when wiring up a fresh backend.

## Available scripts

| Command       | What it does                                                    |
| ------------- | --------------------------------------------------------------- |
| `yarn start`  | Dev server with hot reload on port 3000.                        |
| `yarn build`  | Production build to `frontend/build/` (static SPA).             |
| `yarn test`   | CRA/Jest — the repo does not ship a full suite; skip unless adding tests. |
| `yarn eject`  | Do not use.                                                     |

## Test QR tokens (seeded tables)

| Table | qrToken                                | Full URL to open                                                          |
| ----- | -------------------------------------- | ------------------------------------------------------------------------- |
| T1    | `a91c92e8-0f41-4812-aab4-99a7c495f9fd` | `http://localhost:3000/?qr=a91c92e8-0f41-4812-aab4-99a7c495f9fd`          |
| T2    | `29c43117-9e33-488a-b1b7-d4697fad080d` | `http://localhost:3000/?qr=29c43117-9e33-488a-b1b7-d4697fad080d`          |
| T3    | `3ec47e18-ffd3-4332-a26c-020bfac4ea8f` | `http://localhost:3000/?qr=3ec47e18-ffd3-4332-a26c-020bfac4ea8f`          |
| T4    | `74361b7f-e2b7-4be8-9e8c-4c771fe7a78a` | `http://localhost:3000/?qr=74361b7f-e2b7-4be8-9e8c-4c771fe7a78a`          |
| T5    | `5ff5263d-0e28-449d-b4e6-4ece752c33a5` | `http://localhost:3000/?qr=5ff5263d-0e28-449d-b4e6-4ece752c33a5`          |

If your backend uses a different seed, ask the admin to fetch fresh tokens via `GET /api/admin/tables/roster`.

## Deployment notes

- Any static host (Netlify, Vercel, S3+CloudFront, Nginx) works — this is a plain SPA.
- Set `REACT_APP_API_BASE_URL` and `REACT_APP_WS_BASE_URL` to your public backend URL at **build time** (not runtime).
- Make sure the host serves `index.html` for every unknown path (SPA fallback), so `/staff/waiter` etc. work on hard refresh.
