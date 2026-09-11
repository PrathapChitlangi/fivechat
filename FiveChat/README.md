# FiveChat — no-login group chat

A small real-time web chat for **up to 5 people**, with:
- No accounts or login.
- Users choose their own display name.
- No invitation links required: everyone enters the same room name.
- Real-time messages using Socket.IO.
- Messages retained for 24 hours while the server is running.
- Room limit of 5 connected members.
- Responsive desktop/mobile UI.

## Run

1. Install Node.js 18+.
2. Open this folder in a terminal.
3. Run:
   `npm install`
4. Start:
   `npm start`
5. Open:
   `http://localhost:3000`

## Use from multiple computers

For people on the same Wi-Fi/LAN, run the server on one computer and open that computer's LAN IP, for example:
`http://192.168.1.20:3000`

Everyone enters the same room name, but their own name.

## Hosting for internet use

Deploy this Node.js app on a Node-compatible hosting service. For durable 24-hour+ message storage across restarts, replace the in-memory `rooms` map with SQLite/PostgreSQL/another database.

## Important privacy note

This version has no authentication, so anyone who knows a room name can enter it. Use an unpredictable room name if the chat should not be easy to discover.
