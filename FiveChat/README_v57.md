# FiveChat v57 — Connection Requests + AI/UX Update

Built from FiveChat v56. Voice recording is intentionally excluded.

## New in v57
- One-to-one chat request flow: Send → Pending → Accept/Decline/Cancel.
- Dedicated Chat Requests panel with incoming/sent requests and unread request badge.
- Accepting a request creates a persistent private connection.
- Existing direct conversations remain available for backward compatibility.
- New direct messages are blocked until a connection/request is accepted.
- Block user from one-to-one chat info; blocked users cannot create a connection.
- Push notifications for new chat requests and accepted requests, respecting the existing notification toggle.
- Request notification click opens the request panel.
- Mobile + laptop responsive request UI with smooth glass/transition effects.
- Existing v56 features retained: groups/admin management, push notifications, unread counts, 30-minute inactivity session expiry, sessionStorage tab behavior, clear chat history, group info, responsive composer, attachments, typing animation, online/last-seen, PIN icons, and AI-style visual polish.

## Push environment variables
- `MONGODB_URI`
- `MONGODB_DB` (optional; defaults to `fivechat`)
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (optional)

Never expose `VAPID_PRIVATE_KEY` in the browser or repository.

## Deploy
Upload/deploy the ZIP as the complete project. Render should run the package start command from `package.json`.

After deployment, do one hard refresh if an older browser tab still shows the previous UI.
