# FiveChat v33

Responsive private messenger with persistent accounts/messages, live presence, direct and group chats, fast admin member management, group info/admin controls, group activity events, multi-user typing indicators, attachments, edit/unsend interactions, and a Telegram/WhatsApp-inspired responsive composer.

### v33 fixes
- Logout → login works immediately without a page reload and avoids stale socket-login races.
- Composer text/placeholder stays vertically centered on mobile and laptop; no drifting/scrolling label effect.
- Clean paper-plane send icon with no rotation/arrow hover distortion.
- Signup PIN label is visually removed; the PIN field keeps its icon and placeholder.
- Offline time no longer counts seconds; it updates in minute/hour/day steps.
- Group member add uses parallel account lookup for faster updates.
- Group rename is available from group options and group info for the admin.
- Group activity events show adds/removals/name changes/leaves in the chat.
- Group info shows members, status, and admin; admin-only add/remove/edit controls.
- Mobile message actions use long-press; desktop uses double-click.
- Tapping/clicking outside the action menu closes it; unsent messages have no edit/unsend actions.
- Group member messages retain stable sender-specific color treatment.
- Group typing indicators remain separate per person.
- Mobile sidebar keeps outside-tap close behavior and fixed group option menus.

Set `MONGODB_URI` on deployment for persistent database storage. Without MongoDB, the server uses in-memory fallback storage.
