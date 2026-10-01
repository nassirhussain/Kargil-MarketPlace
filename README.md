# Kargil Marketplace

A hyperlocal marketplace for people in Kargil and Ladakh. The existing React/Vite application talks to an Express API backed by MongoDB; authentication and account-scoped actions require MongoDB.

## Requirements

- Node.js 20.19 or later
- npm
- MongoDB (local or Atlas) for account, moderation, messaging, and preference data
- Optional Resend and Twilio Verify accounts for email and SMS OTP delivery

## Local development

1. Install frontend dependencies from the project root with `npm install`.
2. Install backend dependencies with `cd server; npm install`.
3. Copy `.env.example` to `server/.env` and configure `MONGODB_URI`, a long random `JWT_SECRET`, and `FRONTEND_URL=http://localhost:5173`. Keep the copied file private and untracked.
4. Start the API from `server` with `npm run dev`.
5. In a second terminal, start Vite from the project root with `npm run dev`.

For a local frontend API URL, either leave `VITE_API_BASE` unset to use the Vite `/api` proxy or set it to `http://localhost:3001/api` in a root `.env` file.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes for database-backed features | MongoDB connection string |
| `JWT_SECRET` | Yes for authentication | Long, private signing key; never expose to Vite |
| `OTP_HASH_SECRET` | Recommended | Separate HMAC key for hashed email OTPs; falls back to `JWT_SECRET` |
| `ADMIN_EMAILS` | Recommended in production | Comma-separated admin email allowlist; when set, it is the source of admin privileges |
| `FRONTEND_URL` | Yes in production | Allowed frontend origin(s), comma-separated |
| `API_URL` | For Google OAuth | Public API base URL used for the OAuth callback |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional | Google sign-in; credentials remain server-side |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional, required for email OTP | Resend API key and verified sender address |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Optional, required for SMS OTP | Twilio Verify SMS delivery and code checks |
| `VITE_API_BASE` | Frontend deployment setting | Public API URL ending in `/api`; it is not secret |
| `SEED_MONGO` | Optional | Set to `true` only in development to seed sample shops, hotels, or product data. Production should leave it unset or false. |
| `PORT` | Optional | API port supplied by the hosting provider |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | Optional | MongoDB connection timeout |

OTP codes are delivered only through configured providers. Email codes are stored as keyed hashes, expire after ten minutes, and are removed after successful verification. Twilio Verify manages SMS codes. Cooldown, daily request limits, attempt limits, and API rate limits are enforced. Without provider credentials, requests return an explicit `503` instead of pretending a code was sent.

Phone numbers must use international E.164 format (for example, `+919876543210`). Updating a phone number resets its verification status.

## Commands

From the project root:

```sh
npm run dev       # Vite development server
npm run build     # Production frontend build
npm run preview   # Preview the production build
```

From `server`:

```sh
npm run dev       # Restarting Express development server
npm start         # Production API server
npm test          # Offline Node.js unit tests
```

## Project layout

- `src/main.jsx`, `src/styles.css` — React routes, marketplace screens, and styling
- `server/server.js` — Express app, CORS, OAuth initialization, and API mounting
- `server/routes/` — Authentication, products, messaging, moderation, and category APIs
- `server/models/` — Mongoose user, product, report, follow, block, category, verification, and conversation schemas
- `server/lib/` — MongoDB setup/seeding, admin policy, default categories, and OTP provider adapters
- `server/middleware/` — Authentication and request rate limiting
- `render.yaml` — Render API/static frontend services and SPA fallback rewrite

## Data and privacy notes

- Precise listing coordinates are stored by the API but omitted from public responses. Public data includes coordinates rounded to approximately town scale for distance sorting.
- Authenticated follow/block preferences, reports, conversations, messages, read receipts, and account statuses are stored in MongoDB.
- Deactivating a category does not rewrite or delete existing listings that use it.
- Suspended/banned accounts cannot use authenticated APIs; their listings are excluded from public product results.
- API rate limits in process memory are per running instance. Deploy multiple instances behind a shared/distributed limiter for globally coordinated limits.
- Never point local integration testing at production MongoDB; use a dedicated database and provider test credentials.

## Deployment checklist

1. Set backend secrets in the API host environment. Do not commit `.env`.
2. Configure `MONGODB_URI`, `JWT_SECRET`, `OTP_HASH_SECRET`, and `ADMIN_EMAILS`; configure OTP provider variables for every verification channel you offer.
3. Set `FRONTEND_URL` to exact deployed origin(s), and set `API_URL` for OAuth callbacks.
4. Set frontend build variable `VITE_API_BASE` to the deployed API URL ending in `/api`. Vite variables are public and must never contain credentials.
5. Add `${API_URL}/api/auth/google/callback` as an authorized Google OAuth redirect URI.
6. Configure a verified Resend sender/domain and a Twilio Verify service before advertising email/SMS verification.
7. Review MongoDB backups, access controls, and network allowlists.
8. Deploy API and frontend, then verify `/api/health`, login, listings, and provider delivery against the deployed environment.

Render Blueprint services have auto-deploy enabled. A local build does not itself deploy changes; verify the Render deployment and public site after a Git push.
