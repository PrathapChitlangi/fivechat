# FiveChat v63

## UI and account updates
- Removed the permanent Chat requests panel from the People sidebar. Requests now use an icon-only button with a badge; the request list opens only when the icon is clicked.
- Online members remain in their own section.
- Redesigned Settings & Privacy with animated premium cards, profile/privacy/notification/account sections, and cleaner controls. The Theme setting was removed from the visible settings UI.
- New-tab login isolation: the authenticated session is stored in `sessionStorage`, so opening a new browser tab does not automatically sign into the existing account. Reloading the same tab keeps its session.
- Added per-user nicknames. Open a direct chat, open the user info menu, choose **Set nickname**, and enter or clear a nickname. Nicknames are private to the account that creates them.
- Added a short settings cache to reduce repeated MongoDB settings reads and improve login/People refresh responsiveness.

## Deployment
Use the same environment variables as v62, including `MONGODB_URI`. The new `nicknames` collection and index are created automatically at startup.

## Validation
`server.js` and `public/app.js` pass Node syntax checks.
