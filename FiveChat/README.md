# FiveChat v34

Responsive private messenger with persistent accounts/messages, live presence, direct and group chats, fast admin member management, group info/admin controls, group activity events, multi-user typing indicators, attachments, edit/unsend interactions, and a polished Instagram-inspired composer.

### v34 updates
- Signup PIN field now shows only the PIN icon/input; the “Create PIN” side label is removed.
- Unsend now informs the receiver with an in-chat notice when the receiver has the conversation open, or a compact toast when another chat is open.
- Unsent messages remain non-interactive and never expose Edit/Unsend actions.
- Composer rebuilt with stable vertical text geometry, no drifting placeholder/label, a clean SVG paper-plane send icon, and responsive Instagram-inspired pill styling.
- Group options are contained inside the People sidebar so menus never cross the mobile slider or laptop sidebar.
- Group rename is available from the group-info header through a pencil icon; the previous Edit-name action button is removed.
- Existing-group member additions use Socket.IO acknowledgements and update the group immediately without waiting for a timer.
- Removing a member uses an animated confirmation dialog and then updates the group immediately.
- Offline last-seen display refreshes every 4 seconds without showing a live seconds counter.
- Existing group activity events continue to show member additions/removals/leaves and name changes in the chat.

Set `MONGODB_URI` on deployment for persistent database storage. Without MongoDB, the server uses in-memory fallback storage.
