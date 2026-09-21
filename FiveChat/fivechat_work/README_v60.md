# FiveChat v60 — 13 Feature Packs (No Voice Recording)

This build extends v59 with the full feature roadmap requested. Existing connection requests, messaging, groups, push notifications, persistence, unread counts, reactions, pinning, edit/unsend, attachments, and 24-hour message expiry are retained.

## 13 updated feature packs
1. Personal connections: accept/decline/cancel requests, request privacy modes.
2. Advanced chat: reply, reactions, edit, unsend, pin, clear history.
3. Message status: sent/delivered/seen and typing.
4. Notifications: push subscription/activity awareness.
5. Groups: member/admin management, join/leave/delete, invite-token support.
6. Media/files: image and document attachments with previews.
7. UI/UX: light/dark/system themes and compact mode.
8. Privacy/security: request controls, read-receipt control, reporting, blocking.
9. Search: people search plus in-conversation message search.
10. Reliability: persistent login, Socket.IO reconnect, MongoDB-safe startup/index handling.
11. Smart assistant: optional AI reply suggestions via OPENAI_API_KEY, with local fallback when no key is configured.
12. Profile: editable About/bio plus profile/settings panel.
13. Admin/safety foundation: report storage and existing terminal admin utilities for users/groups.

Voice recording remains intentionally disabled.

## Optional AI configuration
Set `OPENAI_API_KEY` in Render to enable AI reply suggestions. Optionally set `OPENAI_MODEL`. Without a key, the Smart Assistant uses a local non-network fallback.
