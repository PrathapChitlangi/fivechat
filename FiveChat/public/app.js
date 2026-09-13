const s=io();
const $=id=>document.getElementById(id);
let me=null,people=[],groups=[],selected={type:null,id:null,name:null},authMode='login',typingTimers=new Map(),groupTyping=new Set(),groupTypingTimers=new Map(),pendingFiles=[],editingId=null;
const SESSION='fivechat_v24_session',unread={};

function saveSession(){if(me)localStorage.setItem(SESSION,JSON.stringify({name:me.name,pin:window.__loginPin||''}))}
function loadSession(){try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null}}
function escapeHtml(x){return String(x??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function unreadKey(t,id){return t+':'+String(id).toLowerCase()}
function unreadFor(t,id){return unread[unreadKey(t,id)]||0}
function bumpUnread(t,id){const k=unreadKey(t,id);unread[k]=(unread[k]||0)+1;renderPeople();renderGroups()}
function clearUnread(t,id){delete unread[unreadKey(t,id)];renderPeople();renderGroups()}
function timeSince(t){if(!t)return'Offline';const sec=Math.max(0,Math.floor((Date.now()-Number(t))/1000));if(sec<60)return'just now';const m=Math.floor(sec/60);if(m<60)return m+'m ago';const h=Math.floor(m/60);if(h<24)return h+'h ago';return Math.floor(h/24)+'d ago'}

function showApp(){
 $('auth').classList.add('hidden');$('app').classList.remove('hidden');
 const initial=(me.name||'?')[0].toUpperCase();
 $('meName').textContent=me.name;$('meAvatar').textContent=initial;$('profileName').textContent=me.name;$('profileAvatar').textContent=initial;
 setMyStatus('Online');closePeople();
}
function setMyStatus(v){$('myStatus').textContent=v;$('profileStatus').textContent=v}
function updateAuth(){
 const create=authMode==='create';
 $('createFields').classList.toggle('hidden',!create);
 $('authTitle').textContent=create?'Create your FiveChat account':'Log in to FiveChat';
 $('authText').textContent=create?'':'Use your account name and PIN to continue.';
 $('authBtn').innerHTML=create?'Sign up <span>→</span>':'Log in <span>→</span>';
 $('switchAuth').innerHTML=create?'Already have an account? <b>Log in</b>':'Don’t have an account? <b>Sign up</b>';
 $('pinLabel').classList.toggle('hidden',create);
 $('authPin').placeholder=create?'Create PIN':'4 digits';
}
function auth(){
 const name=$('authName').value.trim(),pin=$('authPin').value.trim(),code=$('authCode').value.trim(),create=authMode==='create';
 $('authError').textContent='';
 if(!name||!/^[0-9]{4}$/.test(pin))return $('authError').textContent='Enter your name and a valid 4-digit PIN.';
 if(create&&!code)return $('authError').textContent='Enter the access code.';
 window.__loginPin=pin;s.emit(create?'createAccount':'login',{name,pin,accessCode:code});
}
$('authBtn').onclick=auth;$('switchAuth').onclick=()=>{authMode=authMode==='login'?'create':'login';$('authError').textContent='';updateAuth()};
['authName','authPin','authCode'].forEach(id=>$(id).onkeydown=e=>{if(e.key==='Enter')auth()});updateAuth();

s.on('accountCreated',d=>{authMode='login';updateAuth();$('authName').value=d.name;$('authPin').value='';$('authCode').value='';$('authError').innerHTML='<span class="successAlert">✓ Account created. Log in now.</span>'});
s.on('authError',m=>{$('authError').textContent=m;$('authCard').classList.remove('shake');void $('authCard').offsetWidth;$('authCard').classList.add('shake')});
s.on('loggedIn',d=>{const hadApp=!!me;me=d.user;people=d.people||[];groups=d.groups||[];saveSession();showApp();renderPeople();renderGroups();if(!hadApp)welcome();s.emit('presence',{visible:true});startHeartbeat()});

function renderPeople(){
 if(!me)return;const q=$('search').value.toLowerCase();
 const arr=people.filter(p=>p.nameLower!==me.name.toLowerCase()&&p.name.toLowerCase().includes(q)).sort((a,b)=>Number(b.online)-Number(a.online)||a.name.localeCompare(b.name));
 $('peopleList').innerHTML='';
 arr.forEach(p=>{const li=document.createElement('li');li.className='person '+(selected.type==='direct'&&selected.name===p.name?'selected':'');
 const status=p.online?'Online':`Offline · ${timeSince(p.lastSeen)}`;
 li.innerHTML=`<span class="avatar">${escapeHtml(p.name[0].toUpperCase())}</span><span class="personText"><b>${escapeHtml(p.name)}</b><small>${status}</small></span><i class="dot ${p.online?'on':'off'}"></i>${unreadFor('direct',p.name)?`<b class="unread">${unreadFor('direct',p.name)}</b>`:''}`;
 li.onclick=()=>openDirect(p);$('peopleList').append(li)});
 $('onlineCount').textContent=arr.filter(p=>p.online).length+' online';
}
function renderGroups(){
 if(!me)return;$('groupList').innerHTML='';
 groups.forEach(g=>{const li=document.createElement('li');li.className='person '+(selected.type==='group'&&selected.id===g.id?'selected':'');
 const canManage=g.createdBy===me.name;
 li.innerHTML=`<span class="avatar groupAvatar">👥</span><span class="personText"><b>${escapeHtml(g.name)}</b><small>${g.members.length} members</small></span>${unreadFor('group',g.id)?`<b class="unread">${unreadFor('group',g.id)}</b>`:''}<button class="groupMore" type="button" aria-label="More options">⋮</button><div class="groupMoreMenu hidden"><button type="button" data-rename-group="${escapeHtml(g.id)}">Rename group</button>${canManage?`<button type="button" data-delete-group="${escapeHtml(g.id)}" class="dangerOption">Delete group</button>`:''}</div>`;
 li.onclick=()=>openGroup(g);
 li.querySelector('.groupMore').onclick=e=>{e.stopPropagation();const menu=li.querySelector('.groupMoreMenu'),was=menu.classList.contains('hidden');closeMoreMenus();if(was){const r=e.currentTarget.getBoundingClientRect();menu.style.position='fixed';menu.style.left=Math.max(8,Math.min(r.right-140,innerWidth-148))+'px';menu.style.top=Math.min(r.bottom+6,innerHeight-125)+'px';menu.classList.remove('hidden')}};
 li.querySelector('[data-rename-group]').onclick=e=>{e.stopPropagation();closeMoreMenus();const next=prompt('Enter a new group name',g.name);if(next&&next.trim()&&next.trim()!==g.name)s.emit('renameGroup',{id:g.id,name:next.trim()})};
 const del=li.querySelector('[data-delete-group]');if(del)del.onclick=e=>{e.stopPropagation();closeMoreMenus();s.emit('deleteGroup',{id:g.id})};
 $('groupList').append(li)});
}
function closeMoreMenus(){document.querySelectorAll('.groupMoreMenu').forEach(x=>{x.classList.add('hidden');x.style.position='';x.style.left='';x.style.top=''})}

function welcome(){
 selected={type:null,id:null,name:null};clearGroupTyping();
 $('chatHead').classList.add('homeHidden');$('chatName').textContent='';$('chatStatus').textContent='';$('chatAvatar').textContent='?';$('chatAvatar').disabled=true;
 $('messages').innerHTML='<div class="welcomeEmpty"><div class="welcomeIcon">✦</div><h2>Welcome to FiveChat</h2><p>Select a person or group from the People panel to start chatting.</p></div>';
 $('composer').classList.add('hidden');$('closeChat').classList.add('hidden');closeMoreMenus();
}
function openDirect(p){
 clearGroupTyping();selected={type:'direct',name:p.name};clearUnread('direct',p.name);$('chatHead').classList.remove('homeHidden');$('chatName').textContent=p.name;$('chatAvatar').textContent=p.name[0].toUpperCase();$('chatAvatar').disabled=true;setDirectStatus(p);$('composer').classList.remove('hidden');setComposerEnabled(true);$('closeChat').classList.remove('hidden');$('messages').innerHTML='<div class="loading">Loading…</div>';s.emit('openDirect',{with:p.name});closePeople();
}
function setDirectStatus(p){$('chatStatus').textContent=p?.online?'● Online':`○ Offline · ${timeSince(p?.lastSeen)}`}
function openGroup(g){
 clearGroupTyping();selected={type:'group',id:g.id,name:g.name};clearUnread('group',g.id);$('chatHead').classList.remove('homeHidden');$('chatName').textContent=g.name;$('chatAvatar').textContent='👥';$('chatAvatar').disabled=false;$('chatStatus').textContent=g.members.length+' members';$('composer').classList.remove('hidden');setComposerEnabled(true);$('closeChat').classList.remove('hidden');$('messages').innerHTML='<div class="loading">Loading…</div>';s.emit('openGroup',{id:g.id});closePeople();
}
function setComposerEnabled(v){['message','send','attachBtn','emojiBtn'].forEach(id=>$(id).disabled=!v)}
function closeChat(){welcome();pendingFiles=[];renderAttachments();$('message').value='';editingId=null;resizeComposer()}
function closePeople(){$('peoplePanel').classList.add('closed');document.body.classList.remove('menuOpen')}
function openPeople(){$('peoplePanel').classList.remove('closed');document.body.classList.add('menuOpen')}

function renderMessages(arr){$('messages').innerHTML='';if(!arr.length){$('messages').innerHTML='<div class="empty"><div>✦</div><h3>No messages yet</h3><p>Start the conversation.</p></div>';return}arr.forEach(addMessage);scroll()}
function attachmentHtml(a){if(a.type?.startsWith('image/'))return`<div class="attachment imageAttachment"><img src="${a.data}" alt="${escapeHtml(a.name)}"><span>${escapeHtml(a.name)}</span></div>`;return`<a class="attachment fileAttachment" href="${a.data}" download="${escapeHtml(a.name)}"><span>📄</span><span><b>${escapeHtml(a.name)}</b><small>${Math.ceil(a.size/1024)} KB</small></span></a>`}
function senderHue(name){let h=0;for(const c of String(name||''))h=(h*31+c.charCodeAt(0))%360;return h}
function addMessage(m){
 if(m.system){addSystemMessage(m);return}
 const mine=m.from===me.name,d=document.createElement('div');d.className='msg '+(mine?'mine':'theirs')+(selected.type==='group'?' groupMsg':'');d.dataset.id=m.id;d.style.setProperty('--senderHue',senderHue(m.from));
 const sender=selected.type==='group'?`<strong class="sender">${escapeHtml(m.from)}</strong>`:'';const text=m.text?`<div class="bubble">${escapeHtml(m.text)}</div>`:'';const at=(m.attachments||[]).map(attachmentHtml).join('');
 const tick=mine?`<span class="messageTicks ${m.status==='seen'?'seen':''}" title="${m.status||'sent'}">${m.status==='sent'?'✓':'✓✓'}</span>`:'';
 d.innerHTML=`${sender}<div class="messageContent">${text}${at}</div><small>${new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}${m.edited?' · edited':''}${tick}</small>`;
 if(mine)d.addEventListener('click',e=>showContext(e,m));$('messages').append(d)
}
function addSystemMessage(m){const d=document.createElement('div');d.className='systemMessage';d.innerHTML=`<span>${escapeHtml(m.text||'')}</span>`;$('messages').append(d)}
function refreshMessage(id,fn){const el=[...$('messages').children].find(x=>x.dataset.id===id);if(el)fn(el)}
function showContext(e,m){e.stopPropagation();if(m.from!==me.name)return;const menu=$('contextMenu');menu.style.left=Math.min(e.clientX,innerWidth-160)+'px';menu.style.top=Math.min(e.clientY,innerHeight-100)+'px';menu.classList.remove('hidden');menu.dataset.id=m.id;menu.dataset.text=m.text||''}
$('contextMenu').onclick=e=>{const action=e.target.dataset.action,id=$('contextMenu').dataset.id;if(action==='edit'){editingId=id;const el=[...$('messages').children].find(x=>x.dataset.id===id),old=el?.querySelector('.bubble')?.textContent||$('contextMenu').dataset.text;$('message').value=old;resizeComposer();$('message').focus()}else if(action==='unsend')s.emit('unsendMessage',{id});$('contextMenu').classList.add('hidden')};
document.addEventListener('click',()=>{$('contextMenu').classList.add('hidden')});
function resizeComposer(){const el=$('message');el.style.height='auto';const h=Math.min(Math.max(el.scrollHeight,52),120);el.style.height=h+'px'}
function scroll(){$('messages').scrollTop=$('messages').scrollHeight}

$('composer').onsubmit=async e=>{e.preventDefault();if(!selected.type)return;const text=$('message').value.trim();if(!text&&!pendingFiles.length)return;const attachments=await Promise.all(pendingFiles.map(fileToData));
 if(editingId){s.emit('editMessage',{id:editingId,text});editingId=null}else if(selected.type==='direct')s.emit('sendDirect',{to:selected.name,text,attachments});else s.emit('sendGroup',{groupId:selected.id,text,attachments});
 $('message').value='';pendingFiles=[];renderAttachments();resizeComposer();if(selected.type==='direct')s.emit('stopTyping',{to:selected.name});else s.emit('groupStopTyping',{groupId:selected.id});$('message').focus()};
$('message').oninput=resizeComposer;
$('message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('composer').requestSubmit();return}if(e.key==='Enter'&&e.shiftKey){requestAnimationFrame(resizeComposer);return}if(e.key.length===1){if(selected.type==='direct'){s.emit('typing',{to:selected.name});clearTimeout(typingTimers.get(selected.name));typingTimers.set(selected.name,setTimeout(()=>s.emit('stopTyping',{to:selected.name}),1000))}else if(selected.type==='group'){s.emit('groupTyping',{groupId:selected.id});clearTimeout(typingTimers.get(selected.id));typingTimers.set(selected.id,setTimeout(()=>s.emit('groupStopTyping',{groupId:selected.id}),1000))}}};
$('message').onblur=()=>{if(selected.type==='direct')s.emit('stopTyping',{to:selected.name});if(selected.type==='group')s.emit('groupStopTyping',{groupId:selected.id})};
$('attachBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=e=>{const files=[...e.target.files],max=5*1024*1024,accepted=files.filter(f=>f.size<=max);pendingFiles=[...pendingFiles,...accepted].slice(0,6);if(accepted.length<files.length)alert('Each attachment must be 5 MB or smaller.');renderAttachments();e.target.value=''};
function renderAttachments(){$('attachmentPreview').innerHTML=pendingFiles.map((f,i)=>`<span class="previewItem">${f.type.startsWith('image/')?'🖼️':'📄'} ${escapeHtml(f.name)} <button type="button" data-i="${i}">×</button></span>`).join('');$('attachmentPreview').querySelectorAll('button').forEach(b=>b.onclick=()=>{pendingFiles.splice(+b.dataset.i,1);renderAttachments()})}
function fileToData(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res({name:f.name,type:f.type,size:f.size,data:r.result});r.onerror=rej;r.readAsDataURL(f)})}

$('closeChat').onclick=closeChat;$('chatAvatar').onclick=()=>{if(selected.type==='group')openGroupInfo()};$('emojiBtn').onclick=()=>{if($('message').disabled)return;$('message').setRangeText('😊',$('message').selectionStart,$('message').selectionEnd,'end');$('message').focus();resizeComposer()};
$('mobilePeople').onclick=openPeople;$('peopleClose').onclick=e=>{e.preventDefault();e.stopPropagation();closePeople()};$('search').oninput=renderPeople;
document.addEventListener('click',e=>{if(!e.target.closest('.groupMore'))closeMoreMenus();if(document.body.classList.contains('menuOpen')&&!e.target.closest('#peoplePanel')&&!e.target.closest('#mobilePeople'))closePeople()});
$('newGroup').onclick=()=>{buildGroupMembers();$('groupModal').classList.remove('hidden')};$('closeGroup').onclick=()=>$('groupModal').classList.add('hidden');
$('createGroup').onclick=()=>{const name=$('groupName').value.trim(),members=[...$('groupMembers').querySelectorAll('input:checked')].map(x=>x.value);if(!name||!members.length)return;$('createGroup').disabled=true;s.emit('createGroup',{name,members})};
function buildGroupMembers(){const wrap=$('groupMembers');wrap.innerHTML='';people.filter(p=>p.name!==me.name).forEach((p,i)=>{const l=document.createElement('label');l.className='check';l.style.setProperty('--pickerHue',senderHue(p.name));l.innerHTML=`<input type="checkbox" value="${escapeHtml(p.name)}"><span class="pickerAvatar">${escapeHtml(p.name[0].toUpperCase())}</span><span>${escapeHtml(p.name)}</span>`;wrap.append(l)})}

function openGroupInfo(){const g=groups.find(x=>x.id===selected.id);if(!g)return;renderGroupInfo(g);$('groupInfoModal').classList.remove('hidden')}
function renderGroupInfo(g){
 $('groupInfoName').textContent=g.name;$('groupInfoCount').textContent=g.members.length+' members';
 const admin=g.createdBy,adminMode=admin===me.name;$('groupAdminTools').classList.toggle('hidden',!adminMode);$('leaveGroupBtn').classList.toggle('hidden',adminMode);$('groupManageNote').classList.toggle('hidden',!adminMode);if(adminMode)$('groupManageNote').textContent='You are the admin. Only you can add or remove members and rename the group.';
 $('groupInfoMembers').innerHTML='';g.members.forEach(name=>{const p=people.find(x=>x.name===name)||{name,online:false,lastSeen:null};const row=document.createElement('div');row.className='infoMember';row.style.setProperty('--memberHue',senderHue(name));const remove=adminMode&&name!==admin?`<button class="removeMemberBtn" data-remove="${escapeHtml(name)}" title="Remove member">Remove</button>`:'';row.innerHTML=`<span class="avatar infoAvatar">${escapeHtml(name[0].toUpperCase())}</span><span class="infoMemberText"><b>${escapeHtml(name)} ${name===admin?'<em>ADMIN</em>':''}</b><small class="${p.online?'onlineText':''}">${p.online?'Online':'Offline · '+timeSince(p.lastSeen)}</small></span>${remove}`;$('groupInfoMembers').append(row)});
 $('groupInfoMembers').querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>{btn.disabled=true;s.emit('removeGroupMembers',{id:g.id,members:[btn.dataset.remove]})});
}
$('closeGroupInfo').onclick=()=>{$('groupInfoModal').classList.add('hidden');$('addMembersPicker').classList.add('hidden');$('saveAddMembers').classList.add('hidden')};
$('addMembersBtn').onclick=()=>{const g=groups.find(x=>x.id===selected.id);if(!g)return;const existing=new Set(g.membersLower||g.members.map(x=>x.toLowerCase()));const wrap=$('addMembersPicker');wrap.innerHTML='';people.filter(p=>p.name!==me.name&&!existing.has(p.name.toLowerCase())).forEach(p=>{const l=document.createElement('label');l.className='check';l.style.setProperty('--pickerHue',senderHue(p.name));l.innerHTML=`<input type="checkbox" value="${escapeHtml(p.name)}"><span class="pickerAvatar">${escapeHtml(p.name[0].toUpperCase())}</span><span>${escapeHtml(p.name)}</span>`;wrap.append(l)});wrap.classList.toggle('hidden',false);$('saveAddMembers').classList.remove('hidden')};
$('saveAddMembers').onclick=()=>{const members=[...$('addMembersPicker').querySelectorAll('input:checked')].map(x=>x.value),g=groups.find(x=>x.id===selected.id);if(!g||!members.length)return;$('saveAddMembers').disabled=true;s.emit('addGroupMembers',{id:g.id,members})};
$('leaveGroupBtn').onclick=()=>{if(selected.type==='group'){s.emit('leaveGroup',{id:selected.id});$('groupInfoModal').classList.add('hidden')}};

function clearGroupTyping(){groupTyping.clear();for(const t of groupTypingTimers.values())clearTimeout(t);groupTypingTimers.clear();$('typing').innerHTML=''}
function renderGroupTyping(){const names=[...groupTyping.values()];$('typing').innerHTML=names.map(n=>`<div class="typingPerson"><span class="typingDots"><i></i><i></i><i></i></span><span>${escapeHtml(n)} is typing…</span></div>`).join('')}

s.on('directHistory',d=>{if(selected.type==='direct'&&selected.name===d.with){renderMessages(d.messages);s.emit('markSeen',{with:d.with})}});
s.on('groupHistory',d=>{if(selected.type==='group'&&selected.id===d.group.id){groups=groups.map(g=>g.id===d.group.id?d.group:g);renderMessages(d.messages)}});
s.on('directMessage',m=>{if(m.from===me.name||m.to===me.name){if(selected.type==='direct'&&((m.from===me.name&&m.to===selected.name)||(m.to===me.name&&m.from===selected.name))){addMessage(m);scroll();if(m.to===me.name)s.emit('markSeen',{with:m.from})}else if(m.to===me.name)bumpUnread('direct',m.from)}});
s.on('groupMessage',m=>{const g=groups.find(x=>x.id===m.groupId);if(selected.type==='group'&&selected.id===m.groupId){addMessage(m);scroll()}else if(g&&m.from!==me.name)bumpUnread('group',m.groupId)});
s.on('messageStatus',d=>refreshMessage(d.id,el=>{if(!el.classList.contains('mine'))return;const sm=el.querySelector('small');if(sm){let t=sm.querySelector('.messageTicks');if(!t){t=document.createElement('span');t.className='messageTicks';sm.append(t)}t.textContent=d.status==='sent'?'✓':'✓✓';t.classList.toggle('seen',d.status==='seen');t.title=d.status}}));
s.on('messageEdited',d=>refreshMessage(d.id,el=>{const b=el.querySelector('.bubble');if(b)b.textContent=d.text;const sm=el.querySelector('small');if(sm&&!sm.textContent.includes('edited'))sm.textContent+=' · edited'}));
s.on('messageUnsent',d=>refreshMessage(d.id,el=>{el.querySelector('.messageContent').innerHTML='<div class="bubble unsent">Message unsent</div>'}));

s.on('groupCreated',g=>{if(!groups.some(x=>x.id===g.id))groups.unshift(g);renderGroups();if(g.createdBy===me.name){$('groupModal').classList.add('hidden');$('groupName').value='';$('createGroup').disabled=false;openGroup(g)}});
s.on('groupUpdated',g=>{groups=groups.map(x=>x.id===g.id?g:x);renderGroups();if(selected.type==='group'&&selected.id===g.id){selected.name=g.name;$('chatName').textContent=g.name;$('chatStatus').textContent=g.members.length+' members';if($('groupInfoModal')&&!$('groupInfoModal').classList.contains('hidden'))renderGroupInfo(g)}});
s.on('groupRenamed',g=>{groups=groups.map(x=>x.id===g.id?g:x);renderGroups();if(selected.type==='group'&&selected.id===g.id){selected.name=g.name;$('chatName').textContent=g.name;if(!$('groupInfoModal').classList.contains('hidden'))renderGroupInfo(g)}});
s.on('groupActivity',m=>{if(selected.type==='group'&&selected.id===m.groupId){addSystemMessage(m);scroll()}});
s.on('groupDeleted',id=>{groups=groups.filter(g=>g.id!==id);if(selected.type==='group'&&selected.id===id)closeChat();renderGroups();$('groupInfoModal').classList.add('hidden')});
s.on('groupLeft',d=>{groups=groups.filter(g=>g.id!==d.id);if(selected.type==='group'&&selected.id===d.id)closeChat();renderGroups()});
s.on('groupError',m=>{alert(m);$('createGroup').disabled=false;$('saveAddMembers').disabled=false});

s.on('people',a=>{people=a;renderPeople();renderGroups();if(selected.type==='direct'){const p=a.find(x=>x.name===selected.name);if(p)setDirectStatus(p)}if(selected.type==='group'&&!$('groupInfoModal').classList.contains('hidden')){const g=groups.find(x=>x.id===selected.id);if(g)renderGroupInfo(g)}});
s.on('typing',p=>{if(selected.type==='direct'&&p.from===selected.name){$('typing').innerHTML=`<div class="typingPerson"><span class="typingDots"><i></i><i></i><i></i></span><span>${escapeHtml(p.from)} is typing…</span></div>`;clearTimeout(window.__directTyping);window.__directTyping=setTimeout(()=>{$('typing').innerHTML=''},1400)}});
s.on('stopTyping',p=>{if(selected.type==='direct'&&p.from===selected.name)$('typing').innerHTML=''});
s.on('groupTyping',p=>{if(selected.type==='group'&&p.groupId===selected.id&&p.from!==me.name){groupTyping.add(p.from);renderGroupTyping();clearTimeout(groupTypingTimers.get(p.from));groupTypingTimers.set(p.from,setTimeout(()=>{groupTyping.delete(p.from);groupTypingTimers.delete(p.from);renderGroupTyping()},1500))}});
s.on('groupStopTyping',p=>{if(selected.type==='group'&&p.groupId===selected.id){groupTyping.delete(p.from);clearTimeout(groupTypingTimers.get(p.from));groupTypingTimers.delete(p.from);renderGroupTyping()}});

function startHeartbeat(){clearInterval(window.__hb);window.__hb=setInterval(()=>{if(me&&s.connected&&document.visibilityState==='visible')s.emit('heartbeat')},15000)}
function announceActive(){if(!me)return;if(!s.connected){s.connect();return}s.emit('presence',{visible:true});setMyStatus('Online');if(selected.type==='direct'){const p=people.find(x=>x.name===selected.name);if(p)setDirectStatus({...p,online:true,lastSeen:Date.now()})}}
document.addEventListener('visibilitychange',()=>{if(!me)return;if(document.visibilityState==='visible')announceActive();else{s.emit('presence',{visible:false});setMyStatus('Away')}});
window.addEventListener('focus',announceActive);window.addEventListener('pageshow',announceActive);
s.on('connect',()=>{const session=loadSession();if(me&&session?.name&&session?.pin)s.emit('login',{name:session.name,pin:session.pin})});
window.addEventListener('beforeunload',()=>{if(me&&s.connected)s.emit('presence',{visible:false})});
function performLogout(){s.emit('logout');localStorage.removeItem(SESSION);window.__loginPin='';me=null;selected={type:null,id:null,name:null};clearInterval(window.__hb);pendingFiles=[];editingId=null;$('profileMenu').classList.add('hidden');$('app').classList.add('hidden');$('auth').classList.remove('hidden');$('authName').value='';$('authPin').value='';$('authCode').value='';$('authError').textContent='';authMode='login';updateAuth();$('authName').focus()}
$('logout').onclick=performLogout;$('profileLogout').onclick=e=>{e.stopPropagation();performLogout()};$('profileBtn').onclick=e=>{e.stopPropagation();$('profileMenu').classList.toggle('hidden')};document.addEventListener('click',e=>{if(!e.target.closest('.meProfile'))$('profileMenu').classList.add('hidden')});
const old=loadSession();if(old?.name&&old?.pin){window.__loginPin=old.pin;s.emit('login',{name:old.name,pin:old.pin})}
