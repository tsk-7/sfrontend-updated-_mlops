# Sleep Pattern & Cycle Analysis

A Next.js frontend for sleep timing and schedule analysis. Sleep records and calculated sleep metrics are stored and served by the FastAPI backend in MySQL; the sleep-quality prediction remains a separate ML Analysis feature. The browser calls same-origin Next.js route handlers, and the backend origin is read only by the server.

## Pages

- `/` — Dashboard summary and weekday/weekend comparison.
- `/sleep-timeline` — Midnight-safe 24-hour sleep windows.
- `/sleep-trends` — Bedtime, wake-time, and sleep-duration charts for 7, 30, or 90 days.
- `/sleep-consistency` — Timing variability and the documented descriptive consistency index.
- `/circadian-analysis` — Mid-sleep and social-jetlag comparison.
- `/sleep-calendar` — Selectable monthly sleep records and daily details.
- `/lifestyle-factors` — Explains that lifestyle inputs are separate and are not collected with sleep-pattern records.
- `/pattern-analysis` — Rule-based descriptive patterns with explicit thresholds.
- `/ml-analysis` — The connected sleep-quality prediction form.
- `/reports` — Period summary with CSV download.

## Sleep-history data

`/sleep-calculator` sends bedtime, actual sleep time, wake-up time, get-up time, date, and notes to FastAPI. The backend persists records in MySQL and returns overnight-safe sleep duration, time in bed, onset/get-up latency, and sleep efficiency. Timeline, trend, consistency, circadian, calendar, pattern, and report views use backend records and analysis responses. No demo or browser-local sleep history is used. Lifestyle factors are not mixed into the sleep-pattern calculations, and quality ML remains on `/ml-analysis`.

## Local setup

Requirements: Node.js 20.9 or later.

1. Install dependencies:

	```bash
	npm install
	```

2. Create `.env.local` in the project root:

	```dotenv
	SLEEP_API_BASE_URL=http://127.0.0.1:8000
	```

3. Start the backend first, with `SLEEP_DATABASE_URL` configured as described in the backend README. Then start the frontend:

	```bash
	npm run dev
	```

4. Open [http://localhost:3000](http://localhost:3000).

The Render free service may take a little while to wake after inactivity. The interface shows service and request loading states while it responds.

## API routes

- `GET /api/health` proxies to the configured `/health` endpoint and drives the connected/offline status.
- `GET /api/metadata` proxies to `/metadata` for model/dataset context.
- `POST /api/predict` validates JSON syntax and forwards the body to `/predict`.
- `POST /api/sleep-records` saves a record only after FastAPI confirms the database insert.
- `GET/PUT/DELETE /api/sleep-records/...` proxies sleep-record CRUD.
- `GET /api/sleep-analysis/...` proxies database-backed timing analyses.

The proxy allows 55 seconds for an upstream response and returns a useful timeout message if Render does not respond. The prediction form validates the API input ranges before submission.

## Production checks

```bash
npm run lint
npm run build
npm run start
```

## Deploy to Vercel

1. Import this folder as a Vercel project, or deploy it with the Vercel CLI.
2. In **Project Settings → Environment Variables**, set `SLEEP_API_BASE_URL` to the deployed FastAPI backend for each deployment environment you use. The backend must also have its MySQL `SLEEP_DATABASE_URL` configured.
3. Deploy or redeploy so the variable is available to the server-side route handlers.

Do not commit `.env.local`. No API origin or secret is exposed to client code.
