# FiveChat v61 — Complete 13-Feature Message Pack (No Voice)

Built from FiveChat v60 while preserving the existing UI, animations, authentication, groups, connection requests, push notifications, and composer.

## Message features implemented
1. Reply to a specific message — stored reply metadata, quoted preview, and tap/click-to-jump to the original.
2. Message reactions — persistent per-user reactions.
3. Forward messages — forward an available message to a connected one-to-one chat.
4. Copy message — browser clipboard copy from the message menu.
5. Edit sent message — sender-only edit with edited state and refreshed link preview.
6. Delete for me — per-user deletion stored separately, so it disappears only for that user.
7. Delete for everyone — sender-only soft delete; both sides receive a deleted-message placeholder.
8. Pin important messages — persistent pin/unpin.
9. Search inside conversation — searches the loaded conversation and jumps to results.
10. Jump to first/unread message — unread anchor plus a Jump to unread control.
11. Date separators — Today, Yesterday, or calendar date separators.
12. New messages divider — shown before the first unread message when opening a conversation with unread messages.
13. Link previews — safe server-side metadata extraction for public HTTP/HTTPS links, with SSRF protections, timeouts, and size limits.

## Data behavior
- Accounts and groups remain persistent in MongoDB.
- Messages still expire after 24 hours.
- Per-user delete markers are stored in `messageDeletes` and do not delete the original message for other participants.
- Deleted-for-everyone messages remain as soft-deleted records so clients stay synchronized.
- Link previews are stored with the message and therefore follow the same 24-hour message TTL.

## MongoDB / deployment
Use a persistent MongoDB URI. The server does not require an existing `messages` collection and safely creates the required indexes.

Required environment variable:
- `MONGODB_URI`

Optional:
- `MONGODB_DB`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## No voice recording
Voice recording is intentionally not included.
