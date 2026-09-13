const s = io();
const $ = id => document.getElementById(id);
let me = null, people = [], groups = [], selected = {type:null,id:null,name:null};
let authMode = 'login', typingTimer = null, pendingFiles = [], editingId = null;
const unread = {};
const SESSION = 'fivechat_v24_session';
const typingUsers = new Map();

function saveSession(){ if(me) localStorage.setItem(SESSION, JSON.stringify({name:me.name,pin:window.__loginPin||''})); }
function loadSession(){ try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null} }
function escapeHtml(x){return String(x).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function timeSince(t){if(!t)return'Offline';const sec=Math.max(0,Math.floor((Date.now()-Number(t))/1000));if(sec<60)return`${sec}s ago`;const m=Math.floor(sec/60);if(m<60)return`${m}m ${sec%60}s ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ${m%60}m ago`;return`${Math.floor(h/24)}d ago`}
function senderHue(name){let h=0;for(const c of String(name||''))h=(h*31+c.charCodeAt(0))%360;return h}
function unreadKey(t,id){return `${t}:${String(id).toLowerCase()}`}
function unreadFor(t,id){return unread[unreadKey(t,id)]||0}
function bumpUnread(t,id){const k=unreadKey(t,id);unread[k]=(unread[k]||0)+1;renderPeople();renderGroups()}
function clearUnread(t,id){delete unread[unreadKey(t,id)];renderPeople();renderGroups()}

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
  window.__loginPin=pin;
  if(!s.connected) s.connect();
  const emit=()=>s.emit(create?'createAccount':'login',{name,pin,accessCode:code});
  if(s.connected) emit(); else s.once('connect',emit);
}
$('authBtn').onclick=auth;
$('switchAuth').onclick=()=>{authMode=authMode==='login'?'create':'login';$('authError').textContent='';updateAuth();$('authPin').value='';};
['authName','authPin','authCode'].forEach(id=>$(id).onkeydown=e=>{if(e.key==='Enter')auth()});
updateAuth();

s.on('accountCreated',d=>{authMode='login';updateAuth();$('authName').value=d.name;$('authPin').value='';$('authCode').value='';$('authError').innerHTML='<span class="successAlert">✓ Account created. Log in now.</span>';$('authPin').focus()});
s.on('authError',m=>{$('authError').textContent=m;$('authCard').classList.remove('shake');void $('authCard').offsetWidth;$('authCard').classList.add('shake')});
s.on('loggedIn',d=>{
  me=d.user; people=d.people||[]; groups=d.groups||[]; saveSession(); showApp(); renderPeople(); renderGroups(); welcome();
  s.emit('presence',{visible:true}); startHeartbeat();
});

function renderPeople(){
  if(!me)return;
  const q=$('search').value.toLowerCase();
  const arr=people.filter(p=>p.nameLower!==me.name.toLowerCase()&&p.name.toLowerCase().includes(q)).sort((a,b)=>Number(b.online)-Number(a.online)||a.name.localeCompare(b.name));
  $('peopleList').innerHTML='';
  arr.forEach(p=>{
    const li=document.createElement('li'); li.className='person '+(selected.type==='direct'&&selected.name===p.name?'selected':'');
    const status=p.online?'Online':`Offline · ${timeSince(p.lastSeen)}`;
    li.innerHTML=`<span class="avatar personAvatar" style="--avatarHue:${senderHue(p.name)}">${escapeHtml(p.name[0].toUpperCase())}</span><span class="personText"><b>${escapeHtml(p.name)}</b><small>${status}</small></span><i class="dot ${p.online?'on':'off'}"></i>${unreadFor('direct',p.name)?`<b class="unread">${unreadFor('direct',p.name)}</b>`:''}`;
    li.onclick=()=>openDirect(p); $('peopleList').append(li);
  });
  $('onlineCount').textContent=arr.filter(p=>p.online).length+' online';
}
function renderGroups(){
  if(!me)return; $('groupList').innerHTML='';
  groups.forEach(g=>{
    const li=document.createElement('li'); li.className='person groupRow '+(selected.type==='group'&&selected.id===g.id?'selected':'');
    li.innerHTML=`<span class="avatar groupAvatar">👥</span><span class="personText"><b>${escapeHtml(g.name)}</b><small>${g.members.length} members</small></span>${unreadFor('group',g.id)?`<b class="unread">${unreadFor('group',g.id)}</b>`:''}<button class="groupMore" type="button" aria-label="Group options">⋮</button>`;
    li.onclick=()=>openGroup(g);
    li.querySelector('.groupMore').onclick=e=>{e.stopPropagation();showGroupMenu(g,e.currentTarget)};
    $('groupList').append(li);
  });
}
function showGroupMenu(g,anchor){
  closeMoreMenus();
  const menu=document.createElement('div'); menu.className='groupMoreMenu floatingGroupMenu';
  menu.innerHTML=`<button type="button" data-rename>Rename group</button>${g.createdBy===me.name?'<button type="button" data-delete class="dangerOption">Delete group</button>':''}`;
  document.body.append(menu);
  const r=anchor.getBoundingClientRect(),w=160;
  menu.style.left=Math.max(8,Math.min(innerWidth-w-8,r.right-w))+'px';
  menu.style.top=Math.min(innerHeight-100,r.bottom+7)+'px';
  menu.querySelector('[data-rename]').onclick=()=>{closeMoreMenus();const n=prompt('Enter a new group name',g.name);if(n&&n.trim()&&n.trim()!==g.name)s.emit('renameGroup',{id:g.id,name:n.trim()})};
  const del=menu.querySelector('[data-delete]'); if(del)del.onclick=()=>{closeMoreMenus();groups=groups.filter(x=>x.id!==g.id);if(selected.type==='group'&&selected.id===g.id)closeChat();renderGroups();s.emit('deleteGroup',{id:g.id})};
}
function closeMoreMenus(){document.querySelectorAll('.floatingGroupMenu').forEach(x=>x.remove())}

document.addEventListener('click',e=>{if(!e.target.closest('.groupMore'))closeMoreMenus();if(!e.target.closest('.meProfile'))$('profileMenu').classList.add('hidden');if(!e.target.closest('#groupInfoPanel')&&!e.target.closest('#chatAvatar'))closeGroupInfo()});

function welcome(){
  selected={type:null,id:null,name:null}; stopAllTyping(); closeGroupInfo(); closeMoreMenus();
  $('chatHead').classList.add('homeHidden'); $('chatName').textContent=''; $('chatStatus').textContent=''; $('chatAvatar').textContent='?'; $('chatAvatar').disabled=true;
  $('messages').innerHTML='<div class="welcomeEmpty"><div class="welcomeIcon">✦</div><h2>Welcome to FiveChat</h2><p>Select a person or group from the People panel to start chatting.</p></div>';
  $('composer').classList.add('hidden'); $('closeChat').classList.add('hidden');
}
function enableComposer(){ $('composer').classList.remove('hidden'); $('message').disabled=false;$('send').disabled=false;$('attachBtn').disabled=false;$('emojiBtn').disabled=false;$('closeChat').classList.remove('hidden'); }
function openDirect(p){
  stopAllTyping(); selected={type:'direct',name:p.name}; closeGroupInfo(); clearUnread('direct',p.name); $('chatHead').classList.remove('homeHidden');
  $('chatName').textContent=p.name;$('chatAvatar').textContent=p.name[0].toUpperCase();$('chatAvatar').disabled=true;setDirectStatus(p);
  enableComposer(); $('messages').innerHTML='<div class="loading">Loading…</div>'; closePeople(); s.emit('openDirect',{with:p.name});
}
function setDirectStatus(p){$('chatStatus').textContent=p.online?'● Online':`○ Offline · ${timeSince(p.lastSeen)}`}
function getGroup(id){return groups.find(g=>g.id===id)}
function openGroup(g){
  stopAllTyping(); selected={type:'group',id:g.id,name:g.name}; clearUnread('group',g.id); closeGroupInfo(); $('chatHead').classList.remove('homeHidden');
  $('chatName').textContent=g.name;$('chatAvatar').textContent='👥';$('chatAvatar').disabled=false;$('chatStatus').textContent=`${g.members.length} members`;
  enableComposer(); $('messages').innerHTML='<div class="loading">Loading…</div>'; closePeople(); s.emit('openGroup',{id:g.id});
}
function closeChat(){stopAllTyping();pendingFiles=[];renderAttachments();$('message').value='';resizeComposer();welcome()}
function closePeople(){$('peoplePanel').classList.add('closed');document.body.classList.remove('menuOpen')}
function openPeople(){closeGroupInfo();closeMoreMenus();$('peoplePanel').classList.remove('closed');document.body.classList.add('menuOpen')}

function renderMessages(arr){$('messages').innerHTML='';if(!arr.length){$('messages').innerHTML='<div class="empty"><div>✦</div><h3>No messages yet</h3><p>Start the conversation.</p></div>';return}arr.forEach(addMessage);scroll()}
function attachmentHtml(a){if(a.type?.startsWith('image/'))return `<div class="attachment imageAttachment"><img src="${a.data}" alt="${escapeHtml(a.name)}"><span>${escapeHtml(a.name)}</span></div>`;return `<a class="attachment fileAttachment" href="${a.data}" download="${escapeHtml(a.name)}"><span>📄</span><span><b>${escapeHtml(a.name)}</b><small>${Math.ceil(a.size/1024)} KB</small></span></a>`}
function addMessage(m){
  const empty=$('messages').querySelector('.empty,.welcomeEmpty'); if(empty) empty.remove();
  const mine=m.from===me.name,d=document.createElement('div');d.className=`msg ${mine?'mine':'theirs'}${selected.type==='group'?' groupMsg':''}`;d.dataset.id=m.id;d.style.setProperty('--senderHue',senderHue(m.from));
  const sender=selected.type==='group'?`<strong class="sender">${escapeHtml(m.from)}</strong>`:'';
  const text=m.text?`<div class="bubble">${escapeHtml(m.text)}</div>`:''; const at=(m.attachments||[]).map(attachmentHtml).join('');
  const tick=mine?`<span class="messageTicks ${m.status==='seen'?'seen':''}" title="${m.status||'sent'}">${m.status==='sent'?'✓':'✓✓'}</span>`:'';
  d.innerHTML=`${sender}<div class="messageContent">${text}${at}</div><small>${new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}${m.edited?' · edited':''}${tick}</small>`;
  if(mine)d.addEventListener('click',e=>showContext(e,m));$('messages').append(d);
}
function refreshMessage(id,fn){const el=[...$('messages').children].find(x=>x.dataset.id===id);if(el)fn(el)}
function showContext(e,m){if(m.from!==me.name)return;e.stopPropagation();const menu=$('contextMenu');menu.style.left=Math.min(e.clientX,innerWidth-160)+'px';menu.style.top=Math.min(e.clientY,innerHeight-100)+'px';menu.classList.remove('hidden');menu.dataset.id=m.id;menu.dataset.text=m.text||''}
$('contextMenu').onclick=e=>{const action=e.target.dataset.action,id=$('contextMenu').dataset.id;if(action==='edit'){editingId=id;const el=[...$('messages').children].find(x=>x.dataset.id===id);$('message').value=el?.querySelector('.bubble')?.textContent||$('contextMenu').dataset.text;resizeComposer();$('message').focus()}else if(action==='unsend')s.emit('unsendMessage',{id});$('contextMenu').classList.add('hidden')};
function resizeComposer(){const el=$('message');el.style.height='auto';el.style.height=Math.min(el.scrollHeight,130)+'px'} function scroll(){$('messages').scrollTop=$('messages').scrollHeight}

$('composer').onsubmit=async e=>{e.preventDefault();if(!selected.type)return;const text=$('message').value.trim();if(!text&&!pendingFiles.length)return;const attachments=await Promise.all(pendingFiles.map(fileToData));stopTypingForCurrent();if(editingId){s.emit('editMessage',{id:editingId,text});editingId=null}else if(selected.type==='direct')s.emit('sendDirect',{to:selected.name,text,attachments});else s.emit('sendGroup',{groupId:selected.id,text,attachments});$('message').value='';pendingFiles=[];renderAttachments();resizeComposer();$('message').focus()};
$('message').oninput=()=>{resizeComposer();if(!$('message').value.trim()){stopTypingForCurrent();return}announceTyping()};
$('message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('composer').requestSubmit();return}if(e.key==='Enter'&&e.shiftKey){requestAnimationFrame(resizeComposer);return}if(e.key.length===1)announceTyping()};
$('message').onblur=stopTypingForCurrent;
function announceTyping(){if(!selected.type||$('message').disabled||!me)return;stopTypingForCurrent(false);if(selected.type==='direct')s.emit('typing',{to:selected.name});else s.emit('groupTyping',{groupId:selected.id});clearTimeout(typingTimer);typingTimer=setTimeout(stopTypingForCurrent,1100)}
function stopTypingForCurrent(clear=true){clearTimeout(typingTimer);if(!selected.type||!me)return;if(selected.type==='direct')s.emit('stopTyping',{to:selected.name});else s.emit('groupStopTyping',{groupId:selected.id});if(clear)$('typing').textContent=''}
function stopAllTyping(){clearTimeout(typingTimer);if(me&&selected.type)stopTypingForCurrent();typingUsers.clear();$('typing').innerHTML=''}

$('attachBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=e=>{const max=5*1024*1024,files=[...e.target.files],accepted=files.filter(f=>f.size<=max);pendingFiles=[...pendingFiles,...accepted].slice(0,6);if(accepted.length<files.length)alert('Each attachment must be 5 MB or smaller.');renderAttachments();e.target.value=''};
function renderAttachments(){$('attachmentPreview').innerHTML=pendingFiles.map((f,i)=>`<span class="previewItem">${f.type.startsWith('image/')?'🖼️':'📄'} ${escapeHtml(f.name)} <button type="button" data-i="${i}">×</button></span>`).join('');$('attachmentPreview').querySelectorAll('button').forEach(b=>b.onclick=()=>{pendingFiles.splice(+b.dataset.i,1);renderAttachments()})}
function fileToData(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res({name:f.name,type:f.type,size:f.size,data:r.result});r.onerror=rej;r.readAsDataURL(f)})}

$('closeChat').onclick=closeChat;$('chatAvatar').onclick=()=>{if(selected.type==='group')toggleGroupInfo()};$('emojiBtn').onclick=()=>{if($('message').disabled)return;$('message').setRangeText('😊',$('message').selectionStart,$('message').selectionEnd,'end');$('message').focus();resizeComposer();announceTyping()};
$('mobilePeople').onclick=openPeople;document.querySelector('.chatArea')?.addEventListener('click',e=>{if(window.innerWidth<=760&&document.body.classList.contains('menuOpen')&&!e.target.closest('#peoplePanel'))closePeople()});$('peopleClose').onclick=e=>{e.preventDefault();e.stopPropagation();closePeople()};$('search').oninput=renderPeople;
$('newGroup').onclick=()=>{buildGroupMembers();$('groupName').value='';$('groupModal').classList.remove('hidden')};$('closeGroup').onclick=()=>$('groupModal').classList.add('hidden');
$('createGroup').onclick=()=>{const name=$('groupName').value.trim(),members=[...$('groupMembers').querySelectorAll('input:checked')].map(x=>x.value);if(!name||!members.length)return;s.emit('createGroup',{name,members});$('groupName').value='';$('groupModal').classList.add('hidden')};
function buildGroupMembers(){
  $('groupMembers').innerHTML='';
  people.filter(p=>p.name!==me.name).forEach((p,i)=>{const l=document.createElement('label');l.className='memberChoice';l.innerHTML=`<input type="checkbox" value="${escapeHtml(p.name)}"><span class="choiceAvatar" style="--choiceHue:${senderHue(p.name)}">${escapeHtml(p.name[0].toUpperCase())}</span><span class="choiceText"><b>${escapeHtml(p.name)}</b><small>${p.online?'Online':'Offline · '+timeSince(p.lastSeen)}</small></span><span class="choiceCheck">✓</span>`;$('groupMembers').append(l)})
}

function toggleGroupInfo(){if(selected.type!=='group')return;const g=getGroup(selected.id);if(!g)return;renderGroupInfo(g);$('groupInfoPanel').classList.toggle('hidden')}
function closeGroupInfo(){$('groupInfoPanel').classList.add('hidden')}
function renderGroupInfo(g){
  const admin=g.createdBy===me.name; const memberRows=g.members.map((name,i)=>{const p=people.find(x=>x.nameLower===name.toLowerCase())||{name,online:false,lastSeen:0};const status=p.online?'Online':`Offline · ${timeSince(p.lastSeen)}`;return `<div class="infoMember"><span class="avatar miniAvatar" style="--avatarHue:${senderHue(name)}">${escapeHtml(name[0].toUpperCase())}</span><span class="infoMemberText"><b>${escapeHtml(name)} ${name===g.createdBy?'<em>Admin</em>':''}</b><small class="${p.online?'onlineText':'offlineText'}">${status}</small></span>${admin&&name!==g.createdBy?`<button class="removeMember" data-remove-member="${escapeHtml(name)}" title="Remove ${escapeHtml(name)}">×</button>`:''}</div>`}).join('');
  $('groupInfoPanel').innerHTML=`<div class="infoHeader"><div><span class="overline">GROUP INFO</span><h3>${escapeHtml(g.name)}</h3><small>${g.members.length} members · admin managed</small></div><button class="infoClose" type="button">×</button></div><div class="infoMembers">${memberRows}</div>${admin?'<button class="addMemberBtn" type="button">＋ Add people</button>':'<div class="memberNote">Only the group admin can add or remove people.</div>'}`;
  $('groupInfoPanel').querySelector('.infoClose').onclick=e=>{e.stopPropagation();closeGroupInfo()};
  const add=$('groupInfoPanel').querySelector('.addMemberBtn');if(add)add.onclick=e=>{e.stopPropagation();buildAddMembers(g);$('memberModal').classList.remove('hidden')};
  $('groupInfoPanel').querySelectorAll('[data-remove-member]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();s.emit('removeGroupMember',{groupId:g.id,name:btn.dataset.removeMember})});
}
function buildAddMembers(g){
  const existing=new Set(g.membersLower||g.members.map(x=>x.toLowerCase()));$('addMembersList').innerHTML='';
  people.filter(p=>p.nameLower!==me.name.toLowerCase()&&!existing.has(p.nameLower)).forEach(p=>{const l=document.createElement('label');l.className='memberChoice';l.innerHTML=`<input type="checkbox" value="${escapeHtml(p.name)}"><span class="choiceAvatar" style="--choiceHue:${senderHue(p.name)}">${escapeHtml(p.name[0].toUpperCase())}</span><span class="choiceText"><b>${escapeHtml(p.name)}</b><small>${p.online?'Online':'Offline · '+timeSince(p.lastSeen)}</small></span><span class="choiceCheck">✓</span>`;$('addMembersList').append(l)});
  if(!$('addMembersList').children.length)$('addMembersList').innerHTML='<div class="noPeopleToAdd">Everyone is already in this group.</div>';
}
$('closeMemberModal').onclick=()=>{$('memberModal').classList.add('hidden')};
$('confirmAddMembers').onclick=()=>{if(selected.type!=='group')return;const names=[...$('addMembersList').querySelectorAll('input:checked')].map(x=>x.value);if(!names.length)return;s.emit('addGroupMembers',{groupId:selected.id,members:names});$('memberModal').classList.add('hidden')};

s.on('directHistory',d=>{if(selected.type==='direct'&&selected.name===d.with){renderMessages(d.messages);s.emit('markSeen',{with:d.with})}});
s.on('groupHistory',d=>{if(selected.type==='group'&&selected.id===d.group.id){groups=groups.map(g=>g.id===d.group.id?d.group:g);renderMessages(d.messages);$('chatStatus').textContent=`${d.group.members.length} members`}});
s.on('directMessage',m=>{if(m.from===me.name||m.to===me.name){if(selected.type==='direct'&&((m.from===me.name&&m.to===selected.name)||(m.to===me.name&&m.from===selected.name))){addMessage(m);scroll();if(m.to===me.name)s.emit('markSeen',{with:m.from})}else if(m.to===me.name)bumpUnread('direct',m.from)}});
s.on('groupMessage',m=>{const g=getGroup(m.groupId);if(selected.type==='group'&&selected.id===m.groupId){addMessage(m);scroll()}else if(g&&m.from!==me.name)bumpUnread('group',m.groupId)});
s.on('messageStatus',d=>refreshMessage(d.id,el=>{if(!el.classList.contains('mine'))return;const sm=el.querySelector('small');if(sm){let t=sm.querySelector('.messageTicks');if(!t){t=document.createElement('span');t.className='messageTicks';sm.append(t)}t.textContent=d.status==='sent'?'✓':'✓✓';t.classList.toggle('seen',d.status==='seen');t.title=d.status}}));
s.on('messageEdited',d=>refreshMessage(d.id,el=>{const b=el.querySelector('.bubble');if(b)b.textContent=d.text;const sm=el.querySelector('small');if(sm&&!sm.textContent.includes('edited'))sm.textContent+=' · edited'}));
s.on('messageUnsent',d=>refreshMessage(d.id,el=>{el.querySelector('.messageContent').innerHTML='<div class="bubble unsent">Message unsent</div>'}));
s.on('groupRenamed',g=>{groups=groups.map(x=>x.id===g.id?g:x);if(selected.type==='group'&&selected.id===g.id){selected.name=g.name;$('chatName').textContent=g.name;renderGroupInfo(g)}renderGroups()});
s.on('groupCreated',g=>{if(!groups.some(x=>x.id===g.id))groups.unshift(g);renderGroups()});
s.on('groupDeleted',id=>{groups=groups.filter(g=>g.id!==id);if(selected.type==='group'&&selected.id===id)closeChat();renderGroups()});
s.on('groupRemoved',id=>{groups=groups.filter(g=>g.id!==id);if(selected.type==='group'&&selected.id===id)closeChat();renderGroups()});
s.on('groupUpdated',g=>{groups=groups.map(x=>x.id===g.id?g:x);if(selected.type==='group'&&selected.id===g.id){$('chatName').textContent=g.name;$('chatStatus').textContent=`${g.members.length} members`;if(!$('groupInfoPanel').classList.contains('hidden'))renderGroupInfo(g)}renderGroups()});
s.on('people',a=>{people=a;renderPeople();if(selected.type==='direct'){const p=a.find(x=>x.name===selected.name);if(p)setDirectStatus(p)}if(selected.type==='group'&&!$('groupInfoPanel').classList.contains('hidden')){const g=getGroup(selected.id);if(g)renderGroupInfo(g)}});

function renderTyping(){
  const active=[...typingUsers.entries()].filter(([k,v])=>v&&v.groupId===selected.id&&v.until>Date.now());
  if(!active.length){$('typing').innerHTML='';return}
  $('typing').innerHTML=active.map(([name])=>`<span class="typingPerson"><span class="typingDots"><i></i><i></i><i></i></span><b>${escapeHtml(name)}</b> is typing…</span>`).join('');
}
s.on('typing',p=>{if(selected.type==='direct'&&p.from===selected.name&&p.to===me.name){$('typing').innerHTML=`<span class="typingPerson"><span class="typingDots"><i></i><i></i><i></i></span><b>${escapeHtml(p.from)}</b> is typing…</span>`;clearTimeout(window.__directTyping);window.__directTyping=setTimeout(()=>{$('typing').innerHTML=''},1500)}});
s.on('stopTyping',p=>{if(selected.type==='direct'&&p.from===selected.name)$('typing').innerHTML=''});
s.on('groupTyping',p=>{if(selected.type==='group'&&p.groupId===selected.id&&p.from!==me.name){typingUsers.set(p.from,{groupId:p.groupId,until:Date.now()+1800});renderTyping()}});
s.on('groupStopTyping',p=>{typingUsers.delete(p.from);renderTyping()});
setInterval(()=>{renderTyping();if(me){renderPeople();if(selected.type==='direct'){const p=people.find(x=>x.name===selected.name);if(p)setDirectStatus(p)}if(selected.type==='group'&&!$('groupInfoPanel').classList.contains('hidden')){const g=getGroup(selected.id);if(g)renderGroupInfo(g)}}},1000);
s.on('groupError',m=>alert(m));s.on('groupMemberError',m=>alert(m));

function startHeartbeat(){clearInterval(window.__hb);window.__hb=setInterval(()=>{if(me&&s.connected&&document.visibilityState==='visible')s.emit('heartbeat')},15000)}
function announceActive(){if(!me)return;if(!s.connected){s.connect();return}s.emit('presence',{visible:true});$('myStatus').textContent='Online';$('profileStatus').textContent='Online';const p=people.find(x=>x.name===selected.name);if(selected.type==='direct'&&p)setDirectStatus({...p,online:true,lastSeen:Date.now()})}
document.addEventListener('visibilitychange',()=>{if(!me)return;if(document.visibilityState==='visible')announceActive();else{s.emit('presence',{visible:false});$('myStatus').textContent='Away';$('profileStatus').textContent='Away';if(selected.type)stopTypingForCurrent()}});
window.addEventListener('focus',announceActive);window.addEventListener('pageshow',announceActive);
s.on('connect',()=>{const session=loadSession();if(me&&session?.name&&session?.pin)s.emit('login',{name:session.name,pin:session.pin})});
window.addEventListener('beforeunload',()=>{if(me&&s.connected)s.emit('presence',{visible:false})});
function performLogout(){
  if(s.connected)s.emit('logout'); localStorage.removeItem(SESSION); me=null; selected={type:null,id:null,name:null}; clearInterval(window.__hb); clearTimeout(typingTimer); pendingFiles=[];editingId=null;typingUsers.clear();
  $('profileMenu').classList.add('hidden');$('memberModal').classList.add('hidden');$('groupModal').classList.add('hidden');$('app').classList.add('hidden');$('auth').classList.remove('hidden');$('authName').value='';$('authPin').value='';$('authCode').value='';$('authError').textContent='';authMode='login';updateAuth();closePeople();$('authName').focus();
}
$('logout').onclick=performLogout;$('profileLogout').onclick=e=>{e.stopPropagation();performLogout()};$('profileBtn').onclick=e=>{e.stopPropagation();$('profileMenu').classList.toggle('hidden')};

const old=loadSession();if(old?.name&&old?.pin){window.__loginPin=old.pin;if(s.connected)s.emit('login',{name:old.name,pin:old.pin});else s.once('connect',()=>s.emit('login',{name:old.name,pin:old.pin}))}
