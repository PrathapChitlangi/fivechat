const s=io(),$=id=>document.getElementById(id);
let pushRegistration=null;
function urlBase64ToUint8Array(v){const padding="=".repeat((4-v.length%4)%4),b=(v+padding).replace(/-/g,"+").replace(/_/g,"/"),r=atob(b);return Uint8Array.from([...r].map(c=>c.charCodeAt(0)))}
async function enablePushForRoom(){
  if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window))return;
  try{
    pushRegistration=await navigator.serviceWorker.register("/sw.js");
    if(Notification.permission!=="granted")return;
    const key=await fetch("/push-public-key").then(r=>r.text()); if(!key)return;
    let sub=await pushRegistration.pushManager.getSubscription();
    if(!sub)sub=await pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key)});
    s.emit("pushSubscribe",{roomName:room,userName:me,subscription:sub.toJSON()});
  }catch(e){console.warn("Push notifications unavailable",e)}
}
let me="",room="",timer,replyTo=null,mode="existing";

function notify(){
  if("Notification"in window)Notification.requestPermission().then(p=>{
    $("notifyBtn").textContent=p==="granted"?"🔔 Notifications enabled":"🔕 Notifications blocked";
    $("notifyChatBtn").textContent=p==="granted"?"🔔":"🔕";
    if(p==="granted")enablePushForRoom();
  });
}
$("notifyBtn").onclick=notify;$("notifyChatBtn").onclick=notify;

function setMode(next){
  mode=next;
  $("createBtn").textContent=mode==="create"?"← Back to Existing Room":"+ Create New Room";
  $("roomLabel").textContent=mode==="existing"?"Room ID":"New room name";
  $("room").placeholder=mode==="existing"?"Enter room ID (e.g. 112233)":"Choose a name for your new room";
  $("roomHelp").innerHTML=mode==="existing"?'Enter an existing room ID like <b>112233</b>, or tap "Create New Room" below to start your own.':"Create a new room for your friends to join.";
  $("joinBtn").textContent=mode==="existing"?"Join Room →":"Create Room →";
  if(mode==="create"){$("room").value=""}
  else if(!$("room").value){$("room").value=localStorage.getItem("fivechat_room")||"112233"}
}
$("createBtn").onclick=()=>setMode(mode==="create"?"existing":"create");

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
  const t=document.createElement("div");t.className="text";t.textContent=m.text;
  const tm=document.createElement("div");tm.className="time";
  if(m.edited){const tag=document.createElement("span");tag.className="edited-tag";tag.textContent="(edited)";tm.append(tag)}
  tm.append(new Date(m.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
  d.append(t,tm);
  const actions=document.createElement("div");actions.className="bubble-actions";
  const rep=document.createElement("button");rep.className="reply-btn";rep.title="Reply";rep.textContent="↩";rep.onclick=(e)=>{e.stopPropagation();setReply(m)};actions.append(rep);
  if(m.name===me){
    const edit=document.createElement("button");edit.className="edit-btn";edit.title="Edit message";edit.textContent="✏️";edit.onclick=(e)=>{e.stopPropagation();startEdit(d,m)};actions.append(edit);
    const del=document.createElement("button");del.className="delete-btn";del.title="Delete message";del.textContent="🗑";del.onclick=(e)=>{e.stopPropagation();if(confirm("Delete this message?"))s.emit("deleteMessage",m.id)};actions.append(del);
  }
  d.append(actions);
  d.onclick=(e)=>{
    if(e.target.closest(".bubble-actions")||d.classList.contains("editing"))return;
    document.querySelectorAll(".bubble.show-actions").forEach(b=>{if(b!==d)b.classList.remove("show-actions")});
    d.classList.toggle("show-actions");
  };
  $("messages").insertBefore(d,$("typing"));$("messages").scrollTop=$("messages").scrollHeight;
}
document.addEventListener("click",e=>{
  if(!e.target.closest(".bubble"))document.querySelectorAll(".bubble.show-actions").forEach(b=>b.classList.remove("show-actions"));
});

function startEdit(d,m){
  const textEl=d.querySelector(".text");if(!textEl)return;
  const original=textEl.textContent;
  d.classList.add("editing","show-actions");
  const input=document.createElement("textarea");input.className="edit-input";input.value=original;
  const actionsRow=document.createElement("div");actionsRow.className="edit-actions";
  const saveBtn=document.createElement("button");saveBtn.type="button";saveBtn.textContent="Save";
  const cancelBtn=document.createElement("button");cancelBtn.type="button";cancelBtn.textContent="Cancel";
  actionsRow.append(saveBtn,cancelBtn);
  textEl.replaceWith(input);input.after(actionsRow);input.focus();input.select();
  function finish(newText){
    const t=document.createElement("div");t.className="text";t.textContent=newText;
    input.replaceWith(t);actionsRow.remove();d.classList.remove("editing");
  }
  input.onclick=e=>e.stopPropagation();
  input.onkeydown=e=>{
    e.stopPropagation();
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();saveBtn.click()}
    if(e.key==="Escape")cancelBtn.click();
  };
  cancelBtn.onclick=e=>{e.stopPropagation();finish(original)};
  saveBtn.onclick=e=>{
    e.stopPropagation();
    const val=input.value.trim();
    if(!val||val===original){finish(original);return}
    s.emit("editMessage",{id:m.id,text:val});
    m.text=val;finish(val);
    if(!d.querySelector(".edited-tag")){const tag=document.createElement("span");tag.className="edited-tag";tag.textContent="(edited)";d.querySelector(".time").prepend(tag)}
  };
}

function people(a){
  $("members").innerHTML="";$("membersModalList").innerHTML="";
  a.sort((x,y)=>Number(y.online)-Number(x.online)||x.name.localeCompare(y.name)).forEach(u=>{
    const li=document.createElement("li"),dot=document.createElement("span");dot.className="dot "+(u.online?"online":"offline");
    const text=document.createElement("span");text.textContent=u.name+(u.name===me?" (you)":"");
    const status=document.createElement("small");status.className="member-status";status.textContent=u.online?"Online":"Offline";
    li.append(dot,text,status);$("members").append(li);
    $("membersModalList").append(li.cloneNode(true));
  });
  const online=a.filter(x=>x.online).length;
  $("count").textContent=`(${online} online / ${a.length} members)`;
  $("countModal").textContent=`(${online} online / ${a.length} members)`;
}
$("membersBtn").onclick=()=>$("membersModal").classList.remove("hidden");
$("closeMembersModal").onclick=()=>$("membersModal").classList.add("hidden");
$("membersModal").onclick=e=>{if(e.target.id==="membersModal")$("membersModal").classList.add("hidden")};

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
  d.messages.forEach(show);people(d.users);$("message").focus();enablePushForRoom();
});

s.on("members",people);
s.on("message",m=>{
  show(m);
  if(m.name!==me&&"Notification"in window&&Notification.permission==="granted"&&document.visibilityState!=="visible")
    new Notification(`${m.name} • FiveChat`,{body:m.text,tag:m.id});
});
s.on("messageDeleted",id=>document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove());
s.on("messageEdited",m=>{
  const el=document.querySelector(`[data-id="${CSS.escape(m.id)}"]`);if(!el)return;
  const t=el.querySelector(".text");if(t)t.textContent=m.text;
  if(!el.querySelector(".edited-tag")){const tag=document.createElement("span");tag.className="edited-tag";tag.textContent="(edited)";el.querySelector(".time")?.prepend(tag)}
});
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
  $("error").textContent="You left the room. Join again anytime to rejoin as a member.";
  $("room").value=room;
  setMode("existing");refreshRooms();$("name").focus();
};

$("name").value=localStorage.getItem("fivechat_name")||"";
setMode("existing");refreshRooms();
