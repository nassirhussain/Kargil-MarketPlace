
# Kargil Marketplace

This project is for the Kargil region and focuses on a hyperlocal marketplace for Kargil and Ladakh. It combines a React + Vite frontend with an Express + MongoDB backend for real listings, user accounts, admin moderation, messaging, reports, and verification workflows.

## Project overview

Kargil Marketplace is a local buying and selling platform designed for the Kargil/Ladakh community. It supports:

- listing products and services
- browsing and filtering items by location or category
- contact flows for sellers
- wishlist, follow, block, and report actions
- chat and unread messaging
- admin moderation and category management
- OTP-based verification workflows for email and phone

## Tech stack

- Frontend: React, Vite, React Router, Tailwind CSS, Lucide React, Recharts
- Backend: Express, Mongoose, JWT, MongoDB
- Optional providers: Resend for email OTP, Twilio Verify for SMS OTP

## Requirements

- Node.js 20.19 or later
- npm
- MongoDB (local or Atlas) for account, moderation, messaging, and preference data
- Optional Resend and Twilio Verify accounts for email and SMS OTP delivery

## Local development

1. Install frontend dependencies from the project root with `npm install`.
2. Install backend dependencies with `cd server; npm install`.
3. Copy `.env.example` to `server/.env` and configure your environment values. Keep the file private and untracked.
4. Start the API from `server` with `npm run dev`.
5. In a second terminal, start Vite from the project root with `npm run dev`.

For local development, leave `VITE_API_BASE` unset to use the Vite `/api` proxy, or set it to `http://localhost:3001/api` in a root `.env` file. Production builds require `VITE_API_BASE`; builds stop with an explicit error if it is missing.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Required in production | MongoDB connection string |
| `JWT_SECRET` | Required in production | Long, private signing key; never expose to Vite |
| `OTP_HASH_SECRET` | Required in production | Separate HMAC key for hashed email OTPs |
| `ADMIN_EMAILS` | Required in production | Comma-separated admin email allowlist |
| `FRONTEND_URL` | Required in production | Allowed frontend origin(s), comma-separated |
| `API_URL` | Required if Google OAuth is configured | Public API base URL used for the OAuth callback |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional | Google sign-in; credentials remain server-side |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional, required for email OTP | Resend API key and verified sender address |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Optional, required for SMS OTP | Twilio Verify SMS delivery and code checks |
| `VITE_API_BASE` | Frontend deployment setting | Public API URL ending in `/api`; it is not secret |
| `NODE_ENV` | Required in production | Set to `production`; startup rejects incomplete production configuration |
| `SEED_MONGO` | Optional | `true` is forbidden in production. No sample listing/shop/hotel seed is run. |
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
- `server/models/` — Mongoose user, product, shop, hotel, wishlist, report, follow, block, category, verification, and conversation schemas
- `server/lib/` — MongoDB setup/seeding, admin policy, default categories, and OTP provider adapters
- `server/middleware/` — Authentication and request rate limiting
- `render.yaml` — Render API/static frontend services and SPA fallback rewrite

## Data and privacy notes

- Precise listing coordinates are stored by the API but omitted from public responses. Public data includes coordinates rounded to approximately town scale for distance sorting.
- Listings, shops, hotels, categories, users, authenticated wishlists, follow/block preferences, reports, conversations, messages, read receipts, and account statuses are stored in MongoDB.
- The browser stores the JWT and a display cache for the signed-in user in local storage; the server re-checks the JWT and account state for protected actions. The selected town is a non-sensitive local preference. Wishlist data is loaded from the authenticated API, not browser storage.
- If MongoDB is unavailable, database-backed routes return `503`; the API no longer reads marketplace records from JSON fixture files. The health endpoint also returns `503` when MongoDB is unavailable.
- Production does not seed fixture listings, shops, or hotels. The configured category taxonomy is still inserted into MongoDB on startup if absent.
- Deactivating a category does not rewrite or delete existing listings that use it.
- Suspended/banned accounts cannot use authenticated APIs; their listings are excluded from public product results.
- API rate limits in process memory are per running instance. Deploy multiple instances behind a shared/distributed limiter for globally coordinated limits.
- Never point local integration testing at production MongoDB; use a dedicated database and provider test credentials.

## Deployment checklist

1. Set backend secrets in the API host environment. Do not commit `.env`.
2. Configure `MONGODB_URI`, `JWT_SECRET`, `OTP_HASH_SECRET`, `ADMIN_EMAILS`, `NODE_ENV=production`, and `SEED_MONGO=false`; configure OTP provider variables for every verification channel you offer.
3. Set `FRONTEND_URL` to exact deployed origin(s), and set `API_URL` for OAuth callbacks.
4. Set frontend build variable `VITE_API_BASE` to the deployed API URL ending in `/api`. Vite variables are public and must never contain credentials. `render.yaml` sets the currently verified API origin; verify the Render service URL before deploying.
5. Add `${API_URL}/api/auth/google/callback` as an authorized Google OAuth redirect URI.
6. Configure a verified Resend sender/domain and a Twilio Verify service before advertising email/SMS verification.
7. Review MongoDB backups, access controls, and network allowlists.
8. Deploy API and frontend, then verify `/api/health`, login, listings, and provider delivery against the deployed environment.

Render Blueprint services have auto-deploy enabled. A local build does not itself deploy changes; verify the Render deployment and public site after a Git push.

## Important note

This project is specifically designed for Kargil and nearby Ladakh communities. The marketplace should feel local and trustworthy, with real data and honest error states rather than demo-only placeholder content.
