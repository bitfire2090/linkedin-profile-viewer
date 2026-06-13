# LinkedIn Profile Viewer

Full-stack Next.js (App Router) app that scrapes LinkedIn profiles via Apify, caches results in MongoDB, and renders a LinkedIn-style viewer with account-based access, admin approval controls, searchable history, and per-user usage tracking.

## Quick start
1. Install deps: `npm install`
2. Create `.env.local`:
   ```
   APIFY_TOKEN=your-apify-token
   APIFY_ACTOR_ID=your-actor-id # optional fallback actor shown in admin settings
   APIFY_PROFILE_MODE="Profile details no email ($4 per 1k)" # optional, matches actor input
   MONGODB_URI=mongodb+srv://...
   APP_ADMIN_USERNAME=admin # optional but recommended
   APP_ADMIN_PASSWORD=change-this-password # optional but recommended
   ```
   Admins can select the global Apify actor in the admin panel. The app supports the configured `APIFY_ACTOR_ID` actor with `profileScraperMode` + `queries` input, and `unseenuser/LinkedIn-Profile` with `queries` input. Scraper output is normalized into the shape shown in `src/types/linkedin.ts`.
3. Run dev server: `npm run dev` then open http://localhost:3000

## Auth and roles
- Users register with a username and password.
- New users are created as pending and cannot sign in until an admin approves them.
- Disabled users are blocked from signing in and their active sessions are revoked immediately.
- If `APP_ADMIN_USERNAME` and `APP_ADMIN_PASSWORD` are set, the app seeds that admin account automatically.
- If no approved admin exists, the first registered account is auto-promoted to admin so the app is still bootstrappable.

## API
- `POST /api/auth/register` — body: `{ username, password }`; creates a user account and only creates a session if the account is already approved.
- `POST /api/auth/login` — body: `{ username, password }`; signs in approved, enabled users.
- `POST /api/auth/logout` — clears the active session cookie.
- `GET /api/auth/session` — returns the current signed-in user.
- `POST /api/search` — body: `{ url: "https://www.linkedin.com/in/..." }`; returns cached data if present, otherwise triggers Apify and stores the result. Search requests are logged per user.
- `GET /api/history?page=1&pageSize=8` — paginated shared search history from MongoDB.
- `GET /api/usage` — aggregate usage metrics, recent search activity, and per-user search totals for approved users.
- `PATCH /api/admin/users/:userId` — admin-only user actions: approve, disable, enable.
- `GET/PATCH /api/admin/apify-settings` - admin-only global Apify actor selection.

## Security
- Get approved after register the user

## Notes
- Mongo collection `searches` is indexed on `url` to enforce single-cache per profile.
- Mongo collection `users` stores account status and roles.
- Mongo collection `sessions` stores expiring session tokens.
- Mongo collection `searchEvents` stores per-user search activity for usage reporting.
- Mongo collection `appSettings` stores the global Apify actor selection used by all users.
- UI is Tailwind-powered (Next.js + Tailwind CSS v4). All types for the scraper payload live in `src/types/linkedin.ts`.

