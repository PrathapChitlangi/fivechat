const socket = io();
const joinScreen = document.getElementById("joinScreen");
const chatScreen = document.getElementById("chatScreen");
const nameInput = document.getElementById("name");
const roomInput = document.getElementById("room");
const errorEl = document.getElementById("error");
const messages = document.getElementById("messages");
const members = document.getElementById("members");
const count = document.getElementById("count");
const messageInput = document.getElementById("message");
let myName = "";

function renderMessage(m) {
  const div = document.createElement("div");
  div.className = "bubble" + (m.name === myName ? " me" : "");
  const safeName = document.createElement("div");
  safeName.className = "who";
  safeName.textContent = m.name;
  const text = document.createElement("div");
  text.textContent = m.text;
  const time = document.createElement("div");
  time.className = "time";
  time.textContent = new Date(m.time).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
  div.append(safeName, text, time);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function renderMembers(list) {
  members.innerHTML = "";
  list.forEach(name => {
    const li = document.createElement("li");
    li.textContent = name + (name === myName ? " (you)" : "");
    members.appendChild(li);
  });
  count.textContent = `(${list.length}/5)`;
}

document.getElementById("joinBtn").onclick = () => {
  errorEl.textContent = "";
  myName = nameInput.value.trim();
  const roomName = roomInput.value.trim();
  if (!myName || !roomName) {
    errorEl.textContent = "Please enter your name and a room name.";
    return;
  }
  socket.emit("joinRoom", {roomName, userName:myName});
};

socket.on("joinError", msg => errorEl.textContent = msg);

socket.on("joined", data => {
  joinScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  document.getElementById("roomTitle").textContent = data.roomName;
  messages.innerHTML = "";
  data.messages.forEach(renderMessage);
  renderMembers(data.users);
  messageInput.focus();
});

socket.on("members", renderMembers);
socket.on("message", renderMessage);

document.getElementById("form").onsubmit = e => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit("sendMessage", text);
  messageInput.value = "";
};

document.getElementById("leaveBtn").onclick = () => location.reload();
