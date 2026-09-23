# FiveChat v64

UI/presence/performance update based on v63.

### Changes
- Removed the Settings & Privacy item from the profile dropdown and removed the unused settings modal UI.
- Removed the old request icon under the people search box.
- Online Members now shows accepted/connected members only; pending requests are kept out of the member list.
- Added a New Requests panel below Groups. It is collapsed by default and opens with the request icon. It shows incoming requests and sent/pending requests with animated actions.
- Fixed presence state so a hidden/background tab cannot be revived by the heartbeat loop. Presence is now explicitly cleared on hidden/blur/pagehide and restored on visible/focus.
- Kept last-seen display for offline accepted connections.
- Reduced login latency by parallelizing the login bootstrap and avoiding the legacy message-scan connection lookup when the connections collection exists.
- Added a visible login connecting spinner while the server/session bootstrap is in progress.
- Improved sidebar text contrast so names/statuses remain readable on the dark UI.
- Nickname support from v63 remains included.
- Voice recording remains disabled.

### Deployment
Use the same environment variables as v63/v62, including `MONGODB_URI`, `MONGODB_DB`, and any configured VAPID/admin variables.

This package was syntax-checked locally. Live Render/MongoDB end-to-end testing still requires deployment with your real environment variables.
