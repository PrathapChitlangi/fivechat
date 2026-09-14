# FiveChat v44

FiveChat private messenger with persistent MongoDB storage, 24-hour message retention, responsive desktop/mobile UI, group administration and Web Push notifications.

## v44 updates
- Login PIN label hidden; signup PIN label is **Create 4 Digit PIN**.
- Group three-dot menu now includes Group info, Rename group, Mute/Unmute notifications, Exit group, and Delete group for admins.
- All group members can add people.
- All group members can rename the group.
- Group member management is admin-only: click a member profile to Make admin/Remove admin/Remove member. The extra member three-dot control is removed.
- Notification control added to the top-right profile menu. It can enable/disable FiveChat browser push notifications. Browser permission itself is still controlled by the browser/OS.
- Premium transitions, hover states, menu motion, member interaction effects and muted-group indicator.
- Existing message copy/text selection prevention and unread-count behavior retained.

## Environment
- `MONGODB_URI` required.
- Optional `MONGODB_DB` (defaults to `fivechat`).
- Push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional `VAPID_SUBJECT`.

## Run
```bash
npm install
npm start
```
