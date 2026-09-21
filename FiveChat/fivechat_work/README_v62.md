# FiveChat v62 — Complete Feature Build (No Voice)

This build extends v61 while preserving the existing FiveChat UI and messaging system.

## Included
- Connection requests: accept, decline, cancel, expiration (7 days), request history, notifications.
- Connections: block/unblock, blocked-user list, remove connection, mutual connections, recent interactions, suggested people / People you may know.
- Messaging: reply, reactions, forwarding, copy, edit, delete for me/everyone, pin, search, unread jump, date separators, New messages divider, last-seen, typing, delivery/seen state, link previews.
- Notifications: message/request/accepted/group/mention/reply notifications, sound/browser/badge preferences, chat/group mute, PWA push.
- Groups: create, add/remove, admins/multiple admins, rename, description, avatar URL, invite links, leave, optional admin approval for invite joins, remove confirmation, group events.
- UI: animated auth, avatars, online animation, responsive layouts, themes, accent color, compact mode, bubble customization, skeleton/loading-safe behavior, offline/reconnection indicators.
- Account: change PIN, Forgot PIN recovery using the configured recovery access code, persistent server sessions, logout all devices, device/session list, account deletion, profile editing, privacy controls.
- Security/reliability: request/message rate limiting, server-side relationship checks, session tokens, MongoDB retry on startup, safe indexes, duplicate client-message prevention, 24-hour message TTL, restart-safe account data.
- Admin dashboard: `/admin.html` with ADMIN_SECRET protection for metrics, users, suspend/restore/delete, reports and activity logs.

## Environment
- `MONGODB_URI` required
- `MONGODB_DB` optional (default `fivechat`)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` for Web Push
- `ADMIN_SECRET` required to use the administrator dashboard
- `OPENAI_API_KEY` optional for AI suggestions

## Important recovery note
Forgot-PIN uses the configured FiveChat recovery access code. For production, set a private recovery mechanism instead of sharing the code.

## Admin
Open `/admin.html`, enter the `ADMIN_SECRET`, and load the dashboard. Never expose the secret in client-side code or GitHub.
