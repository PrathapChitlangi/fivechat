# FiveChat v36

Responsive private messenger with persistent MongoDB accounts/messages/groups, live presence, direct and group chats, unread notifications, attachments, edit/unsend interactions, group member management, and polished animated UI.

### v36 updates
- Incoming direct/group messages now maintain unread counts even when another chat is open or the app is temporarily hidden; counts persist locally until that conversation is opened while visible.
- Unread badges use a polished blue pill, `99+` overflow, and a subtle arrival animation.
- Unsent messages keep their original sender alignment. A sender sees the unsent bubble on the right; the receiver sees it on the left.
- Group-name editing now uses a premium in-app editor instead of the browser `prompt`, with animated modal entry, focus glow, character counter, and responsive buttons.
- The group-name edit control is now a compact SVG edit icon with hover/press transitions.
- Logout now uses a custom animated confirmation dialog instead of an immediate logout.
- Group three-dot menus are rendered as fixed viewport popovers and are positioned from the button bounds, preventing the menu from moving when the row animates or when the sidebar is hovered/scrolled.
- Group delete and leave actions use consistent animated confirmation dialogs.
- Terminal admin utility added as `admin.js`. It supports listing users/groups, inspecting a user/group, adding/removing group members, renaming groups, deleting groups, and removing accounts. Destructive operations require typing `YES`.
- The terminal utility never prints or exposes PINs. FiveChat stores only `pinHash`.

### MongoDB
Set `MONGODB_URI` on deployment. `MONGODB_DB` is optional and defaults to `fivechat`.

Messages continue to expire automatically after 24 hours through MongoDB TTL.

### Terminal admin examples

```bash
npm install
export MONGODB_URI="your-mongodb-connection-string"

node admin.js list-users
node admin.js list-groups
node admin.js show-user "username"
node admin.js show-group "group-id"
node admin.js add-member "group-id" "username"
node admin.js remove-member "group-id" "username"
node admin.js rename-group "group-id" "New Group Name"
node admin.js remove-user "username"
node admin.js remove-user "username" --purge-chats
node admin.js delete-group "group-id"
```

For routine member management, prefer the app/admin UI so connected users receive real-time updates. Use the terminal utility for authorized database administration and recovery tasks.


### Push notifications
Set these deployment environment variables to enable browser push notifications on all registered devices/browsers:

```bash
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:your-admin-email@example.com
```

Generate a key pair once with:

```bash
npx web-push generate-vapid-keys
```

The app stores one push subscription per browser/device in `pushSubscriptions`. Subscriptions are retained after logout so offline users can still receive notifications. Invalid subscriptions are automatically removed. Push requires HTTPS (localhost is allowed by browsers for development) and the user must grant notification permission.
