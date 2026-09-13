# FiveChat v11

Single shared chat space. Login requires only:
- Name
- Chat access code: `112233`

There is no Room ID or room password. Private one-to-one conversations are preserved by MongoDB when `MONGODB_URI` is configured; browser refresh/relogin restores the session locally.


### Persistence rules in this build
- Accounts are stored in MongoDB and do not expire after 24 hours.
- Login uses an HttpOnly persistent session cookie (up to 365 days, refreshed while active), so reload/reopen does not require entering the PIN again until logout/session expiry.
- Messages expire 24 hours after they are sent. MongoDB TTL cleanup is backed by server-side history filtering, so expired messages are not shown even before the database TTL monitor removes them.
- People list remains scrollable but its visible scrollbar is hidden.
- Login field labels collapse after text is entered.

- Visibility-based presence: switching away from the FiveChat tab immediately marks the user offline; returning to the tab marks them online again. A lightweight heartbeat keeps the status fresh.
