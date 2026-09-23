# FiveChat v50 — Group Management UX Update

Includes the previous FiveChat features plus:

- Group three-dot menu with Group info, Rename, Exit, and admin-only Delete group.
- Delete group removes the group from every member's list after server confirmation.
- Group avatar no longer shows the extra down-arrow/v symbol.
- Every group member can open Add people and add registered users.
- Group admins can remove members; the main/creator admin has final control over admin status.
- Main admin can promote another member to admin and remove admin status later.
- Admins can delete a group; the server validates permissions.
- Group details member rows use animated action menus and confirmation effects.
- Admin labels distinguish Main admin and Admin.
- Mobile/touch-friendly floating menus with no list clipping.
- Cache-busted CSS/JS URLs (`?v=50`) to prevent stale browser assets after deployment.
- Existing login, persistent MongoDB, 24-hour message retention, push notifications, presence, message editing/unsending, and other prior features remain included.

## Render

Deploy the ZIP as the current service source. Keep the existing `MONGODB_URI`, database, and push/VAPID environment variables.


## v51 updates
- Mobile/laptop group-management polish, outside-click popup dismissal, responsive group edit control, accurate status styling, server-backed unread counts across tabs/reloads, group read tracking, sessionStorage tab isolation, 30-minute inactivity expiry, and message double-click selection protection.
