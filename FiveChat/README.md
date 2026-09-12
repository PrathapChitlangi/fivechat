FiveChat v6 — persistent online/offline members and room selection

New:
- Members are kept in MongoDB after leaving/disconnecting.
- Members show Online or Offline instead of disappearing.
- Existing Room / Create New Room choice.
- Existing rooms can be refreshed and selected from a list.
- Last name and room are remembered in the browser.
- Leave returns to the room selection screen.
- 20-member limit, replies, delete, notifications, MongoDB message retention remain.
FiveChat v5 — message/reply/delete fix

# FiveChat Improved
Features: no login, max 5 members, online status, typing indicator, browser notifications while page is in background, improved animations/CSS, PWA manifest, persistent MongoDB storage.

Render:
Root Directory: FiveChat (if this folder is inside your repo)
Build: npm install
Start: npm start

IMPORTANT: For reliable persistence across Render restarts/redeploys, create MongoDB Atlas and add Render environment variable MONGODB_URI. Optional MONGODB_DB=fivechat. Do not put the URI in GitHub. Messages are automatically expired after 24 hours. For "at least 24 hours" retention, change TTL in server.js to a longer period (48h or 7d).

Browser notifications require the user to click Enable notifications and allow permission. This version notifies when the chat page is in the background; true notifications after the browser is fully closed require Web Push/VAPID setup.

## v4 additions
- Member limit increased from 5 to 20.
- WhatsApp-style reply-to-message: tap/click ↩ on any message, type a reply, and the reply shows the original sender/text.
- Reply metadata is stored with the message in MongoDB.
