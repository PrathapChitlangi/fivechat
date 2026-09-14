const s = io();
const $ = id => document.getElementById(id);
let me = null, people = [], groups = [], selected = {type:null,id:null,name:null};
let authMode = 'login', typingTimer = null, pendingFiles = [], editingId = null, logoutInProgress = false, authRequestId = 0, longPressTimer = null;
const unread = JSON.parse(localStorage.getItem('fivechat_unread') || '{}');
const SESSION = 'fivechat_v24_session';
const typingUsers = new Map();

function saveUnread(){localStorage.setItem('fivechat_unread',JSON.stringify(unread));}
function saveSession(){ if(me) localStorage.setItem(SESSION, JSON.stringify({name:me.name,pin:window.__loginPin||''})); }
function loadSession(){ try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null} }
function escapeHtml(x){return String(x).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function timeSince(t){if(!t)return'Offline';const sec=Math.max(0,Math.floor((Date.now()-Number(t))/1000));if(sec<60)return'just now';const m=Math.floor(sec/60);if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`}
function senderHue(name){let h=0;for(const c of String(name||''))h=(h*31+c.charCodeAt(0))%360;return h}
function unreadKey(t,id){return `${t}:${String(id).toLowerCase()}`}
function unreadFor(t,id){return unread[unreadKey(t,id)]||0}
function bumpUnread(t,id){const k=unreadKey(t,id);unread[k]=(unread[k]||0)+1;saveUnread();renderPeople();renderGroups();showUnreadPulse(t,id)}
function clearUnread(t,id){delete unread[unreadKey(t,id)];saveUnread();renderPeople();renderGroups()}
function showUnreadPulse(t,id){const k=unreadKey(t,id);requestAnimationFrame(()=>{document.querySelectorAll(`[data-unread-key="${CSS.escape(k)}"]`).forEach(x=>{x.classList.remove('unreadPulse');void x.offsetWidth;x.classList.add('unreadPulse')})})}
function isChatVisible(){return document.visibilityState==='visible'&&document.hasFocus()}
let pushSubscription=null;
async function setupPushNotifications(){
  if(!me||!('serviceWorker' in navigator)||!('PushManager' in window)||!window.isSecureContext)return;
  try{
    const reg=await navigator.serviceWorker.register('/sw.js');
    if(Notification.permission==='default'){
      const permission=await Notification.requestPermission();
      if(permission!=='granted')return;
    }
    if(Notification.permission!=='granted')return;
    let sub=await reg.pushManager.getSubscription();
    if(!sub){
      const key=await fetch('/api/push/public-key').then(r=>r.ok?r.text():'');
      if(!key)return;
      sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key)});
    }
    pushSubscription=sub;
    s.emit('pushSubscribe',{subscription:sub.toJSON()});
    sendPushActivity();
  }catch(e){console.warn('Push setup unavailable',e)}
}
function urlBase64ToUint8Array(base64){const pad='='.repeat((4-base64.length%4)%4),raw=atob((base64+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
function sendPushActivity(){if(!pushSubscription||!me)return;const activeChat=selected.type==='direct'?{type:'direct',name:selected.name}:selected.type==='group'?{type:'group',id:selected.id}:null;s.emit('pushActivity',{endpoint:pushSubscription.endpoint,visible:document.visibilityState==='visible',activeChat})}


function showApp(){
  $('auth').classList.add('hidden'); $('app').classList.remove('hidden');
  const initial=me.name[0].toUpperCase();
  $('meName').textContent=me.name; $('meAvatar').textContent=initial; $('profileName').textContent=me.name; $('profileAvatar').textContent=initial;
  $('myStatus').textContent='Online'; $('profileStatus').textContent='Online'; closePeople();
}
function updateAuth(){
  const create=authMode==='create';
  $('createFields').classList.toggle('hidden',!create);
  $('authTitle').textContent=create?'Create your FiveChat account':'Log in to FiveChat';
  $('authText').textContent=create?'':'Use your account name and PIN to continue.';
  $('authBtn').innerHTML=create?'Sign up <span>→</span>':'Log in <span>→</span>';
  $('switchAuth').innerHTML=create?'Already have an account? <b>Log in</b>':'Don’t have an account? <b>Sign up</b>';
  $('authPin').previousElementSibling.textContent=create?'Create PIN':'PIN';
}
function auth(){
  const name=$('authName').value.trim(), pin=$('authPin').value.trim(), code=$('authCode').value.trim(), create=authMode==='create';
  $('authError').textContent='';
  if(!name||!/^[0-9]{4}$/.test(pin)) return $('authError').textContent='Enter your name and a valid 4-digit PIN.';
  if(create&&!code) return $('authError').textContent='Enter the access code.';
  logoutInProgress=false; window.__loginPin=pin; const request=++authRequestId;
  const emit=()=>{if(request!==authRequestId||logoutInProgress)return;s.emit(create?'createAccount':'login',{name,pin,accessCode:code})};
  if(!s.connected){s.once('connect',emit);s.connect()}else emit();
}
$('authBtn').onclick=auth;
$('switchAuth').onclick=()=>{authMode=authMode==='login'?'create':'login';$('authError').textContent='';updateAuth();$('authPin').value='';};
['authName','authPin','authCode'].forEach(id=>$(id).onkeydown=e=>{if(e.key==='Enter')auth()});
updateAuth();

s.on('accountCreated',d=>{authMode='login';updateAuth();$('authName').value=d.name;$('authPin').value='';$('authCode').value='';$('authError').innerHTML='<span class="successAlert">✓ Account created. Log in now.</span>';$('authPin').focus()});
s.on('authError',m=>{$('authError').textContent=m;$('authCard').classList.remove('shake');void $('authCard').offsetWidth;$('authCard').classList.add('shake')});
s.on('loggedIn',d=>{
  if(logoutInProgress)return;
  me=d.user; people=d.people||[]; groups=d.groups||[]; saveSession(); showApp(); renderPeople(); renderGroups(); welcome();
  s.emit('presence',{visible:true}); startHeartbeat(); setupPushNotifications();
});

function renderPeople(){
  if(!me)return;
  const q=$('search').value.toLowerCase();
  const arr=people.filter(p=>p.nameLower!==me.name.toLowerCase()&&p.name.toLowerCase().includes(q)).sort((a,b)=>Number(b.online)-Number(a.online)||a.name.localeCompare(b.name));
  $('peopleList').innerHTML='';
  arr.forEach(p=>{
    const li=document.createElement('li'); li.className='person '+(selected.type==='direct'&&selected.name===p.name?'selected':'');
    const count=unreadFor('direct',p.name), badge=count>99?'99+':count;
    const status=p.online?'Online':`Offline · ${timeSince(p.lastSeen)}`;
    li.innerHTML=`<span class="avatar personAvatar" style="--avatarHue:${senderHue(p.name)}">${escapeHtml(p.name[0].toUpperCase())}</span><span class="personText"><b>${escapeHtml(p.name)}</b><small>${status}</small></span><i class="dot ${p.online?'on':'off'}"></i>${count?`<b class="unread" data-unread-key="${escapeHtml(unreadKey('direct',p.name))}" aria-label="${count} unread messages">${badge}</b>`:''}`;
    li.onclick=()=>openDirect(p); $('peopleList').append(li);
  });
  $('onlineCount').textContent=arr.filter(p=>p.online).length+' online';
}
function renderGroups(){
  if(!me)return; $('groupList').innerHTML='';
  groups.forEach(g=>{
    const li=document.createElement('li'); li.className='person groupRow '+(selected.type==='group'&&selected.id===g.id?'selected':'');
    const count=unreadFor('group',g.id), badge=count>99?'99+':count;
    li.innerHTML=`<span class="avatar groupAvatar">👥</span><span class="personText"><b>${escapeHtml(g.name)}</b><small>${g.members.length} members</small></span>${count?`<b class="unread" data-unread-key="${escapeHtml(unreadKey('group',g.id))}" aria-label="${count} unread messages">${badge}</b>`:''}<button class="groupMore" type="button" aria-label="Group options">⋮</button>`;
    li.onclick=()=>openGroup(g);
    li.querySelector('.groupMore').onclick=e=>{e.stopPropagation();showGroupMenu(g,e.currentTarget)};
    $('groupList').append(li);
  });
}
function showGroupMenu(g,anchor){
  closeMoreMenus();
  const menu=document.createElement('div'); menu.className='groupMoreMenu floatingGroupMenu';
  menu.innerHTML=g.createdBy===me.name?'<button type="button" data-delete class="dangerOption"><span>⌫</span> Delete group</button>':'<div class="menuHint">Group options</div>';
  document.body.append(menu);
  const r=anchor.getBoundingClientRect(), mw=154, mh=52;
  let left=Math.min(r.right-mw,innerWidth-mw-10); left=Math.max(10,left);
  let top=r.top-mh-7; if(top<10)top=r.bottom+7; if(top+mh>innerHeight-10)top=Math.max(10,innerHeight-mh-10);
  menu.style.left=left+'px';menu.style.top=top+'px';
  const del=menu.querySelector('[data-delete]');
  if(del)del.onclick=e=>{e.stopPropagation();closeMoreMenus();openDeleteGroupConfirm(g)};
}
function closeMoreMenus(){document.querySelectorAll('.floatingGroupMenu').forEach(x=>x.remove())}

document.addEventListener('click',e=>{if(!e.target.closest('.groupMore')&&!e.target.closest('.floatingGroupMenu'))closeMoreMenus();if(!e.target.closest('.meProfile'))$('profileMenu').classList.add('hidden');if(!e.target.closest('#groupInfoPanel')&&!e.target.closest('#chatAvatar'))closeGroupInfo();if(!e.target.closest('#contextMenu')&&!e.target.closest('.msg'))hideContext()});
window.addEventListener('resize',closeMoreMenus);window.addEventListener('scroll',closeMoreMenus,true);

function welcome(){
  selected={type:null,id:null,name:null}; sendPushActivity(); stopAllTyping(); closeGroupInfo(); closeMoreMenus();
  $('chatHead').classList.add('homeHidden'); $('chatName').textContent=''; $('chatStatus').textContent=''; $('chatAvatar').textContent='?'; $('chatAvatar').disabled=true;
  $('messages').innerHTML='<div class="welcomeEmpty"><div class="welcomeIcon">✦</div><h2>Welcome to FiveChat</h2><p>Select a person or group from the People panel to start chatting.</p></div>';
  $('composer').classList.add('hidden'); $('closeChat').classList.add('hidden');
}
function enableComposer(){ $('composer').classList.remove('hidden'); $('message').disabled=false;$('send').disabled=false;$('attachBtn').disabled=false;$('emojiBtn').disabled=false;$('closeChat').classList.remove('hidden'); }
function openDirect(p){
  hideContext();stopAllTyping(); selected={type:'direct',name:p.name}; closeGroupInfo(); clearUnread('direct',p.name); sendPushActivity(); $('chatHead').classList.remove('homeHidden');
  $('chatName').textContent=p.name;$('chatAvatar').textContent=p.name[0].toUpperCase();$('chatAvatar').disabled=true;setDirectStatus(p);
  enableComposer(); $('messages').innerHTML='<div class="loading">Loading…</div>'; closePeople(); s.emit('openDirect',{with:p.name});
}
function setDirectStatus(p){$('chatStatus').textContent=p.online?'● Online':`○ Offline · ${timeSince(p.lastSeen)}`}
function getGroup(id){return groups.find(g=>g.id===id)}
function openGroup(g){
  hideContext();stopAllTyping(); selected={type:'group',id:g.id,name:g.name}; clearUnread('group',g.id); closeGroupInfo(); sendPushActivity(); $('chatHead').classList.remove('homeHidden');
  $('chatName').textContent=g.name;$('chatAvatar').textContent='👥';$('chatAvatar').disabled=false;$('chatStatus').textContent=`${g.members.length} members`;
  enableComposer(); $('messages').innerHTML='<div class="loading">Loading…</div>'; closePeople(); s.emit('openGroup',{id:g.id});
}
function closeChat(){stopAllTyping();pendingFiles=[];renderAttachments();$('message').value='';resizeComposer();welcome()}
function closePeople(){$('peoplePanel').classList.add('closed');document.body.classList.remove('menuOpen')}
function openPeople(){closeGroupInfo();closeMoreMenus();$('peoplePanel').classList.remove('closed');document.body.classList.add('menuOpen')}

function renderMessages(arr){
  $('messages').innerHTML='';
  if(!arr.length){$('messages').innerHTML='<div class="empty"><div>✦</div><h3>No messages yet</h3><p>Start the conversation.</p></div>';return}
  arr.forEach(addMessage);scroll();
}
function attachmentHtml(a){if(a.type?.startsWith('image/'))return `<div class="attachment imageAttachment"><img src="${a.data}" alt="${escapeHtml(a.name)}"><span>${escapeHtml(a.name)}</span></div>`;return `<a class="attachment fileAttachment" href="${a.data}" download="${escapeHtml(a.name)}"><span>📄</span><span><b>${escapeHtml(a.name)}</b><small>${Math.ceil(a.size/1024)} KB</small></span></a>`}
function addMessage(m){
  const empty=$('messages').querySelector('.empty,.welcomeEmpty'); if(empty)empty.remove();
  if(m.system){const d=document.createElement('div');d.className='systemMessage';d.dataset.id=m.id;d.innerHTML=`<span class="systemDot">✦</span><span>${escapeHtml(m.text)}</span>`;$('messages').append(d);return;}
  const mine=m.from===me.name,d=document.createElement('div');
  d.className=`msg ${mine?'mine':'theirs'}${selected.type==='group'?' groupMsg':''}${m.unsent?' unsentMsg':''}`;
  d.dataset.id=m.id;d.dataset.unsent=m.unsent?'1':'0';d.style.setProperty('--senderHue',senderHue(m.from));
  const sender=selected.type==='group'?`<strong class="sender">${escapeHtml(m.from)}</strong>`:'';
  const text=m.text?`<div class="bubble">${escapeHtml(m.text)}</div>`:''; const at=(m.attachments||[]).map(attachmentHtml).join('');
  const tick=mine&&!m.unsent?`<span class="messageTicks ${m.status==='seen'?'seen':''}" title="${m.status||'sent'}">${m.status==='sent'?'✓':'✓✓'}</span>`:'';
  if(m.unsent){d.innerHTML=`${sender}<div class="messageContent"><div class="bubble unsent">Message unsent</div></div><small>${m.time?new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}</small>`;d.style.cursor='default';$('messages').append(d);return}
  d.innerHTML=`${sender}<div class="messageContent">${text}${at}</div><small>${new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}${m.edited?' · edited':''}${tick}</small>`;
  if(mine)attachMessageInteractions(d,m);$('messages').append(d);
}
function refreshMessage(id,fn){const el=[...$('messages').children].find(x=>x.dataset.id===id);if(el)fn(el)}
function addSystemNotice(text){const d=document.createElement('div');d.className='unsentNotice';d.textContent=text;$('messages').append(d);scroll();setTimeout(()=>d.classList.add('show'),10)}
function showToast(text){let t=document.querySelector('.appToast');if(!t){t=document.createElement('div');t.className='appToast';document.body.append(t)}t.textContent=text;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),2600)}
function positionContext(x,y){const menu=$('contextMenu'),w=145,h=84;menu.style.left=Math.max(8,Math.min(x,innerWidth-w-8))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-h-8))+'px';menu.classList.remove('hidden')}
function showContext(e,m){if(m.from!==me.name||m.unsent)return;e?.preventDefault?.();e?.stopPropagation?.();positionContext(e.clientX,e.clientY);const menu=$('contextMenu');menu.dataset.id=m.id;menu.dataset.text=m.text||''}
function attachMessageInteractions(el,m){
  let touchActive=false;el.addEventListener('dblclick',e=>{if(!touchActive&&innerWidth>760)showContext(e,m);touchActive=false});
  el.addEventListener('touchstart',e=>{touchActive=true;if(m.unsent)return;clearTimeout(longPressTimer);const t=e.touches[0];longPressTimer=setTimeout(()=>{showContext({clientX:t.clientX,clientY:t.clientY,preventDefault:()=>{},stopPropagation:()=>{}},m)},560)},{passive:true});
  el.addEventListener('touchend',()=>{clearTimeout(longPressTimer);setTimeout(()=>touchActive=false,80)},{passive:true});el.addEventListener('touchmove',()=>clearTimeout(longPressTimer),{passive:true});el.addEventListener('contextmenu',e=>e.preventDefault());
}
function hideContext(){clearTimeout(longPressTimer);$('contextMenu').classList.add('hidden')}
$('contextMenu').onclick=e=>{const action=e.target.closest('[data-action]')?.dataset.action,id=$('contextMenu').dataset.id;if(!action||!id)return;const el=[...$('messages').children].find(x=>x.dataset.id===id);if(el?.dataset.unsent==='1'){hideContext();return}if(action==='edit'){editingId=id;$('message').value=el?.querySelector('.bubble')?.textContent||$('contextMenu').dataset.text;resizeComposer();$('message').focus()}else if(action==='unsend'){s.emit('unsendMessage',{id});}hideContext()};
function resizeComposer(){const el=$('message');if(!el)return;const min=innerWidth<=390?44:innerWidth<=760?48:54;const fieldMin=innerWidth<=390?46:innerWidth<=760?50:56;el.style.height='auto';const next=Math.min(Math.max(el.scrollHeight,min),116);el.style.height=next+'px';$('messageField').style.height=Math.max(fieldMin,Math.min(next+2,122))+'px'}
function scroll(){ $('messages').scrollTop=$('messages').scrollHeight }

$('composer').onsubmit=async e=>{e.preventDefault();if(!selected.type)return;const text=$('message').value.trim();if(!text&&!pendingFiles.length)return;const attachments=await Promise.all(pendingFiles.map(fileToData));stopTypingForCurrent();if(editingId){s.emit('editMessage',{id:editingId,text});editingId=null}else if(selected.type==='direct')s.emit('sendDirect',{to:selected.name,text,attachments});else s.emit('sendGroup',{groupId:selected.id,text,attachments});$('message').value='';pendingFiles=[];renderAttachments();resizeComposer();$('message').focus()};
$('message').oninput=()=>{resizeComposer();if(!$('message').value.trim()){stopTypingForCurrent();return}announceTyping()};
$('message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('composer').requestSubmit();return}if(e.key==='Enter'&&e.shiftKey){requestAnimationFrame(resizeComposer);return}announceTyping()};
$('message').onfocus=()=>{if(selected.type)announceTyping()};$('message').onblur=()=>{setTimeout(()=>{if(document.activeElement!==$('message'))stopTypingForCurrent()},0)};
function announceTyping(){if(!selected.type||$('message').disabled||!me)return;stopTypingForCurrent(false);if(selected.type==='direct')s.emit('typing',{to:selected.name});else s.emit('groupTyping',{groupId:selected.id});clearTimeout(typingTimer);typingTimer=setTimeout(stopTypingForCurrent,1200)}
function stopTypingForCurrent(clear=true){clearTimeout(typingTimer);if(!selected.type||!me)return;if(selected.type==='direct')s.emit('stopTyping',{to:selected.name});else s.emit('groupStopTyping',{groupId:selected.id});if(clear){$('typing').innerHTML='';typingUsers.clear()}}
function stopAllTyping(){clearTimeout(typingTimer);if(me&&selected.type)stopTypingForCurrent();typingUsers.clear();$('typing').innerHTML=''}

$('attachBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=e=>{const max=5*1024*1024,files=[...e.target.files],accepted=files.filter(f=>f.size<=max);pendingFiles=[...pendingFiles,...accepted].slice(0,6);if(accepted.length<files.length)showToast('Each attachment must be 5 MB or smaller.');renderAttachments();e.target.value=''};
function renderAttachments(){$('attachmentPreview').innerHTML=pendingFiles.map((f,i)=>`<span class="previewItem">${f.type.startsWith('image/')?'🖼️':'📄'} ${escapeHtml(f.name)} <button type="button" data-i="${i}">×</button></span>`).join('');$('attachmentPreview').querySelectorAll('button').forEach(b=>b.onclick=()=>{pendingFiles.splice(+b.dataset.i,1);renderAttachments()})}
function fileToData(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res({name:f.name,type:f.type,size:f.size,data:r.result});r.onerror=rej;r.readAsDataURL(f)})}

$('closeChat').onclick=closeChat;$('chatAvatar').onclick=()=>{if(selected.type==='group')toggleGroupInfo()};$('emojiBtn').onclick=()=>{if($('message').disabled)return;$('message').setRangeText('😊',$('message').selectionStart,$('message').selectionEnd,'end');$('message').focus();resizeComposer();announceTyping()};
$('mobilePeople').onclick=openPeople;document.querySelector('.chatArea')?.addEventListener('click',e=>{if(window.innerWidth<=760&&document.body.classList.contains('menuOpen')&&!e.target.closest('#peoplePanel'))closePeople()});$('peopleClose').onclick=e=>{e.preventDefault();e.stopPropagation();closePeople()};$('search').oninput=renderPeople;
$('newGroup').onclick=()=>{buildGroupMembers();$('groupName').value='';$('groupModal').classList.remove('hidden')};$('closeGroup').onclick=()=>$('groupModal').classList.add('hidden');
$('createGroup').onclick=()=>{const name=$('groupName').value.trim(),members=[...$('groupMembers').querySelectorAll('input:checked')].map(x=>x.value);if(!name||!members.length)return;s.emit('createGroup',{name,members});$('groupName').value='';$('groupModal').classList.add('hidden')};
function buildGroupMembers(){ $('groupMembers').innerHTML='';people.filter(p=>p.name!==me.name).forEach(p=>{const l=document.createElement('label');l.className='memberChoice';l.innerHTML=`<input type="checkbox" value="${escapeHtml(p.name)}"><span class="choiceAvatar" style="--choiceHue:${senderHue(p.name)}">${escapeHtml(p.name[0].toUpperCase())}</span><span class="choiceText"><b>${escapeHtml(p.name)}</b><small>${p.online?'Online':'Offline · '+timeSince(p.lastSeen)}</small></span><span class="choiceCheck">✓</span>`;$('groupMembers').append(l)}) }

function toggleGroupInfo(){if(selected.type!=='group')return;const g=getGroup(selected.id);if(!g)return;renderGroupInfo(g);$('groupInfoPanel').classList.toggle('hidden')}
function closeGroupInfo(){$('groupInfoPanel').classList.add('hidden')}
function openRenameGroup(g){
  $('renameGroupInput').value=g.name;$('renameCharCounter').textContent=`${g.name.length}/50`;$('renameGroupModal').classList.remove('hidden');requestAnimationFrame(()=>{$('renameGroupModal').classList.add('modalVisible');setTimeout(()=>{$('renameGroupInput').focus();$('renameGroupInput').select()},80)});
}
function closeRenameGroup(){ $('renameGroupModal').classList.remove('modalVisible');setTimeout(()=>$('renameGroupModal').classList.add('hidden'),170) }
function renderGroupInfo(g){
  const admin=g.createdBy===me.name;
  const memberRows=g.members.map(name=>{const p=people.find(x=>x.nameLower===name.toLowerCase())||{name,online:false,lastSeen:0};const status=p.online?'Online':`Offline · ${timeSince(p.lastSeen)}`;return `<div class="infoMember"><span class="avatar miniAvatar" style="--avatarHue:${senderHue(name)}">${escapeHtml(name[0].toUpperCase())}</span><span class="infoMemberText"><b>${escapeHtml(name)} ${name===g.createdBy?'<em>Admin</em>':''}</b><small class="${p.online?'onlineText':'offlineText'}">${status}</small></span>${admin&&name!==g.createdBy?`<button class="removeMember" data-remove-member="${escapeHtml(name)}" title="Remove ${escapeHtml(name)}">×</button>`:''}</div>`}).join('');
  $('groupInfoPanel').innerHTML=`<div class="infoHeader"><div><span class="overline">GROUP INFO</span><div class="groupInfoTitleRow"><h3>${escapeHtml(g.name)}</h3>${admin?'<button class="groupEditPencil" type="button" aria-label="Edit group name" title="Edit group name"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25Zm15.71-9.04c.38-.38.38-1 0-1.38l-2.54-2.54a.975.975 0 0 0-1.38 0l-1.36 1.36 2.75 2.75 1.53-1.19Z"/></svg></button>':''}</div><small>${g.members.length} members</small></div><button class="infoClose" type="button">×</button></div><div class="infoMembers">${memberRows}</div><div class="groupInfoActions">${admin?'<button class="addMemberBtn" type="button">＋ Add people</button>':'<div class="memberNote">Only the group admin can add or remove people.</div><button class="leaveGroupBtn" type="button">Leave group</button>'}</div>`;
  $('groupInfoPanel').querySelector('.infoClose').onclick=e=>{e.stopPropagation();closeGroupInfo()};
  const add=$('groupInfoPanel').querySelector('.addMemberBtn');if(add)add.onclick=e=>{e.stopPropagation();buildAddMembers(g);$('memberModal').classList.remove('hidden')};
  const edit=$('groupInfoPanel').querySelector('.groupEditPencil');if(edit)edit.onclick=e=>{e.stopPropagation();openRenameGroup(g)};
  const leave=$('groupInfoPanel').querySelector('.leaveGroupBtn');if(leave)leave.onclick=e=>{e.stopPropagation();openLeaveConfirm(g)};
  $('groupInfoPanel').querySelectorAll('[data-remove-member]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();openRemoveMemberConfirm(g,btn.dataset.removeMember)});
}
function buildAddMembers(g){const existing=new Set(g.membersLower||g.members.map(x=>x.toLowerCase()));$('addMembersList').innerHTML='';people.filter(p=>p.nameLower!==me.name.toLowerCase()&&!existing.has(p.nameLower)).forEach(p=>{const l=document.createElement('label');l.className='memberChoice';l.innerHTML=`<input type="checkbox" value="${escapeHtml(p.name)}"><span class="choiceAvatar" style="--choiceHue:${senderHue(p.name)}">${escapeHtml(p.name[0].toUpperCase())}</span><span class="choiceText"><b>${escapeHtml(p.name)}</b><small>${p.online?'Online':'Offline · '+timeSince(p.lastSeen)}</small></span><span class="choiceCheck">✓</span>`;$('addMembersList').append(l)});if(!$('addMembersList').children.length)$('addMembersList').innerHTML='<div class="noPeopleToAdd">Everyone is already in this group.</div>'}
let pendingRemoveMember=null;
function openRemoveMemberConfirm(g,name){pendingRemoveMember={groupId:g.id,name};$('removeMemberText').textContent=`Remove ${name} from ${g.name}? This action will be shared with the group.`;$('removeMemberConfirm').classList.remove('hidden');requestAnimationFrame(()=>$('removeMemberConfirm').classList.add('modalVisible'))}
function closeRemoveConfirm(){$('removeMemberConfirm').classList.remove('modalVisible');setTimeout(()=>{$('removeMemberConfirm').classList.add('hidden');pendingRemoveMember=null},170)}
function openLeaveConfirm(g){$('leaveGroupText').textContent=`Leave ${g.name}? You will no longer receive messages from this group.`;$('leaveGroupConfirm').classList.remove('hidden');requestAnimationFrame(()=>$('leaveGroupConfirm').classList.add('modalVisible'))}
function closeLeaveConfirm(){$('leaveGroupConfirm').classList.remove('modalVisible');setTimeout(()=>$('leaveGroupConfirm').classList.add('hidden'),170)}
function openDeleteGroupConfirm(g){$('deleteGroupText').textContent=`Delete ${g.name}? This removes the group and its retained messages.`;$('deleteGroupConfirm').classList.remove('hidden');requestAnimationFrame(()=>$('deleteGroupConfirm').classList.add('modalVisible'))}
function closeDeleteGroupConfirm(){$('deleteGroupConfirm').classList.remove('modalVisible');setTimeout(()=>$('deleteGroupConfirm').classList.add('hidden'),170)}
$('closeRemoveConfirm').onclick=closeRemoveConfirm;$('cancelRemove').onclick=closeRemoveConfirm;
$('confirmRemove').onclick=()=>{if(!pendingRemoveMember)return;const btn=$('confirmRemove');btn.disabled=true;btn.textContent='Removing…';s.emit('removeGroupMember',pendingRemoveMember,(result)=>{btn.disabled=false;btn.textContent='Remove';if(result?.ok){const removed=pendingRemoveMember.name;closeRemoveConfirm();if(result.group){groups=groups.map(x=>x.id===result.group.id?result.group:x);if(selected.type==='group'&&selected.id===result.group.id){$('chatStatus').textContent=`${result.group.members.length} members`;renderGroupInfo(result.group)}renderGroups()}else{groups=groups.filter(x=>x.id!==pendingRemoveMember.groupId);if(selected.type==='group'&&selected.id===pendingRemoveMember.groupId)closeChat();renderGroups()}}else if(result?.error)showToast(result.error)})};
$('closeMemberModal').onclick=()=>{$('memberModal').classList.add('hidden')};
$('confirmAddMembers').onclick=()=>{if(selected.type!=='group')return;const names=[...$('addMembersList').querySelectorAll('input:checked')].map(x=>x.value);if(!names.length)return;const btn=$('confirmAddMembers');btn.disabled=true;btn.textContent='Adding…';s.emit('addGroupMembers',{groupId:selected.id,members:names},result=>{btn.disabled=false;btn.innerHTML='Add selected <span>→</span>';if(result?.ok){groups=groups.map(x=>x.id===result.group.id?result.group:x);renderGroups();if(selected.type==='group'&&selected.id===result.group.id){$('chatName').textContent=result.group.name;$('chatStatus').textContent=`${result.group.members.length} members`;renderGroupInfo(result.group)}$('memberModal').classList.add('hidden')}else if(result?.error)showToast(result.error)})};

$('renameGroupSave').onclick=()=>{const g=getGroup(selected.id),name=$('renameGroupInput').value.trim();if(!g||!name)return;if(name===g.name)return closeRenameGroup();$('renameGroupSave').disabled=true;s.emit('renameGroup',{id:g.id,name},()=>{$('renameGroupSave').disabled=false;closeRenameGroup()})};
$('renameGroupInput').oninput=()=>{$('renameCharCounter').textContent=`${$('renameGroupInput').value.length}/50`};$('renameGroupInput').onkeydown=e=>{if(e.key==='Enter')$('renameGroupSave').click();if(e.key==='Escape')closeRenameGroup()};$('renameGroupCancel').onclick=closeRenameGroup;$('closeRenameGroup').onclick=closeRenameGroup;
$('leaveGroupCancel').onclick=closeLeaveConfirm;$('closeLeaveGroup').onclick=closeLeaveConfirm;$('leaveGroupConfirmBtn').onclick=()=>{if(selected.type==='group'){s.emit('leaveGroup',{groupId:selected.id});closeLeaveConfirm()}};
$('deleteGroupCancel').onclick=closeDeleteGroupConfirm;$('closeDeleteGroup').onclick=closeDeleteGroupConfirm;$('deleteGroupConfirmBtn').onclick=()=>{const g=getGroup(selected.id);if(g){groups=groups.filter(x=>x.id!==g.id);if(selected.type==='group'&&selected.id===g.id)closeChat();renderGroups();s.emit('deleteGroup',{id:g.id})}closeDeleteGroupConfirm()};

s.on('directHistory',d=>{if(selected.type==='direct'&&selected.name===d.with){renderMessages(d.messages);if(isChatVisible())s.emit('markSeen',{with:d.with})}});
s.on('groupHistory',d=>{if(selected.type==='group'&&selected.id===d.group.id){groups=groups.map(g=>g.id===d.group.id?d.group:g);renderMessages(d.messages);$('chatStatus').textContent=`${d.group.members.length} members`}});
s.on('directMessage',m=>{
  if(m.from===me.name||m.to===me.name){
    const active=selected.type==='direct'&&((m.from===me.name&&m.to===selected.name)||(m.to===me.name&&m.from===selected.name));
    if(active){addMessage(m);scroll();if(m.to===me.name&&isChatVisible())s.emit('markSeen',{with:m.from});}
    else if(m.to===me.name)bumpUnread('direct',m.from);
  }
});
s.on('groupMessage',m=>{const g=getGroup(m.groupId);const active=selected.type==='group'&&selected.id===m.groupId;if(active){addMessage(m);scroll();}else if(g&&m.from!==me.name)bumpUnread('group',m.groupId)});
s.on('messageStatus',d=>refreshMessage(d.id,el=>{if(!el.classList.contains('mine'))return;const sm=el.querySelector('small');if(sm){let t=sm.querySelector('.messageTicks');if(!t){t=document.createElement('span');t.className='messageTicks';sm.append(t)}t.textContent=d.status==='sent'?'✓':'✓✓';t.classList.toggle('seen',d.status==='seen');t.title=d.status}}));
s.on('messageEdited',d=>refreshMessage(d.id,el=>{const b=el.querySelector('.bubble');if(b)b.textContent=d.text;const sm=el.querySelector('small');if(sm&&!sm.textContent.includes('edited'))sm.textContent+=' · edited'}));
s.on('messageUnsent',d=>{
  if(editingId===d.id){editingId=null;$('message').value='';resizeComposer()}
  refreshMessage(d.id,el=>{const mine=d.from===me.name;el.dataset.unsent='1';el.classList.toggle('mine',mine);el.classList.toggle('theirs',!mine);el.classList.add('unsentMsg');el.style.cursor='default';const sender=el.querySelector('.sender');if(sender) sender.textContent=d.from;const content=el.querySelector('.messageContent');if(content)content.innerHTML='<div class="bubble unsent">Message unsent</div>';el.querySelectorAll('.messageTicks').forEach(x=>x.remove())});
  if(d.from!==me?.name&&d.kind==='direct'){if(selected.type==='direct'&&selected.name===d.from&&isChatVisible())addSystemNotice('A message was unsent');else if(selected.type!=='direct'||selected.name!==d.from){bumpUnread('direct',d.from);showToast(`${d.from} unsent a message`)}}
});
s.on('groupEvent',m=>{if(selected.type==='group'&&selected.id===m.groupId){addMessage(m);scroll()}});
s.on('groupRenamed',g=>{groups=groups.map(x=>x.id===g.id?g:x);if(selected.type==='group'&&selected.id===g.id){selected.name=g.name;$('chatName').textContent=g.name;renderGroupInfo(g)}renderGroups()});
s.on('groupCreated',g=>{if(!groups.some(x=>x.id===g.id))groups.unshift(g);renderGroups()});
s.on('groupDeleted',id=>{groups=groups.filter(g=>g.id!==id);if(selected.type==='group'&&selected.id===id)closeChat();renderGroups()});
s.on('groupRemoved',id=>{groups=groups.filter(g=>g.id!==id);if(selected.type==='group'&&selected.id===id)closeChat();renderGroups()});
s.on('groupLeft',id=>{groups=groups.filter(g=>g.id!==id);if(selected.type==='group'&&selected.id===id)closeChat();renderGroups()});
s.on('groupUpdated',g=>{groups=groups.map(x=>x.id===g.id?g:x);if(selected.type==='group'&&selected.id===g.id){$('chatName').textContent=g.name;$('chatStatus').textContent=`${g.members.length} members`;if(!$('groupInfoPanel').classList.contains('hidden'))renderGroupInfo(g)}renderGroups()});
s.on('people',a=>{people=a;renderPeople();if(selected.type==='direct'){const p=a.find(x=>x.name===selected.name);if(p)setDirectStatus(p)}if(selected.type==='group'&&!$('groupInfoPanel').classList.contains('hidden')){const g=getGroup(selected.id);if(g)renderGroupInfo(g)}});

function renderTyping(){const active=[...typingUsers.entries()].filter(([k,v])=>v&&v.groupId===selected.id&&v.until>Date.now()).sort((a,b)=>a[0].localeCompare(b[0]));if(!active.length){$('typing').innerHTML='';return}$('typing').innerHTML=active.map(([name])=>`<span class="typingPerson"><span class="typingDots"><i></i><i></i><i></i></span><b>${escapeHtml(name)}</b> is typing…</span>`).join('')}
s.on('typing',p=>{if(selected.type==='direct'&&p.from===selected.name&&p.to===me.name){$('typing').innerHTML=`<span class="typingPerson"><span class="typingDots"><i></i><i></i><i></i></span><b>${escapeHtml(p.from)}</b> is typing…</span>`;clearTimeout(window.__directTyping);window.__directTyping=setTimeout(()=>{$('typing').innerHTML=''},1500)}});
s.on('stopTyping',p=>{if(selected.type==='direct'&&p.from===selected.name)$('typing').innerHTML=''});
s.on('groupTyping',p=>{if(selected.type==='group'&&p.groupId===selected.id&&p.from!==me.name){typingUsers.set(p.from,{groupId:p.groupId,until:Date.now()+1800});renderTyping()}});
s.on('groupStopTyping',p=>{typingUsers.delete(p.from);renderTyping()});
setInterval(()=>{renderTyping()},250);setInterval(()=>{if(me){renderPeople();if(selected.type==='direct'){const p=people.find(x=>x.name===selected.name);if(p)setDirectStatus(p)}if(selected.type==='group'&&!$('groupInfoPanel').classList.contains('hidden')){const g=getGroup(selected.id);if(g)renderGroupInfo(g)}}},4000);
s.on('groupError',m=>showToast(m));s.on('groupMemberError',m=>showToast(m));

function startHeartbeat(){clearInterval(window.__hb);window.__hb=setInterval(()=>{if(me&&s.connected&&document.visibilityState==='visible')s.emit('heartbeat')},15000)}
function announceActive(){if(!me)return;if(!s.connected){s.connect();return}s.emit('presence',{visible:true});$('myStatus').textContent='Online';$('profileStatus').textContent='Online';const p=people.find(x=>x.name===selected.name);if(selected.type==='direct'&&p)setDirectStatus({...p,online:true,lastSeen:Date.now()});if(selected.type==='direct'&&selected.name)s.emit('markSeen',{with:selected.name})}
document.addEventListener('visibilitychange',()=>{if(!me)return;if(document.visibilityState==='visible'){announceActive();sendPushActivity();}else{sendPushActivity();s.emit('presence',{visible:false});$('myStatus').textContent='Away';$('profileStatus').textContent='Away';if(selected.type)stopTypingForCurrent()}});
window.addEventListener('focus',announceActive);window.addEventListener('pageshow',announceActive);
s.on('connect',()=>{if(logoutInProgress)return;const session=loadSession();if(me&&session?.name&&session?.pin)s.emit('login',{name:session.name,pin:session.pin})});

function performLogout(){
  if(pushSubscription&&s.connected)s.emit('pushActivity',{endpoint:pushSubscription.endpoint,visible:false,activeChat:null});
  logoutInProgress=true;authRequestId++;
  if(s.connected)s.emit('logout');
  localStorage.removeItem(SESSION);localStorage.removeItem('fivechat_unread');me=null; selected={type:null,id:null,name:null}; clearInterval(window.__hb); clearTimeout(typingTimer); pendingFiles=[];editingId=null;typingUsers.clear();hideContext();
  $('profileMenu').classList.add('hidden');$('memberModal').classList.add('hidden');$('groupModal').classList.add('hidden');$('renameGroupModal').classList.add('hidden');$('leaveGroupConfirm').classList.add('hidden');$('deleteGroupConfirm').classList.add('hidden');$('removeMemberConfirm').classList.add('hidden');$('app').classList.add('hidden');$('auth').classList.remove('hidden');$('authName').value='';$('authPin').value='';$('authCode').value='';$('authError').textContent='';authMode='login';updateAuth();closePeople();$('authName').focus();
}
function openLogoutConfirm(){ $('logoutConfirm').classList.remove('hidden');requestAnimationFrame(()=>$('logoutConfirm').classList.add('modalVisible')) }
function closeLogoutConfirm(){ $('logoutConfirm').classList.remove('modalVisible');setTimeout(()=>$('logoutConfirm').classList.add('hidden'),170) }
$('logout').onclick=openLogoutConfirm;$('profileLogout').onclick=e=>{e.stopPropagation();$('profileMenu').classList.add('hidden');openLogoutConfirm()};$('profileBtn').onclick=e=>{e.stopPropagation();$('profileMenu').classList.toggle('hidden')};
$('logoutCancel').onclick=closeLogoutConfirm;$('closeLogout').onclick=closeLogoutConfirm;$('logoutConfirmBtn').onclick=()=>{closeLogoutConfirm();setTimeout(performLogout,120)};

const old=loadSession();if(old?.name&&old?.pin){window.__loginPin=old.pin;if(s.connected)s.emit('login',{name:old.name,pin:old.pin});else s.once('connect',()=>s.emit('login',{name:old.name,pin:old.pin}))}

if('serviceWorker' in navigator){navigator.serviceWorker.addEventListener('message',e=>{const d=e.data||{};if(!me)return;if(d.kind==='direct'&&d.with){const p=people.find(x=>x.name===d.with);if(p)openDirect(p)}else if(d.kind==='group'&&d.groupId){const g=getGroup(d.groupId);if(g)openGroup(g)}})}
window.addEventListener('load',()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});});
