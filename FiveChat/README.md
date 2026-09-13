# FiveChat

FiveChat uses MongoDB as the persistent source of truth. Accounts and groups are kept across browser refreshes, server restarts, and redeploys. Chat messages are stored in MongoDB and automatically expire 24 hours after they are created.

## Required environment variables
- `MONGODB_URI` — persistent MongoDB connection string (MongoDB Atlas is suitable for Render).
- `MONGODB_DB` — optional database name; defaults to `fivechat`.
- `PORT` — supplied by Render automatically.

The server intentionally refuses to start when `MONGODB_URI` is missing, rather than falling back to temporary in-memory data. This prevents accounts from disappearing after a restart.

## Deploy / Render
1. Create a persistent MongoDB database and copy its connection string.
2. In the Render service, open **Environment** and add `MONGODB_URI` with that connection string.
3. Optionally set `MONGODB_DB=fivechat`.
4. Redeploy.

The server creates the required indexes automatically. Message expiry uses a MongoDB TTL index on `expiresAt` with a 24-hour lifetime.
