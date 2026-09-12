const s=io(),$=id=>document.getElementById(id);let me="",room="",timer,replyTo=null;

function notify(){
  if("Notification"in window)Notification.requestPermission().then(p=>{
    $("notifyBtn").textContent=p==="granted"?"🔔 Notifications enabled":"🔕 Notifications blocked";
    $("notifyChatBtn").textContent=p==="granted"?"🔔":"🔕"
  })
}
$("notifyBtn").onclick=notify;$("notifyChatBtn").onclick=notify;

function setReply(m){
  replyTo={id:m.id,name:m.name,text:m.text};
  $("replyName").textContent=m.name;
  $("replyPreview").textContent=m.text.length>90?m.text.slice(0,90)+"…":m.text;
  $("replyBar").classList.remove("hidden");
  $("message").focus();
}
function cancelReply(){replyTo=null;$("replyBar").classList.add("hidden")}
$("cancelReply").onclick=cancelReply;

function show(m){
  $("empty")?.remove();
  const d=document.createElement("div");
  d.className="bubble"+(m.name===me?" me":"");
  d.dataset.id=m.id;

  const w=document.createElement("div");w.className="who";w.textContent=m.name;
  d.append(w);

  if(m.replyTo && m.replyTo.text){
    const q=document.createElement("div");q.className="quoted";
    const qn=document.createElement("b");qn.textContent=m.replyTo.name;
    const qt=document.createElement("span");qt.textContent=m.replyTo.text;
    q.append(qn,qt);
    d.append(q);
  }

  const t=document.createElement("div");t.textContent=m.text;
  const tm=document.createElement("div");tm.className="time";
  tm.textContent=new Date(m.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  d.append(t,tm);

  const actions=document.createElement("div");actions.className="bubble-actions";
  const rep=document.createElement("button");rep.className="reply-btn";rep.title="Reply";rep.textContent="↩";
  rep.onclick=()=>setReply(m);actions.append(rep);

  if(m.name===me){
    const del=document.createElement("button");del.className="delete-btn";del.title="Delete message";del.textContent="🗑";
    del.onclick=()=>{if(confirm("Delete this message?"))s.emit("deleteMessage",m.id)};
    actions.append(del);
  }
  d.append(actions);
  $("messages").insertBefore(d,$("typing"));
  $("messages").scrollTop=$("messages").scrollHeight;
}

function people(a){
  $("members").innerHTML="";
  a.forEach(u=>{
    let li=document.createElement("li"),dot=document.createElement("span");
    dot.className="dot";
    li.append(dot,document.createTextNode(u.name+(u.name===me?" (you)":"")));
    $("members").append(li)
  });
  $("count").textContent=`(${a.length}/20)`
}

function join(){
  me=$("name").value.trim();room=$("room").value.trim();$("error").textContent="";
  if(!me||!room){$("error").textContent="Enter your name and room name.";return}
  s.emit("joinRoom",{roomName:room,userName:me})
}
$("joinBtn").onclick=join;
$("name").onkeydown=$("room").onkeydown=e=>{if(e.key==="Enter")join()};

s.on("joinError",m=>$("error").textContent=m);

s.on("joined",d=>{
  $("joinScreen").classList.add("hidden");
  $("chatScreen").classList.remove("hidden");
  $("roomTitle").textContent=d.roomName;
  $("messages").innerHTML='<div id="empty" class="empty">Say hello 👋</div><div id="typing"></div>';
  d.messages.forEach(show);people(d.users);$("message").focus()
});

s.on("members",people);

s.on("message",m=>{
  show(m);
  if(m.name!==me&&"Notification"in window&&Notification.permission==="granted"&&document.visibilityState!=="visible")
    new Notification(`${m.name} • FiveChat`,{body:m.text,tag:m.id})
});

s.on("messageDeleted",id=>document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove());
s.on("sendError",m=>alert(m));
s.on("typing",n=>$("typing").textContent=`${n} is typing…`);
s.on("stopTyping",()=>$("typing").textContent="");

$("form").onsubmit=e=>{
  e.preventDefault();
  const text=$("message").value.trim();
  if(text){
    s.emit("sendMessage",{text,replyTo});
    $("message").value="";
    cancelReply();
    s.emit("stopTyping")
  }
};

$("message").oninput=()=>{
  s.emit("typing");
  clearTimeout(timer);
  timer=setTimeout(()=>s.emit("stopTyping"),900)
};
$("leaveBtn").onclick=()=>location.reload();
