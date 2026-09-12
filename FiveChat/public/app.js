const s=io(),$=id=>document.getElementById(id);
let me="",room="",timer,replyTo=null,mode="existing";

function notify(){
  if("Notification"in window)Notification.requestPermission().then(p=>{
    $("notifyBtn").textContent=p==="granted"?"🔔 Notifications enabled":"🔕 Notifications blocked";
    $("notifyChatBtn").textContent=p==="granted"?"🔔":"🔕";
  });
}
$("notifyBtn").onclick=notify;$("notifyChatBtn").onclick=notify;

function setMode(next){
  mode=next;
  $("existingBtn").classList.toggle("selected",mode==="existing");
  $("createBtn").classList.toggle("selected",mode==="create");
  $("roomLabel").textContent=mode==="existing"?"Existing room":"New room";
  $("room").placeholder=mode==="existing"?"Choose or type an existing room":"Create a new room";
  $("roomHelp").textContent=mode==="existing"?"Select a room that someone already created, or type its exact name.":"Create a new room for your friends to join.";
  $("joinBtn").textContent=mode==="existing"?"Join Room →":"Create Room →";
}
$("existingBtn").onclick=()=>setMode("existing");
$("createBtn").onclick=()=>setMode("create");

function refreshRooms(){
  s.emit("listRooms");
}
s.on("rooms",rooms=>{
  const dl=$("roomOptions");dl.innerHTML="";
  rooms.forEach(r=>{const o=document.createElement("option");o.value=r;dl.appendChild(o)});
  const last=localStorage.getItem("fivechat_room");
  $("continueBtn").classList.toggle("hidden",!last);
  if(last)$("continueBtn").textContent=`↩ Continue in ${last}`;
});
$("refreshRooms").onclick=refreshRooms;

$("continueBtn").onclick=()=>{
  const last=localStorage.getItem("fivechat_room");
  if(!last)return;
  $("room").value=last;setMode("existing");join();
};

function setReply(m){
  replyTo={id:m.id,name:m.name,text:m.text};
  $("replyName").textContent=m.name;$("replyPreview").textContent=m.text.length>90?m.text.slice(0,90)+"…":m.text;
  $("replyBar").classList.remove("hidden");$("message").focus();
}
function cancelReply(){replyTo=null;$("replyBar").classList.add("hidden")}
$("cancelReply").onclick=cancelReply;

function show(m){
  $("empty")?.remove();
  const d=document.createElement("div");d.className="bubble"+(m.name===me?" me":"");d.dataset.id=m.id;
  const w=document.createElement("div");w.className="who";w.textContent=m.name;d.append(w);
  if(m.replyTo&&m.replyTo.text){
    const q=document.createElement("div");q.className="quoted";
    const qn=document.createElement("b");qn.textContent=m.replyTo.name;
    const qt=document.createElement("span");qt.textContent=m.replyTo.text;q.append(qn,qt);d.append(q);
  }
  const t=document.createElement("div");t.textContent=m.text;
  const tm=document.createElement("div");tm.className="time";tm.textContent=new Date(m.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});d.append(t,tm);
  const actions=document.createElement("div");actions.className="bubble-actions";
  const rep=document.createElement("button");rep.className="reply-btn";rep.title="Reply";rep.textContent="↩";rep.onclick=()=>setReply(m);actions.append(rep);
  if(m.name===me){const del=document.createElement("button");del.className="delete-btn";del.title="Delete message";del.textContent="🗑";del.onclick=()=>{if(confirm("Delete this message?"))s.emit("deleteMessage",m.id)};actions.append(del)}
  d.append(actions);$("messages").insertBefore(d,$("typing"));$("messages").scrollTop=$("messages").scrollHeight;
}

function people(a){
  $("members").innerHTML="";
  a.sort((x,y)=>Number(y.online)-Number(x.online)||x.name.localeCompare(y.name)).forEach(u=>{
    const li=document.createElement("li"),dot=document.createElement("span");dot.className="dot "+(u.online?"online":"offline");
    const text=document.createElement("span");text.textContent=u.name+(u.name===me?" (you)":"");
    const status=document.createElement("small");status.className="member-status";status.textContent=u.online?"Online":"Offline";
    li.append(dot,text,status);$("members").append(li);
  });
  const online=a.filter(x=>x.online).length;
  $("count").textContent=`(${online} online / ${a.length} members)`;
}

function join(){
  me=$("name").value.trim();room=$("room").value.trim();$("error").textContent="";
  if(!me||!room){$("error").textContent="Enter your name and room name.";return}
  localStorage.setItem("fivechat_name",me);
  s.emit("joinRoom",{roomName:room,userName:me,mode});
}
$("joinBtn").onclick=join;
$("name").onkeydown=$("room").onkeydown=e=>{if(e.key==="Enter")join()};
s.on("joinError",m=>$("error").textContent=m);

s.on("joined",d=>{
  localStorage.setItem("fivechat_room",d.roomName);
  $("joinScreen").classList.add("hidden");$("chatScreen").classList.remove("hidden");
  $("roomTitle").textContent=d.roomName;
  $("messages").innerHTML='<div id="empty" class="empty">Say hello 👋</div><div id="typing"></div>';
  d.messages.forEach(show);people(d.users);$("message").focus();
});

s.on("members",people);
s.on("message",m=>{
  show(m);
  if(m.name!==me&&"Notification"in window&&Notification.permission==="granted"&&document.visibilityState!=="visible")
    new Notification(`${m.name} • FiveChat`,{body:m.text,tag:m.id});
});
s.on("messageDeleted",id=>document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove());
s.on("sendError",m=>alert(m));
s.on("typing",n=>$("typing").textContent=`${n} is typing…`);
s.on("stopTyping",()=>$("typing").textContent="");

$("form").onsubmit=e=>{
  e.preventDefault();const text=$("message").value.trim();
  if(text){s.emit("sendMessage",{text,replyTo});$("message").value="";cancelReply();s.emit("stopTyping")}
};
$("message").oninput=()=>{
  s.emit("typing");clearTimeout(timer);timer=setTimeout(()=>s.emit("stopTyping"),900);
};

$("leaveBtn").onclick=()=>{
  s.emit("leaveRoom");
  $("chatScreen").classList.add("hidden");$("joinScreen").classList.remove("hidden");
  $("error").textContent="You are offline. Your member profile stays in the room.";
  $("room").value=localStorage.getItem("fivechat_room")||room;
  setMode("existing");refreshRooms();$("name").focus();
};

$("name").value=localStorage.getItem("fivechat_name")||"";
setMode("existing");refreshRooms();
