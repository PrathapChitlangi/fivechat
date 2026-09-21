const s = io();
const $ = id => document.getElementById(id);
let me = null, people = [], groups = [], connections = [], chatRequests = {incoming:[],outgoing:[]}, selected = {type:null,id:null,name:null};
let currentMessages=[], currentSettings=null, replyToMessage=null, firstUnreadId=null, openingUnreadCount=0;
const DRAFT_PREFIX='fivechat_draft_';
let authMode = 'login', typingTimer = null, typingActive = false, typingLastSent = 0, pendingFiles = [], editingId = null, logoutInProgress = false, authRequestId = 0, longPressTimer = null;
const unread = Object.create(null);
const SESSION = 'fivechat_v58_session';
const ACTIVITY_KEY='fivechat_last_activity';
let inactivityTimer=null;
const typingUsers = new Map();
const PUSH_PREF_KEY='fivechat_notifications_enabled';
let pushSubscription=null;
let notificationEnabled=localStorage.getItem(PUSH_PREF_KEY)==='true';
function updateNotificationLabel(on,loading=false){const btn=$('profileNotifications'),label=$('notificationLabel'),state=$('notificationState');if(label)label.textContent=`Notifications: ${on?'On':'Off'}`;if(state)state.textContent=loading?'Enabling…':on?'Push alerts enabled':'Tap to enable';if(btn){btn.classList.toggle('isOn',!!on);btn.classList.toggle('isLoading',!!loading);btn.setAttribute('aria-pressed',on?'true':'false');btn.setAttribute('aria-busy',loading?'true':'false')}}
function urlBase64ToUint8Array(base64){const pad='='.repeat((4-base64.length%4)%4),raw=atob((base64+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function setupPushNotifications(){if(!me||!('serviceWorker' in navigator)||!('PushManager' in window)||!window.isSecureContext)return false;try{const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});await reg.update();if(Notification.permission!=='granted'){if(Notification.permission==='default'){const permission=await Notification.requestPermission();if(permission!=='granted')return false}else return false}let sub=await reg.pushManager.getSubscription();if(!sub){const key=await fetch('/api/push/public-key').then(r=>r.ok?r.text():'');if(!key)return false;sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key)})}pushSubscription=sub;s.emit('pushSubscribe',{subscription:sub.toJSON(),notificationsEnabled:true,visible:document.visibilityState==='visible'&&document.hasFocus(),activeChat:selected.type==='direct'?{type:'direct',name:selected.name}:selected.type==='group'?{type:'group',id:selected.id}:null});sendPushActivity();return true}catch(e){console.warn('Push setup unavailable',e);return false}}
function sendPushActivity(){if(!pushSubscription||!me)return;const activeChat=selected.type==='direct'?{type:'direct',name:selected.name}:selected.type==='group'?{type:'group',id:selected.id}:null;s.emit('pushActivity',{endpoint:pushSubscription.endpoint,visible:document.visibilityState==='visible'&&document.hasFocus(),activeChat})}
function refreshPushActivity(){if(pushSubscription&&me&&s.connected)sendPushActivity()}
window.addEventListener('visibilitychange',refreshPushActivity);window.addEventListener('pageshow',refreshPushActivity);window.addEventListener('focus',refreshPushActivity);
async function updateNotificationSetting(){if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){showToast('Browser notifications are not supported here');return}const next=!notificationEnabled;notificationEnabled=next;localStorage.setItem(PUSH_PREF_KEY,String(next));updateNotificationLabel(next,next);if(s.connected&&pushSubscription)s.emit('pushPreference',{endpoint:pushSubscription.endpoint,enabled:next});if(!next){updateNotificationLabel(false,false);showToast('Notifications off');return}if(pushSubscription){updateNotificationLabel(true,false);showToast('Notifications on');return}const ok=await setupPushNotifications();if(ok){updateNotificationLabel(true,false);showToast('Notifications on')}else{notificationEnabled=false;localStorage.setItem(PUSH_PREF_KEY,'false');if(s.connected&&pushSubscription)s.emit('pushPreference',{endpoint:pushSubscription.endpoint,enabled:false});updateNotificationLabel(false,false);showToast('Notifications could not be enabled')}}

const UNREAD_CACHE='fivechat_unread_cache';
function saveUnread(){try{localStorage.setItem(UNREAD_CACHE,JSON.stringify(unread))}catch{}}
function loadUnread(){try{const d=JSON.parse(localStorage.getItem(UNREAD_CACHE)||'{}');for(const [k,v] of Object.entries(d||{}))unread[k]=Number(v)||0}catch{}}
function renderUnreadSummary(){const total=Object.values(unread).reduce((a,b)=>a+(Number(b)||0),0);const el=$('unreadTotal');if(el){el.textContent=total>99?'99+':String(total);el.classList.toggle('hidden',total<=0)}}
loadUnread();
function saveSession(){ if(me) localStorage.setItem(SESSION, JSON.stringify({name:me.name,token:window.__sessionToken||''})); localStorage.setItem(ACTIVITY_KEY,String(Date.now())); }
function loadSession(){ try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null} }
// Login state is intentionally persistent. Chat messages still expire server-side after 24 hours.
function touchActivity(){ if(me) localStorage.setItem(ACTIVITY_KEY,String(Date.now())); }
function startInactivityWatch(){ touchActivity(); }
function expireInactiveSession(){}

function escapeHtml(x){return String(x).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function timeSince(t){if(!t)return'Unknown';const sec=Math.max(0,Math.floor((Date.now()-Number(t))/1000));if(sec<10)return'just now';if(sec<60)return`${sec}s ago`;const m=Math.floor(sec/60);if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;const d=Math.floor(h/24);if(d<7)return`${d}d ago`;return new Date(t).toLocaleDateString([],{day:'2-digit',month:'short',year:'numeric'})}
function lastSeenTitle(t){return t?new Date(Number(t)).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'Last seen time unavailable'}
function senderHue(name){let h=0;for(const c of String(name||''))h=(h*31+c.charCodeAt(0))%360;return h}
function unreadKey(t,id){return `${t}:${String(id).toLowerCase()}`}
function unreadFor(t,id){return unread[unreadKey(t,id)]||0}
function updateAppBadge(){const n=Object.values(unread).reduce((a,b)=>a+(Number(b)||0),0);if(currentSettings?.notifications?.badge===false)return navigator.clearAppBadge?.();navigator.setAppBadge?.(n).catch?.(()=>{})}
function bumpUnread(t,id){const k=unreadKey(t,id);unread[k]=(unread[k]||0)+1;saveUnread();updateAppBadge();renderPeople();renderGroups();showUnreadPulse(t,id);showToast('New message received')}
function clearUnread(t,id){delete unread[unreadKey(t,id)];saveUnread();renderPeople();renderGroups()}
function applyUnreadFromServer(data){Object.keys(unread).forEach(k=>delete unread[k]);for(const [k,n] of Object.entries(data?.direct||{}))unread[k.startsWith('direct:')?k:`direct:${k}`]=Number(n)||0;for(const [k,n] of Object.entries(data?.group||{}))unread[`group:${k}`]=Number(n)||0;if(me){saveUnread();updateAppBadge();renderPeople();renderGroups()}}
function showUnreadPulse(t,id){const k=unreadKey(t,id);requestAnimationFrame(()=>{document.querySelectorAll(`[data-unread-key="${CSS.escape(k)}"]`).forEach(x=>{x.classList.remove('unreadPulse');void x.offsetWidth;x.classList.add('unreadPulse')})})}
function isChatVisible(){return document.visibilityState==='visible'&&document.hasFocus()}
function isConnectedTo(name){return connections.some(x=>String(x).toLowerCase()===String(name).toLowerCase())}
function outgoingRequest(name){return chatRequests.outgoing.find(r=>String(r.to||'').toLowerCase()===String(name).toLowerCase())}
function incomingRequest(name){return chatRequests.incoming.find(r=>r.from.toLowerCase()===String(name).toLowerCase())}
function requestCount(){return chatRequests.incoming.length}
function renderRequestBadge(){const el=$('requestCount');if(!el)return;const n=requestCount();el.textContent=n>99?'99+':String(n);el.classList.toggle('hidden',n===0)}
function refreshRequestUI(){renderRequestBadge();renderPeople()}
function openChatRequestModal(){renderRequestModal();$('chatRequestModal').classList.remove('hidden');requestAnimationFrame(()=>$('chatRequestModal').classList.add('modalVisible'))}
function closeChatRequestModal(){$('chatRequestModal').classList.remove('modalVisible');setTimeout(()=>$('chatRequestModal').classList.add('hidden'),170)}
function renderRequestModal(){const box=$('chatRequestList');if(!box)return;const inc=chatRequests.incoming||[],out=chatRequests.outgoing||[];let html='';if(inc.length)html+='<div class="requestSectionTitle">Incoming requests</div>'+inc.map(r=>`<div class="requestRow"><span class="avatar requestAvatar" style="--avatarHue:${senderHue(r.from)}">${escapeHtml(r.from[0].toUpperCase())}</span><div class="requestText"><b>${escapeHtml(r.from)}</b><small>Wants to connect with you</small></div><div class="requestActions"><button type="button" data-accept-request="${escapeHtml(r.id)}">Accept</button><button type="button" class="secondary" data-decline-request="${escapeHtml(r.id)}">Decline</button></div></div>`).join('');if(out.length)html+='<div class="requestSectionTitle">Sent requests</div>'+out.map(r=>`<div class="requestRow"><span class="avatar requestAvatar" style="--avatarHue:${senderHue(r.to)}">${escapeHtml(r.to[0].toUpperCase())}</span><div class="requestText"><b>${escapeHtml(r.to)}</b><small>Request pending</small></div><div class="requestActions"><button type="button" class="secondary" data-cancel-request="${escapeHtml(r.id)}">Cancel</button></div></div>`).join('');if(!html)html='<div class="requestEmpty"><div>✦</div><b>No pending requests</b><small>New connection requests will appear here.</small></div>';box.innerHTML=html}


function showApp(){
  $('auth').classList.add('hidden'); $('app').classList.remove('hidden');
  const initial=me.name[0].toUpperCase();
  $('meName').textContent=me.name; $('meAvatar').textContent=initial; $('profileName').textContent=me.name; $('profileAvatar').textContent=initial;
  $('myStatus').textContent='Online'; $('profileStatus').textContent='Online'; renderUnreadSummary(); closePeople();
}
function updateAuth(){
  const create=authMode==='create';
  $('createFields').classList.toggle('hidden',!create);
  $('authTitle').textContent=create?'Create your FiveChat account':'Log in to FiveChat';
  $('authText').textContent=create?'':'Use your account name and PIN to continue.';
  $('authBtn').innerHTML=create?'Sign up <span>→</span>':'Log in <span>→</span>';
  $('switchAuth').innerHTML=create?'Already have an account? <b>Log in</b>':'Don’t have an account? <b>Sign up</b>';
  $('auth').classList.toggle('createMode',create);$('authPin').placeholder=create?'Create 4 digits PIN':'Enter your PIN';$('authPin').previousElementSibling.textContent='';$('authPin').previousElementSibling.classList.remove('loginPinLabel');
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
(function addRecoveryLink(){const card=$('authCard');if(!card||$('forgotPinBtn'))return;const b=document.createElement('button');b.id='forgotPinBtn';b.type='button';b.className='authLinkBtn';b.textContent='Forgot PIN?';card.appendChild(b);b.onclick=()=>{const name=prompt('Enter your FiveChat name');if(!name)return;const code=prompt('Enter the account recovery access code');if(!code)return;const next=prompt('Create a new 4-digit PIN');if(!/^\d{4}$/.test(next||''))return showToast('PIN must be exactly 4 digits');s.emit('forgotPin',{name,accessCode:code,newPin:next},r=>showToast(r?.ok?'PIN changed. Please log in again.':(r?.error||'Recovery failed')))}})();
renderUnreadSummary();

s.on('accountCreated',d=>{authMode='login';updateAuth();$('authName').value=d.name;$('authPin').value='';$('authCode').value='';$('authError').innerHTML='<span class="successAlert">✓ Account created. Log in now.</span>';$('authPin').focus()});
s.on('authError',m=>{$('authError').textContent=m;$('authCard').classList.remove('shake');void $('authCard').offsetWidth;$('authCard').classList.add('shake')});
s.on('loggedIn',d=>{
  if(logoutInProgress)return;
  window.__sessionToken=d.sessionToken||window.__sessionToken||'';
  me=d.user; people=d.people||[]; groups=d.groups||[]; connections=(d.connections||[]).map(x=>String(x).toLowerCase()); chatRequests=d.requests||{incoming:[],outgoing:[]}; applyUnreadFromServer(d.unread); saveSession(); showApp(); s.emit('getSettings',{},r=>{currentSettings=r?.settings||currentSettings;applyTheme(currentSettings?.theme)}); renderRequestBadge(); renderPeople(); renderGroups(); const inviteToken=new URLSearchParams(location.search).get('groupInvite'); if(inviteToken){s.emit('joinGroupInvite',{token:inviteToken},r=>{if(r?.pending)showToast('Join request sent to group admins');else if(r?.ok)showToast(r.already?'Already in group':'Joined group');history.replaceState({},'',location.pathname)})} welcome(); startInactivityWatch(); updateNotificationLabel(notificationEnabled,false);
  s.emit('presence',{visible:true}); startHeartbeat(); if(notificationEnabled)setupPushNotifications();
});

function renderPeople(){
  if(!me)return;
  const q=$('search').value.toLowerCase();
  const arr=people.filter(p=>p.nameLower!==me.name.toLowerCase()&&p.name.toLowerCase().includes(q)).sort((a,b)=>Number(b.online)-Number(a.online)||a.name.localeCompare(b.name));
  $('peopleList').innerHTML='';
  arr.forEach(p=>{
    const li=document.createElement('li'); li.className='person '+(selected.type==='direct'&&selected.name===p.name?'selected':'');
    const count=unreadFor('direct',p.name), badge=count>99?'99+':count, connected=isConnectedTo(p.name), pending=outgoingRequest(p.name), incoming=incomingRequest(p.name);
    const status=p.online?'Online':`Offline · ${timeSince(p.lastSeen)}`;
    const action=connected?`<button class="personChatAction" type="button">Chat</button>`:pending?`<button class="personChatAction pending" type="button">Pending</button>`:incoming?`<button class="personChatAction accept" type="button">Accept</button>`:`<button class="personChatAction request" type="button">＋ Connect</button>`;
    li.innerHTML=`<span class="avatar personAvatar" style="--avatarHue:${senderHue(p.name)}${p.avatar?`;background-image:url('${escapeHtml(p.avatar)}');background-size:cover;background-position:center;color:transparent`:''}">${escapeHtml(p.name[0].toUpperCase())}</span><span class="personText"><b>${escapeHtml(p.name)}</b><small class="statusLine ${p.online?'onlineStatus':'offlineStatus'}" title="${escapeHtml(p.online?'Online now':lastSeenTitle(p.lastSeen))}"><i class="statusIndicator ${p.online?'isOnline':'isOffline'}"></i>${status}</small></span>${count?`<b class="unread" data-unread-key="${escapeHtml(unreadKey('direct',p.name))}" aria-label="${count} unread messages">${badge}</b>`:''}${action}`;
    li.onclick=()=>{if(connected)openDirect(p);else if(incoming){acceptRequest(incoming.id)}else if(!pending)sendRequest(p.name)};
    li.querySelector('.personChatAction')?.addEventListener('click',e=>{e.stopPropagation();if(connected)openDirect(p);else if(incoming)acceptRequest(incoming.id);else if(!pending)sendRequest(p.name)});
    $('peopleList').append(li);
  });
  $('onlineCount').textContent=arr.filter(p=>p.online).length+' online'; renderUnreadSummary(); renderRequestBadge();
}
function sendRequest(name){const btn=[...document.querySelectorAll('.personChatAction')].find(x=>x.parentElement?.querySelector('.personText b')?.textContent===name);if(btn){btn.disabled=true;btn.textContent='Sending…'}s.emit('sendChatRequest',{to:name},result=>{if(result?.ok){chatRequests.outgoing.unshift(result.request);showToast(`Chat request sent to ${name}`);refreshRequestUI()}else{if(btn){btn.disabled=false;btn.textContent='＋ Connect'}showToast(result?.error||'Could not send request')}})}
function acceptRequest(id){s.emit('acceptChatRequest',{id},result=>{if(result?.ok){chatRequests.incoming=chatRequests.incoming.filter(r=>r.id!==id);if(result.request){const other=result.request.fromLower===me.name.toLowerCase()?result.request.to:result.request.from;connections=[...new Set([...connections,String(other).toLowerCase()])]}renderRequestModal();refreshRequestUI();showToast('Connection accepted')}else showToast(result?.error||'Could not accept request')})}
function declineRequest(id){s.emit('declineChatRequest',{id},result=>{if(result?.ok){chatRequests.incoming=chatRequests.incoming.filter(r=>r.id!==id);renderRequestModal();refreshRequestUI();showToast('Request declined')}else showToast(result?.error||'Could not decline request')})}
function cancelRequest(id){s.emit('cancelChatRequest',{id},result=>{if(result?.ok){chatRequests.outgoing=chatRequests.outgoing.filter(r=>r.id!==id);renderRequestModal();refreshRequestUI();showToast('Request cancelled')}else showToast(result?.error||'Could not cancel request')})}
function groupAdmins(g){return Array.isArray(g?.admins)&&g.admins.length?g.admins:[g?.createdBy].filter(Boolean)}
function isGroupAdmin(g,name=me?.name){return groupAdmins(g).some(x=>String(x).toLowerCase()===String(name).toLowerCase())}
function isMainGroupAdmin(g,name=me?.name){return !!g&&g.createdBy?.toLowerCase()===String(name).toLowerCase()}
function renderGroups(){
  if(!me)return; $('groupList').innerHTML='';
  groups.forEach(g=>{
    const li=document.createElement('li'); li.className='person groupRow '+(selected.type==='group'&&selected.id===g.id?'selected':'');
    const count=unreadFor('group',g.id), badge=count>99?'99+':count;
    li.innerHTML=`<span class="avatar groupAvatar">👥</span><span class="personText"><b>${escapeHtml(g.name)}</b><small>${g.members.length} members</small></span>${count?`<b class="unread" data-unread-key="${escapeHtml(unreadKey('group',g.id))}" aria-label="${count} unread messages">${badge}</b>`:''}`;
    li.onclick=()=>openGroup(g);
    $('groupList').append(li);
  });
}
function showGroupMenu(g,anchor){
  closeMoreMenus();
  const admin=isGroupAdmin(g),main=isMainGroupAdmin(g);
  const menu=document.createElement('div'); menu.className='groupMoreMenu floatingGroupMenu';
  menu.innerHTML=`<button type="button" data-info><span>ⓘ</span> Group info</button>${admin?'<button type="button" data-rename><span>✎</span> Rename group</button>':''}${!main?'<button type="button" data-leave><span>↗</span> Exit group</button>':''}${admin?'<button type="button" data-delete class="dangerOption"><span>⌫</span> Delete group</button>':''}`;
  document.body.append(menu);
  const r=anchor.getBoundingClientRect(),mw=190,mh=menu.offsetHeight||180;
  let left=Math.min(r.right-mw,innerWidth-mw-10); left=Math.max(10,left);
  let top=r.top-mh-7; if(top<10)top=r.bottom+7; if(top+mh>innerHeight-10)top=Math.max(10,innerHeight-mh-10);
  menu.style.left=left+'px';menu.style.top=top+'px';
  const action=(sel,fn)=>{const el=menu.querySelector(sel);if(el)el.onclick=e=>{e.preventDefault();e.stopPropagation();closeMoreMenus();fn()}};
  action('[data-info]',()=>{openGroup(g);requestAnimationFrame(()=>{if(selected.type==='group'){$('groupInfoPanel').classList.remove('hidden');renderGroupInfo(g)}})});
  action('[data-rename]',()=>openRenameGroup(g));
  action('[data-leave]',()=>openLeaveConfirm(g));
  action('[data-delete]',()=>openDeleteGroupConfirm(g));
}
function closeMoreMenus(){document.querySelectorAll('.floatingGroupMenu,.memberActionMenu').forEach(x=>x.remove())}

function openMemberActions(g,name,anchor){
  document.querySelectorAll('.memberActionMenu').forEach(x=>x.remove());
  if(name.toLowerCase()===me.name.toLowerCase())return;
  const targetIsMain=name.toLowerCase()===g.createdBy.toLowerCase(), targetAdmin=isGroupAdmin(g,name), meMain=isMainGroupAdmin(g);
  const menu=document.createElement('div');menu.className='memberActionMenu';
  let buttons='<button type="button" data-add-people><span>＋</span> Add people</button>';
  if(isGroupAdmin(g)){
    if(meMain && !targetIsMain && !targetAdmin) buttons+='<button type="button" data-make-admin><span>★</span> Make admin</button>';
    if(meMain && !targetIsMain && targetAdmin) buttons+='<button type="button" data-remove-admin><span>☆</span> Remove admin</button>';
    if(!targetIsMain && (!targetAdmin || meMain)) buttons+='<button type="button" data-remove-member class="dangerOption"><span>−</span> Remove member</button>';
  }
  menu.innerHTML=buttons;
  document.body.append(menu);
  const r=anchor.getBoundingClientRect(),mw=205,mh=menu.offsetHeight||55;let left=Math.min(r.right-mw,innerWidth-mw-10);left=Math.max(10,left);let top=r.bottom+6;if(top+mh>innerHeight-10)top=r.top-mh-6;if(top<10)top=10;menu.style.left=left+'px';menu.style.top=top+'px';
  const doAction=(sel,fn)=>{const el=menu.querySelector(sel);if(el)el.onclick=e=>{e.preventDefault();e.stopPropagation();menu.remove();fn()}};
  doAction('[data-add-people]',()=>{buildAddMembers(g);$('memberModal').classList.remove('hidden')});
  doAction('[data-make-admin]',()=>{const b=menu; s.emit('makeGroupAdmin',{groupId:g.id,name},result=>{if(result?.ok){groups=groups.map(x=>x.id===g.id?result.group:x);renderGroups();renderGroupInfo(result.group);showToast(`${name} is now an admin`)}else if(result?.error)showToast(result.error)})});
  doAction('[data-remove-admin]',()=>{s.emit('removeGroupAdmin',{groupId:g.id,name},result=>{if(result?.ok){groups=groups.map(x=>x.id===g.id?result.group:x);renderGroups();renderGroupInfo(result.group);showToast(`Admin status removed from ${name}`)}else if(result?.error)showToast(result.error)})});
  doAction('[data-remove-member]',()=>openRemoveMemberConfirm(g,name));
}

function renderGroupInfo(g){
  const admin=isGroupAdmin(g), main=isMainGroupAdmin(g), admins=new Set(groupAdmins(g).map(x=>x.toLowerCase()));
  const memberRows=g.members.map(name=>{const p=people.find(x=>x.nameLower===name.toLowerCase())||{name,online:false,lastSeen:0};const status=p.online?'Online':`Offline · ${timeSince(p.lastSeen)}`;const badges=name.toLowerCase()===g.createdBy.toLowerCase()?'<em>Main admin</em>':admins.has(name.toLowerCase())?'<em>Admin</em>':'';return `<button type="button" class="infoMember ${admin?'memberManageable':''}" data-member-name="${escapeHtml(name)}"><span class="avatar miniAvatar" style="--avatarHue:${senderHue(name)}">${escapeHtml(name[0].toUpperCase())}</span><span class="infoMemberText"><b>${escapeHtml(name)} ${badges}</b><small class="statusLine ${p.online?'onlineText':'offlineText'}" title="${escapeHtml(p.online?'Online now':lastSeenTitle(p.lastSeen))}"><i class="statusIndicator ${p.online?'isOnline':'isOffline'}"></i>${status}</small></span>${name.toLowerCase()===me.name.toLowerCase()?'<span class="youBadge">You</span>':''}</button>`}).join('');
  const addButton='<button class="addMemberBtn" type="button">＋ Add people</button>';
  const adminButtons=admin?`<button class="groupMetaBtn" type="button">✎ Group settings</button><button class="groupInviteBtn" type="button">🔗 Invite link</button><button class="deleteGroupInfoBtn" type="button">⌫ Delete group</button>`:'';
  const leaveButton=main?'':'<button class="leaveGroupBtn" type="button">↗ Exit group</button>';
  const pending=(g.pendingMembers||[]);const pendingHtml=admin&&pending.length?`<div class="pendingJoinBox"><b>Pending join requests</b>${pending.map(n=>`<div class="resultRow"><span>${escapeHtml(n)}</span><button class="secondaryBtn" data-approve-join="${escapeHtml(n)}">Approve</button></div>`).join('')}</div>`:'';
  $('groupInfoPanel').innerHTML=`<div class="infoHeader"><div><span class="overline">GROUP INFO</span><div class="groupInfoTitleRow"><h3>${escapeHtml(g.name)}</h3>${admin?'<button class="groupEditPencil" type="button" aria-label="Edit group name" title="Edit group name">✎</button>':''}</div><small>${g.members.length} members · ${admins.size} admin${admins.size===1?'':'s'}</small>${g.description?`<p class="groupDescription">${escapeHtml(g.description)}</p>`:''}</div><button class="infoClose" type="button">×</button></div>${pendingHtml}<div class="infoMembers">${memberRows}</div><div class="groupInfoActions">${addButton}${adminButtons}${leaveButton}</div>`;
  $('groupInfoPanel').querySelector('.infoClose').onclick=e=>{e.stopPropagation();closeGroupInfo()};
  const add=$('groupInfoPanel').querySelector('.addMemberBtn');if(add)add.onclick=e=>{e.stopPropagation();buildAddMembers(g);$('memberModal').classList.remove('hidden')};
  const edit=$('groupInfoPanel').querySelector('.groupEditPencil');if(edit)edit.onclick=e=>{e.stopPropagation();openRenameGroup(g)};
  const meta=$('groupInfoPanel').querySelector('.groupMetaBtn');if(meta)meta.onclick=()=>{const d=prompt('Group description',g.description||'');if(d===null)return;const avatar=prompt('Group profile picture URL (optional)',g.avatar||'');const approval=confirm('Require admin approval for invite-link joins?');s.emit('updateGroupMeta',{groupId:g.id,description:d,avatar:avatar||'',joinApproval:approval},r=>{if(r?.ok){groups=groups.map(x=>x.id===g.id?r.group:x);renderGroupInfo(r.group);showToast('Group settings updated')}else showToast(r?.error||'Could not update group')})};
  const inv=$('groupInfoPanel').querySelector('.groupInviteBtn');if(inv)inv.onclick=()=>s.emit('createGroupInvite',{groupId:g.id},r=>{if(r?.ok){const link=location.origin+'/?groupInvite='+r.token;navigator.clipboard?.writeText(link).catch(()=>{});showToast('Invite link copied')}else showToast(r?.error||'Could not create invite')});
  $('groupInfoPanel').querySelectorAll('[data-approve-join]').forEach(b=>b.onclick=()=>s.emit('approveGroupJoin',{groupId:g.id,name:b.dataset.approveJoin},r=>{if(r?.ok){groups=groups.map(x=>x.id===g.id?r.group:x);renderGroupInfo(r.group);renderGroups()}}));
  const leave=$('groupInfoPanel').querySelector('.leaveGroupBtn');if(leave)leave.onclick=e=>{e.stopPropagation();openLeaveConfirm(g)};
  const del=$('groupInfoPanel').querySelector('.deleteGroupInfoBtn');if(del)del.onclick=e=>{e.stopPropagation();openDeleteGroupConfirm(g)};
  $('groupInfoPanel').querySelectorAll('[data-member-name]').forEach(row=>row.onclick=e=>{e.stopPropagation();openMemberActions(g,row.dataset.memberName,row)});
}
function buildAddMembers(g){const existing=new Set(g.membersLower||g.members.map(x=>x.toLowerCase()));$('addMembersList').innerHTML='';people.filter(p=>p.nameLower!==me.name.toLowerCase()&&!existing.has(p.nameLower)).forEach(p=>{const l=document.createElement('label');l.className='memberChoice';l.innerHTML=`<input type="checkbox" value="${escapeHtml(p.name)}"><span class="choiceAvatar" style="--choiceHue:${senderHue(p.name)}">${escapeHtml(p.name[0].toUpperCase())}</span><span class="choiceText"><b>${escapeHtml(p.name)}</b><small>${p.online?'Online':'Offline · '+timeSince(p.lastSeen)}</small></span><span class="choiceCheck">✓</span>`;$('addMembersList').append(l)});if(!$('addMembersList').children.length)$('addMembersList').innerHTML='<div class="noPeopleToAdd">Everyone is already in this group.</div>'}
let pendingRemoveMember=null;
function openRemoveMemberConfirm(g,name){pendingRemoveMember={groupId:g.id,name};$('removeMemberText').textContent=`Remove ${name} from ${g.name}? This action will be shared with the group.`;$('removeMemberConfirm').classList.remove('hidden');requestAnimationFrame(()=>$('removeMemberConfirm').classList.add('modalVisible'))}
function closeRemoveConfirm(){$('removeMemberConfirm').classList.remove('modalVisible');setTimeout(()=>{$('removeMemberConfirm').classList.add('hidden');pendingRemoveMember=null},170)}
function openLeaveConfirm(g){$('leaveGroupText').textContent=`Exit ${g.name}? You will no longer receive messages from this group.`;$('leaveGroupConfirm').classList.remove('hidden');requestAnimationFrame(()=>$('leaveGroupConfirm').classList.add('modalVisible'))}
function closeLeaveConfirm(){$('leaveGroupConfirm').classList.remove('modalVisible');setTimeout(()=>$('leaveGroupConfirm').classList.add('hidden'),170)}
let pendingDeleteGroupId=null;
function openDeleteGroupConfirm(g){pendingDeleteGroupId=g.id;$('deleteGroupText').textContent=`Delete ${g.name}? This removes the group and its retained messages for everyone.`;$('deleteGroupConfirm').classList.remove('hidden');requestAnimationFrame(()=>$('deleteGroupConfirm').classList.add('modalVisible'))}
function closeDeleteGroupConfirm(){pendingDeleteGroupId=null;$('deleteGroupConfirm').classList.remove('modalVisible');setTimeout(()=>$('deleteGroupConfirm').classList.add('hidden'),170)}

function welcome(){
  selected={type:null,id:null,name:null}; stopAllTyping(); closeGroupInfo(); closeMoreMenus(); closeDirectInfo();
  $('chatHead').classList.add('homeHidden'); $('chatName').textContent=''; $('chatStatus').textContent=''; $('chatAvatar').textContent='?'; $('chatAvatar').disabled=true;
  $('messages').innerHTML='<div class="welcomeEmpty"><div class="welcomeIcon">✦</div><h2>Welcome to FiveChat</h2><p>Select a person or group from the People panel to start chatting.</p></div>';
  $('composer').classList.add('hidden'); $('closeChat').classList.add('hidden');
}
function enableComposer(){ $('composer').classList.remove('hidden'); $('message').disabled=false;$('send').disabled=false;$('attachBtn').disabled=false;$('emojiBtn').disabled=false;$('closeChat').classList.remove('hidden'); }
function closeDirectInfo(){const el=document.querySelector('.directInfoMenu');if(el)el.remove()}
function showDirectInfo(p,anchor){
  closeDirectInfo(); closeMoreMenus();
  const menu=document.createElement('div'); menu.className='directInfoMenu';
  const status=p.online?'Online':`Offline · ${timeSince(p.lastSeen)}`;
  menu.innerHTML=`<div class="directInfoHead"><span class="avatar directInfoAvatar" style="--avatarHue:${senderHue(p.name)}">${escapeHtml(p.name[0].toUpperCase())}</span><div><b>${escapeHtml(p.name)}</b><small class="${p.online?'isOnlineText':'isOfflineText'}">${status}</small></div><button type="button" class="directInfoClose" aria-label="Close">×</button></div><div class="directInfoMeta">${p.online?'Available now':`Last seen ${lastSeenTitle(p.lastSeen)}`}</div><button type="button" class="clearDirectBtn">⌫ Clear chat history</button><button type="button" class="blockDirectBtn">🚫 Block user</button>`;
  document.body.append(menu);
  const r=anchor.getBoundingClientRect(),mw=Math.min(290,innerWidth-20),mh=menu.offsetHeight||170; let left=Math.min(r.left,innerWidth-mw-10);left=Math.max(10,left);let top=r.bottom+10;if(top+mh>innerHeight-10)top=r.top-mh-10;if(top<10)top=10;menu.style.left=left+'px';menu.style.top=top+'px';
  menu.querySelector('.directInfoClose').onclick=e=>{e.stopPropagation();closeDirectInfo()};
  menu.querySelector('.clearDirectBtn').onclick=e=>{e.stopPropagation();closeDirectInfo();openClearChatConfirm(p.name)};menu.querySelector('.blockDirectBtn').onclick=e=>{e.stopPropagation();closeDirectInfo();if(confirm(`Block ${p.name}? They will no longer be able to connect with you.`)){s.emit('blockUser',{name:p.name},result=>{if(result?.ok){connections=connections.filter(x=>x!==p.name.toLowerCase());showToast(`${p.name} blocked`);closeChat();refreshRequestUI()}else showToast(result?.error||'Could not block user')})}};
}
function openDirect(p){
  if(!isConnectedTo(p.name)){showToast('Accept a chat request before opening this chat');return}
  hideContext();stopAllTyping(); selected={type:'direct',name:p.name}; closeGroupInfo(); openingUnreadCount=unreadFor('direct',p.name); clearUnread('direct',p.name); sendPushActivity(); $('chatHead').classList.remove('homeHidden');
  $('chatName').textContent=p.name;$('chatAvatar').textContent=p.name[0].toUpperCase();$('chatAvatar').disabled=false;$('chatAvatar').dataset.userName=p.name;setDirectStatus(p);
  enableComposer(); loadDraft(); $('messages').innerHTML='<div class="skeletonChat"><i></i><i></i><i></i><i></i><i></i></div>'; closePeople(); s.emit('openDirect',{with:p.name}); if(s.connected)s.emit('markSeen',{with:p.name});
}
function setDirectStatus(p){$('chatStatus').textContent=p.online?'Online':`Offline · ${timeSince(p.lastSeen)}`;$('chatStatus').classList.toggle('statusOnline',!!p.online);$('chatStatus').classList.toggle('statusOffline',!p.online)}
function getGroup(id){return groups.find(g=>g.id===id)}
function openGroup(g){
  hideContext();closeDirectInfo();stopAllTyping(); selected={type:'group',id:g.id,name:g.name}; openingUnreadCount=unreadFor('group',g.id); clearUnread('group',g.id); closeGroupInfo(); sendPushActivity(); $('chatHead').classList.remove('homeHidden');
  $('chatName').textContent=g.name;$('chatAvatar').textContent='👥';$('chatAvatar').disabled=false;$('chatStatus').textContent=`${g.members.length} members`;
  enableComposer(); loadDraft(); $('messages').innerHTML='<div class="skeletonChat"><i></i><i></i><i></i><i></i><i></i></div>'; closePeople(); s.emit('openGroup',{id:g.id}); if(s.connected)s.emit('groupSeen',{groupId:g.id});
}

function chatStorageKey(){return selected.type==='direct'?`${DRAFT_PREFIX}direct:${[me?.name,selected.name].sort().join('::')}`:`${DRAFT_PREFIX}group:${selected.id}`}
function saveDraft(){if(!me||!selected.type)return;try{localStorage.setItem(chatStorageKey(),$('message').value||'')}catch{}}
function loadDraft(){if(!me||!selected.type)return;try{$('message').value=localStorage.getItem(chatStorageKey())||'';resizeComposer()}catch{}}
function clearDraft(){try{localStorage.removeItem(chatStorageKey())}catch{}}
function applyTheme(theme){document.documentElement.dataset.theme=theme||'system';document.body.classList.toggle('compactMode',!!currentSettings?.compact);document.body.dataset.bubble=currentSettings?.bubble||'default';if(currentSettings?.accent)document.documentElement.style.setProperty('--accent',currentSettings.accent)}
function ensureAccountCenter(){
 const card=document.querySelector('#settingsModal .settingsCard');if(!card||document.getElementById('accountCenter'))return;
 const sec=document.createElement('div');sec.id='accountCenter';sec.className='settingsSection accountCenter';sec.innerHTML=`<b>Account & privacy</b>
 <div class="accountGrid"><button id="changePinBtn" class="secondaryBtn">Change PIN</button><button id="sessionsBtn" class="secondaryBtn">Device / sessions</button><button id="logoutAllBtn" class="secondaryBtn">Logout all devices</button><button id="blockedBtn" class="secondaryBtn">Blocked users</button><button id="connectionsBtn" class="secondaryBtn">Connections</button><button id="requestHistoryBtn" class="secondaryBtn">Request history</button><button id="peopleSuggestBtn" class="secondaryBtn">People you may know</button><button id="deleteAccountBtn" class="dangerBtn">Delete account</button></div>
 <div class="privacyExtra"><label>Profile picture URL<input id="profileAvatarUrl" placeholder="https://…"></label><label class="settingCheck"><input id="privacyPhoto" type="checkbox"> Show profile picture</label><label class="settingCheck"><input id="notifySound" type="checkbox"> Notification sound</label><label class="settingCheck"><input id="notifyBrowser" type="checkbox"> Browser/PWA notifications</label><label class="settingCheck"><input id="notifyBadge" type="checkbox"> Notification badge count</label><label class="settingCheck"><input id="notifyMessages" type="checkbox"> Message notifications</label><label class="settingCheck"><input id="notifyRequests" type="checkbox"> Request notifications</label><label class="settingCheck"><input id="notifyGroups" type="checkbox"> Group notifications</label><label class="settingCheck"><input id="notifyMentions" type="checkbox"> Mention notifications</label><label class="settingCheck"><input id="notifyReplies" type="checkbox"> Reply notifications</label><label>Accent color<input id="accentColor" type="color" value="#2563eb"></label><label>Message bubbles<select id="bubbleStyle"><option value="default">Default</option><option value="compact">Compact</option><option value="soft">Soft</option></select></label></div><div id="accountCenterResults" class="accountCenterResults"></div>`;card.appendChild(sec);
 document.getElementById('profileAvatarUrl').value=currentSettings?.profileAvatar||'';document.getElementById('privacyPhoto').checked=currentSettings?.privacy?.profilePhoto!==false;document.getElementById('notifySound').checked=currentSettings?.notifications?.sound!==false;document.getElementById('notifyBrowser').checked=currentSettings?.notifications?.browser!==false;document.getElementById('notifyBadge').checked=currentSettings?.notifications?.badge!==false;document.getElementById('notifyMessages').checked=currentSettings?.notifications?.messages!==false;document.getElementById('notifyRequests').checked=currentSettings?.notifications?.requests!==false;document.getElementById('notifyGroups').checked=currentSettings?.notifications?.groups!==false;document.getElementById('notifyMentions').checked=currentSettings?.notifications?.mentions!==false;document.getElementById('notifyReplies').checked=currentSettings?.notifications?.replies!==false;document.getElementById('accentColor').value=currentSettings?.accent||'#2563eb';document.getElementById('bubbleStyle').value=currentSettings?.bubble||'default';
 document.getElementById('changePinBtn').onclick=()=>{const a=prompt('Current 4-digit PIN'),b=prompt('New 4-digit PIN');if(!a||!b)return;s.emit('changePin',{currentPin:a,newPin:b},r=>{if(r?.ok){window.__sessionToken=r.sessionToken;saveSession();showToast('PIN changed')}else showToast(r?.error||'Could not change PIN')})};
 document.getElementById('sessionsBtn').onclick=()=>s.emit('listSessions',{},r=>{const box=document.getElementById('accountCenterResults');box.innerHTML=(r?.sessions||[]).map(x=>`<div class="resultRow"><b>${escapeHtml(x.device||'Browser')} ${x.current?'· Current':''}</b><small>${escapeHtml(x.userAgent||'')} · ${new Date(x.lastUsedAt).toLocaleString()}</small>${x.current?'':`<button data-session="${escapeHtml(x._id||'')}" class="secondaryBtn">Log out</button>`}</div>`).join('')||'<small>No active sessions.</small>';box.querySelectorAll('[data-session]').forEach(b=>b.onclick=()=>s.emit('logoutSession',{sessionId:b.dataset.session},()=>document.getElementById('sessionsBtn').click()))});
 document.getElementById('logoutAllBtn').onclick=()=>{if(confirm('Log out all other devices?'))s.emit('logoutAllDevices',{},r=>showToast(r?.ok?'Other devices logged out':'Could not log out devices'))};
 document.getElementById('blockedBtn').onclick=()=>s.emit('getBlockedUsers',{},r=>{const box=document.getElementById('accountCenterResults');box.innerHTML='<b>Blocked users</b>'+(r?.users||[]).map(x=>`<div class="resultRow"><span>${escapeHtml(x.target)}</span><button data-unblock="${escapeHtml(x.target)}" class="secondaryBtn">Unblock</button></div>`).join('')||'<small>No blocked users.</small>';box.querySelectorAll('[data-unblock]').forEach(b=>b.onclick=()=>s.emit('unblockUser',{name:b.dataset.unblock},()=>document.getElementById('blockedBtn').click()))});
 document.getElementById('connectionsBtn').onclick=()=>{const box=document.getElementById('accountCenterResults');box.innerHTML='<b>Connected users</b>'+connections.map(n=>{const p=people.find(x=>x.nameLower===n);return `<div class="resultRow"><span>${escapeHtml(p?.name||n)}</span><button data-remove="${escapeHtml(p?.name||n)}" class="secondaryBtn">Remove</button></div>`}).join('')||'<small>No connections.</small>';box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>s.emit('removeConnection',{name:b.dataset.remove},r=>{if(r?.ok){connections=connections.filter(x=>x!==b.dataset.remove.toLowerCase());b.parentElement.remove();renderPeople();showToast('Connection removed')}}))};
 document.getElementById('requestHistoryBtn').onclick=()=>s.emit('requestHistory',{},r=>{const box=document.getElementById('accountCenterResults');box.innerHTML='<b>Request history</b>'+(r?.history||[]).map(x=>`<div class="resultRow"><span>${escapeHtml(x.from===me.name?`To ${x.to}`:`From ${x.from}`)}</span><small>${escapeHtml(x.status)} · ${new Date(x.createdAt).toLocaleString()}</small></div>`).join('')||'<small>No request history.</small>'});
 document.getElementById('peopleSuggestBtn').onclick=()=>s.emit('peopleSuggestions',{},r=>{const box=document.getElementById('accountCenterResults');box.innerHTML='<b>People you may know</b>'+[...(r?.mutual||[]),...(r?.suggested||[])].slice(0,20).map(x=>`<div class="resultRow"><span>${escapeHtml(x.name)}${x.mutualCount?` · ${x.mutualCount} mutual`:''}</span><button data-connect="${escapeHtml(x.name)}" class="secondaryBtn">Connect</button></div>`).join('');box.querySelectorAll('[data-connect]').forEach(b=>b.onclick=()=>sendRequest(b.dataset.connect))});
 document.getElementById('deleteAccountBtn').onclick=()=>{const pin=prompt('Enter your current 4-digit PIN to permanently delete your account');if(pin&&confirm('This permanently deletes your account and retained account data. Continue?'))s.emit('deleteAccount',{pin},r=>{if(r?.ok){localStorage.removeItem(SESSION);location.reload()}else showToast(r?.error||'Could not delete account')})};
}
function openSettings(){s.emit('getSettings',{},r=>{currentSettings=r?.settings||{privacy:{online:true,lastSeen:true,readReceipts:true,requests:'everyone'},theme:'system',compact:false};s.emit('getProfile',{name:me.name},p=>{$('profileBio').value=p?.profile?.bio||'';if(document.getElementById('profileAvatarUrl'))document.getElementById('profileAvatarUrl').value=p?.profile?.avatar||''});$('themeSelect').value=currentSettings.theme||'system';$('privacyOnline').checked=currentSettings.privacy?.online!==false;$('privacyLastSeen').checked=currentSettings.privacy?.lastSeen!==false;$('privacyRead').checked=currentSettings.privacy?.readReceipts!==false;$('requestPrivacy').value=currentSettings.privacy?.requests||'everyone';$('compactMode').checked=!!currentSettings.compact;ensureAccountCenter();applyTheme(currentSettings.theme);$('settingsModal').classList.remove('hidden');requestAnimationFrame(()=>$('settingsModal').classList.add('modalVisible'))})}
function closeSettings(){$('settingsModal').classList.remove('modalVisible');setTimeout(()=>$('settingsModal').classList.add('hidden'),170)}
function openMessageSearch(){if(!selected.type)return;$('messageSearchInput').value='';$('messageSearchResults').innerHTML='<div class="requestEmpty"><b>Search this conversation</b><small>Type a word or phrase.</small></div>';$('searchMessagesModal').classList.remove('hidden');requestAnimationFrame(()=>$('searchMessagesModal').classList.add('modalVisible'));setTimeout(()=>$('messageSearchInput').focus(),80)}
function runMessageSearch(){const q=$('messageSearchInput').value.trim().toLowerCase();if(!q){$('messageSearchResults').innerHTML='';return}const rows=currentMessages.filter(m=>!m.system&&(`${m.text||''} ${m.from||''}`.toLowerCase().includes(q))).slice().reverse();$('messageSearchResults').innerHTML=rows.length?rows.map(m=>`<button class="searchResult" data-search-id="${escapeHtml(m.id)}"><b>${escapeHtml(m.from||'You')}</b><span>${escapeHtml(m.text||'Attachment')}</span><small>${new Date(m.time).toLocaleString()}</small></button>`).join(''):'<div class="requestEmpty"><b>No matches</b><small>Try another word.</small></div>'}
function closeMessageSearch(){$('searchMessagesModal').classList.remove('modalVisible');setTimeout(()=>$('searchMessagesModal').classList.add('hidden'),170)}
async function openSmart(){if(!selected.type)return;const text=$('message').value.trim();if(!text){showToast('Type a message first');return}$('smartResults').innerHTML='<div class="loading">Generating suggestions…</div>';$('smartModal').classList.remove('hidden');requestAnimationFrame(()=>$('smartModal').classList.add('modalVisible'));try{const r=await fetch('/api/ai/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});const d=await r.json();$('smartResults').innerHTML=(d.suggestions||[]).map(x=>`<button class="smartSuggestion">${escapeHtml(x)}</button>`).join('')||'<div class="requestEmpty"><b>No suggestions</b></div>';$('smartResults').dataset.mode=d.mode||'local'}catch{$('smartResults').innerHTML='<div class="requestEmpty"><b>Smart assistant unavailable</b></div>'}}
function closeSmart(){$('smartModal').classList.remove('modalVisible');setTimeout(()=>$('smartModal').classList.add('hidden'),170)}
function toggleChatMute(){if(!selected.type)return;const key=selected.type==='direct'?`direct:${[me.name,selected.name].sort().join('::')}`:`group:${selected.id}`;const muted=$('chatMuteBtn').dataset.muted==='1';s.emit('setChatMute',{chatKey:key,muted:!muted},r=>{if(r?.ok){$('chatMuteBtn').dataset.muted=r.muted?'1':'0';$('chatMuteBtn').textContent=r.muted?'🔕':'🔔';showToast(r.muted?'Chat muted':'Chat unmuted')}})}
function reportCurrent(){if(selected.type!=='direct')return showToast('Open a personal chat to report a user');const reason=prompt('Reason for report?');if(reason===null)return;s.emit('reportUser',{target:selected.name,reason},r=>showToast(r?.ok?'Report submitted':'Could not submit report'))}

function closeChat(){stopAllTyping();saveDraft();pendingFiles=[];renderAttachments();$('message').value='';resizeComposer();$('chatSearchBtn').classList.add('hidden');$('chatMuteBtn').classList.add('hidden');$('smartBtn').disabled=true;welcome()}
function closePeople(){$('peoplePanel').classList.add('closed');document.body.classList.remove('menuOpen')}
function openPeople(){closeGroupInfo();closeMoreMenus();$('peoplePanel').classList.remove('closed');document.body.classList.add('menuOpen')}

function dateLabel(ts){const d=new Date(ts),n=new Date();const a=new Date(d.getFullYear(),d.getMonth(),d.getDate()),b=new Date(n.getFullYear(),n.getMonth(),n.getDate()),days=Math.round((b-a)/86400000);if(days===0)return'Today';if(days===1)return'Yesterday';return d.toLocaleDateString([],{day:'numeric',month:'long',year:'numeric'})}
function renderDateSeparator(ts){const d=document.createElement('div');d.className='dateSeparator';d.innerHTML=`<span>${escapeHtml(dateLabel(ts))}</span>`;$('messages').append(d)}
function renderNewDivider(){const d=document.createElement('div');d.className='newMessagesDivider';d.dataset.newDivider='1';d.innerHTML='<span>New messages</span>';$('messages').append(d)}
function renderMessages(arr){
  currentMessages=Array.isArray(arr)?arr:[]; $('messages').innerHTML=''; firstUnreadId=null;
  if(!arr.length){$('messages').innerHTML='<div class="empty"><div>✦</div><h3>No messages yet</h3><p>Start the conversation.</p></div>'; $('jumpUnread').classList.add('hidden');openingUnreadCount=0;return}
  const unreadCount=openingUnreadCount;let unreadStart=Math.max(0,arr.length-unreadCount);if(unreadCount){for(let i=arr.length-1;i>=0;i--){if(arr[i].system)continue;if(selected.type==='direct'&&arr[i].from===me.name)continue;if(selected.type==='group'&&arr[i].from===me.name)continue;unreadStart=i;break}firstUnreadId=arr[unreadStart]?.id||null}
  let lastDay='';arr.forEach((m,i)=>{const day=dateLabel(m.time);if(day!==lastDay){renderDateSeparator(m.time);lastDay=day}if(firstUnreadId&&m.id===firstUnreadId)renderNewDivider();addMessage(m)});scroll();if(firstUnreadId){$('jumpUnread').classList.remove('hidden');setTimeout(()=>{const el=document.querySelector(`[data-id="${CSS.escape(firstUnreadId)}"]`);if(el)el.scrollIntoView({block:'center'})},30)}else $('jumpUnread').classList.add('hidden');openingUnreadCount=0;
}
function attachmentHtml(a){if(a.type?.startsWith('image/'))return `<div class="attachment imageAttachment"><img src="${a.data}" alt="${escapeHtml(a.name)}"><span>${escapeHtml(a.name)}</span></div>`;return `<a class="attachment fileAttachment" href="${a.data}" download="${escapeHtml(a.name)}"><span>📄</span><span><b>${escapeHtml(a.name)}</b><small>${Math.ceil(a.size/1024)} KB</small></span></a>`}
function linkPreviewHtml(p){if(!p)return'';const u=String(p.url||'');if(!/^https?:\/\//i.test(u))return'';return `<a class="linkPreview" href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer"><div class="linkPreviewText"><b>${escapeHtml(p.title||u)}</b>${p.description?`<span>${escapeHtml(p.description)}</span>`:''}<small>${escapeHtml(new URL(u).hostname)}</small></div>${p.image?`<img src="${escapeHtml(p.image)}" alt="">`:''}</a>`}
function replyHtml(m){if(!m.replyTo)return'';return `<button class="replyQuote" type="button" data-reply-jump="${escapeHtml(m.replyTo.id)}"><b>${escapeHtml(m.replyTo.from||'Message')}</b><span>${escapeHtml(m.replyTo.text||'')}</span></button>`}
function addMessage(m){
  const empty=$('messages').querySelector('.empty,.welcomeEmpty'); if(empty)empty.remove();
  if(m.system){const d=document.createElement('div');d.className='systemMessage';d.dataset.id=m.id;d.innerHTML=`<span class="systemDot">✦</span><span>${escapeHtml(m.text)}</span>`;$('messages').append(d);return;}
  const mine=m.from===me.name,d=document.createElement('div');d.className=`msg ${mine?'mine':'theirs'}${selected.type==='group'?' groupMsg':''}${m.unsent?' unsentMsg':''}`;d.dataset.id=m.id;d.dataset.unsent=m.unsent?'1':'0';d.style.setProperty('--senderHue',senderHue(m.from));
  const sender=selected.type==='group'?`<strong class="sender">${escapeHtml(m.from)}</strong>`:'';const text=m.text?`<div class="bubble">${escapeHtml(m.text)}</div>`:'';const at=(m.attachments||[]).map(attachmentHtml).join('');const tick=mine&&!m.unsent?`<span class="messageTicks ${m.status==='seen'?'seen':''}" title="${m.status||'sent'}">${m.status==='sent'?'✓':'✓✓'}</span>`:'';d.dataset.mine=mine?'1':'0';d.style.alignSelf=mine?'flex-end':'flex-start';
  if(m.unsent){d.innerHTML=`${sender}<div class="messageContent"><div class="bubble unsent">Message deleted</div></div><small>${m.time?new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}</small>`;d.style.cursor='default';$('messages').append(d);return}
  const reactionHtml=Object.entries(m.reactions||{}).map(([e,n])=>`<button class="reactionChip" type="button" data-reaction="${escapeHtml(e)}">${escapeHtml(e)} ${n.length}</button>`).join('');const pin=m.pinned?'<span class="pinMark" title="Pinned">📌</span>':'';d.innerHTML=`${sender}<div class="messageContent">${replyHtml(m)}${text}${at}${linkPreviewHtml(m.linkPreview)}${reactionHtml?`<div class="reactionBar">${reactionHtml}</div>`:''}</div><small>${pin}${new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}${m.edited?' · edited':''}${tick}</small>`;
  attachMessageInteractions(d,m);$('messages').append(d);
}
function refreshMessage(id,fn){const el=[...$('messages').children].find(x=>x.dataset.id===id);if(el)fn(el)}
function addSystemNotice(text){const d=document.createElement('div');d.className='unsentNotice';d.textContent=text;$('messages').append(d);scroll();setTimeout(()=>d.classList.add('show'),10)}
function showToast(text){let t=document.querySelector('.appToast');if(!t){t=document.createElement('div');t.className='appToast';document.body.append(t)}t.textContent=text;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),2600)}
function positionContext(x,y){const menu=$('contextMenu'),w=145,h=84;menu.style.left=Math.max(8,Math.min(x,innerWidth-w-8))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-h-8))+'px';menu.classList.remove('hidden')}
function showContext(e,m){if(m.unsent)return;e?.preventDefault?.();e?.stopPropagation?.();positionContext(e.clientX,e.clientY);const menu=$('contextMenu');menu.dataset.id=m.id;menu.dataset.text=m.text||'';menu.dataset.mine=m.from===me.name?'1':'0';menu.querySelector('[data-action="edit"]').classList.toggle('hidden',m.from!==me.name);menu.querySelector('[data-action="deleteAll"]').classList.toggle('hidden',m.from!==me.name);}
function attachMessageInteractions(el,m){let touchActive=false;el.addEventListener('selectstart',e=>e.preventDefault());el.addEventListener('dragstart',e=>e.preventDefault());el.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();if(!touchActive&&innerWidth>760)showContext(e,m);touchActive=false});el.addEventListener('touchstart',e=>{touchActive=true;if(m.unsent)return;clearTimeout(longPressTimer);const t=e.touches[0];longPressTimer=setTimeout(()=>showContext({clientX:t.clientX,clientY:t.clientY,preventDefault:()=>{},stopPropagation:()=>{}},m),560)},{passive:true});el.addEventListener('touchend',()=>{clearTimeout(longPressTimer);setTimeout(()=>touchActive=false,80)},{passive:true});el.addEventListener('touchmove',()=>clearTimeout(longPressTimer),{passive:true});el.addEventListener('contextmenu',e=>e.preventDefault());}

function hideContext(){clearTimeout(longPressTimer);$('contextMenu').classList.add('hidden')}
$('contextMenu').onclick=async e=>{const action=e.target.closest('[data-action]')?.dataset.action,id=$('contextMenu').dataset.id;if(!action||!id)return;const el=[...$('messages').children].find(x=>x.dataset.id===id);if(el?.dataset.unsent==='1'){hideContext();return}const text=el?.querySelector('.bubble')?.textContent||$('contextMenu').dataset.text||'';const m=currentMessages.find(x=>x.id===id)||{id,text,from:el?.dataset.mine==='1'?me.name:''};if(action==='edit'){editingId=id;$('message').value=text;resizeComposer();$('message').focus()}else if(action==='deleteAll'){s.emit('deleteForEveryone',{id},r=>showToast(r?.ok?'Deleted for everyone':(r?.error||'Could not delete message')))}else if(action==='deleteMe'){s.emit('deleteForMe',{id},r=>{if(r?.ok){refreshMessage(id,x=>x.remove());currentMessages=currentMessages.filter(x=>x.id!==id);showToast('Deleted for you')}else showToast(r?.error||'Could not delete message')})}else if(action==='reply'){replyToMessage=m;renderReplyBar();$('message').focus();resizeComposer()}else if(action==='react'){const emoji=prompt('Enter one emoji to react');if(emoji)s.emit('reactMessage',{id,emoji:emoji.trim().slice(0,2)})}else if(action==='copy'){try{await navigator.clipboard.writeText(text);showToast('Message copied')}catch{showToast('Copy is unavailable in this browser')}}else if(action==='forward'){const names=people.filter(p=>p.nameLower!==me.name.toLowerCase()).map(p=>p.name).join(', ');const to=prompt(`Forward to one of these connected people:
${names}`,'');if(to)s.emit('forwardMessage',{id,to},r=>showToast(r?.ok?`Forwarded to ${to}`:(r?.error||'Could not forward message')))}else if(action==='pin'){s.emit('pinMessage',{id},r=>showToast(r?.ok?(r.pinned?'Message pinned':'Message unpinned'):(r?.error||'Could not pin message')))}hideContext()};
function renderReplyBar(){let bar=$('replyBar');if(!bar){bar=document.createElement('div');bar.id='replyBar';bar.className='replyBar';$('composer').prepend(bar)}if(!replyToMessage){bar.remove();return}bar.innerHTML=`<div><b>Replying to ${escapeHtml(replyToMessage.from||'message')}</b><span>${escapeHtml(replyToMessage.text||'Attachment')}</span></div><button type="button" aria-label="Cancel reply">×</button>`;bar.querySelector('button').onclick=()=>{replyToMessage=null;renderReplyBar()}}

const dismissPopups=e=>{
  const t=e.target;
  if(!t.closest('.memberActionMenu')&&!t.closest('.infoMember'))document.querySelectorAll('.memberActionMenu').forEach(x=>x.remove());
  if(!t.closest('#contextMenu')&&!t.closest('.msg'))hideContext();if(!t.closest('.profileMenu')&&!t.closest('#profileBtn'))$('profileMenu')?.classList.add('hidden');if(!t.closest('.floatingGroupMenu')&&!t.closest('.groupMore'))closeMoreMenus();if(!t.closest('.directInfoMenu')&&!t.closest('#chatAvatar'))closeDirectInfo();if(!t.closest('.memberActionMenu')&&!t.closest('.infoMember'))document.querySelectorAll('.memberActionMenu').forEach(x=>x.remove());
  if(!t.closest('#profileMenu')&&!t.closest('#profileBtn'))$('profileMenu')?.classList.add('hidden');
  if(!t.closest('#groupInfoPanel')&&!t.closest('#chatAvatar'))closeGroupInfo();
  if(!t.closest('.directInfoMenu')&&!t.closest('#chatAvatar'))closeDirectInfo();
  if(innerWidth<=760&&!t.closest('.sidebar')&&!t.closest('#mobilePeople'))closePeople();
};

document.addEventListener('pointerdown',dismissPopups,{capture:true});document.addEventListener('click',dismissPopups,{capture:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMoreMenus();hideContext()}},true);

function resizeComposer(){const el=$('message');if(!el)return;const min=innerWidth<=390?44:innerWidth<=760?48:54;const fieldMin=innerWidth<=390?46:innerWidth<=760?50:56;el.style.height='auto';const next=Math.min(Math.max(el.scrollHeight,min),116);el.style.height=next+'px';$('messageField').style.height=Math.max(fieldMin,Math.min(next+2,122))+'px'}
function scroll(){ $('messages').scrollTop=$('messages').scrollHeight }
function playNotificationSound(){if(currentSettings?.notifications?.sound===false)return;try{const c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=.035;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.08)}catch{}}

$('composer').onsubmit=async e=>{e.preventDefault();if(!selected.type)return;const text=$('message').value.trim();if(!text&&!pendingFiles.length)return;const attachments=await Promise.all(pendingFiles.map(fileToData));stopTypingForCurrent();if(editingId){s.emit('editMessage',{id:editingId,text});editingId=null}else if(selected.type==='direct')s.emit('sendDirect',{to:selected.name,text,attachments,replyToId:replyToMessage?.id,clientId:crypto.randomUUID?.()||String(Date.now())+'-'+Math.random()});else s.emit('sendGroup',{groupId:selected.id,text,attachments,replyToId:replyToMessage?.id,clientId:crypto.randomUUID?.()||String(Date.now())+'-'+Math.random()});$('message').value='';replyToMessage=null;renderReplyBar();clearDraft();pendingFiles=[];renderAttachments();resizeComposer();$('message').focus()};
$('message').oninput=()=>{saveDraft();resizeComposer();if(!$('message').value.trim()){stopTypingForCurrent();return}announceTyping()};
$('message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('composer').requestSubmit();return}if(e.key==='Enter'&&e.shiftKey){requestAnimationFrame(resizeComposer);return}if(e.key.length===1)announceTyping()};
$('message').onfocus=()=>{};$('message').onblur=()=>{setTimeout(()=>{if(document.activeElement!==$('message'))stopTypingForCurrent()},0)};
function announceTyping(){if(!selected.type||$('message').disabled||!me||!$('message').value.trim())return;const now=Date.now();if(!typingActive||now-typingLastSent>700){typingActive=true;typingLastSent=now;if(selected.type==='direct')s.emit('typing',{to:selected.name});else s.emit('groupTyping',{groupId:selected.id})}clearTimeout(typingTimer);typingTimer=setTimeout(stopTypingForCurrent,1800)}
function stopTypingForCurrent(clear=true){clearTimeout(typingTimer);if(typingActive&&selected.type&&me){if(selected.type==='direct')s.emit('stopTyping',{to:selected.name});else s.emit('groupStopTyping',{groupId:selected.id})}typingActive=false;typingLastSent=0;if(clear){$('typing').innerHTML='';typingUsers.clear()}}
function stopAllTyping(){clearTimeout(typingTimer);if(me&&selected.type)stopTypingForCurrent();typingUsers.clear();$('typing').innerHTML=''}

$('attachBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=e=>{const max=5*1024*1024,files=[...e.target.files],accepted=files.filter(f=>f.size<=max);pendingFiles=[...pendingFiles,...accepted].slice(0,6);if(accepted.length<files.length)showToast('Each attachment must be 5 MB or smaller.');renderAttachments();e.target.value=''};
function renderAttachments(){$('attachmentPreview').innerHTML=pendingFiles.map((f,i)=>`<span class="previewItem">${f.type.startsWith('image/')?'🖼️':'📄'} ${escapeHtml(f.name)} <button type="button" data-i="${i}">×</button></span>`).join('');$('attachmentPreview').querySelectorAll('button').forEach(b=>b.onclick=()=>{pendingFiles.splice(+b.dataset.i,1);renderAttachments()})}
function fileToData(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res({name:f.name,type:f.type,size:f.size,data:r.result});r.onerror=rej;r.readAsDataURL(f)})}

$('closeChat').onclick=closeChat;
$('chatAvatar').onclick=e=>{e.preventDefault();e.stopPropagation();if(selected.type==='group'){toggleGroupInfo();return}if(selected.type==='direct'){const p=people.find(x=>x.name===selected.name);if(p)showDirectInfo(p,e.currentTarget)}};$('emojiBtn').onclick=()=>{if($('message').disabled)return;$('message').setRangeText('😊',$('message').selectionStart,$('message').selectionEnd,'end');$('message').focus();resizeComposer();announceTyping()};
$('mobilePeople').onclick=openPeople;document.querySelector('.chatArea')?.addEventListener('click',e=>{if(window.innerWidth<=760&&document.body.classList.contains('menuOpen')&&!e.target.closest('#peoplePanel'))closePeople()});$('peopleClose').onclick=e=>{e.preventDefault();e.stopPropagation();closePeople()};$('search').oninput=renderPeople;
$('newGroup').onclick=()=>{buildGroupMembers();$('groupName').value='';$('groupModal').classList.remove('hidden')};$('closeGroup').onclick=()=>$('groupModal').classList.add('hidden');
$('createGroup').onclick=()=>{const name=$('groupName').value.trim(),members=[...$('groupMembers').querySelectorAll('input:checked')].map(x=>x.value);if(!name||!members.length)return;s.emit('createGroup',{name,members});$('groupName').value='';$('groupModal').classList.add('hidden')};
function buildGroupMembers(){ $('groupMembers').innerHTML='';people.filter(p=>p.name!==me.name).forEach(p=>{const l=document.createElement('label');l.className='memberChoice';l.innerHTML=`<input type="checkbox" value="${escapeHtml(p.name)}"><span class="choiceAvatar" style="--choiceHue:${senderHue(p.name)}">${escapeHtml(p.name[0].toUpperCase())}</span><span class="choiceText"><b>${escapeHtml(p.name)}</b><small>${p.online?'Online':'Offline · '+timeSince(p.lastSeen)}</small></span><span class="choiceCheck">✓</span>`;$('groupMembers').append(l)}) }

function toggleGroupInfo(){if(selected.type!=='group')return;const g=getGroup(selected.id);if(!g)return;renderGroupInfo(g);$('groupInfoPanel').classList.toggle('hidden')}
function closeGroupInfo(){$('groupInfoPanel').classList.add('hidden')}
let pendingClearChatKey=null;
function openClearChatConfirm(name){pendingClearChatKey=name;const box=$('clearChatConfirm');if(!box)return;$('clearChatText').textContent=`Clear your chat history with ${name}? This removes the conversation from your FiveChat history.`;box.classList.remove('hidden');requestAnimationFrame(()=>box.classList.add('modalVisible'))}
function closeClearChatConfirm(){const box=$('clearChatConfirm');if(!box)return;box.classList.remove('modalVisible');setTimeout(()=>box.classList.add('hidden'),170);pendingClearChatKey=null}
function openReceiverActions(){if(selected.type!=='direct')return;openClearChatConfirm(selected.name)}
function openRenameGroup(g){
  $('renameGroupInput').value=g.name;$('renameCharCounter').textContent=`${g.name.length}/50`;$('renameGroupModal').classList.remove('hidden');requestAnimationFrame(()=>{$('renameGroupModal').classList.add('modalVisible');setTimeout(()=>{$('renameGroupInput').focus();$('renameGroupInput').select()},80)});
}
function closeRenameGroup(){ $('renameGroupModal').classList.remove('modalVisible');setTimeout(()=>$('renameGroupModal').classList.add('hidden'),170) }

$('closeRemoveConfirm').onclick=closeRemoveConfirm;$('cancelRemove').onclick=closeRemoveConfirm;
$('confirmRemove').onclick=()=>{if(!pendingRemoveMember)return;const btn=$('confirmRemove');btn.disabled=true;btn.textContent='Removing…';s.emit('removeGroupMember',pendingRemoveMember,(result)=>{btn.disabled=false;btn.textContent='Remove';if(result?.ok){const removed=pendingRemoveMember.name;closeRemoveConfirm();if(result.group){groups=groups.map(x=>x.id===result.group.id?result.group:x);if(selected.type==='group'&&selected.id===result.group.id){$('chatStatus').textContent=`${result.group.members.length} members`;renderGroupInfo(result.group)}renderGroups()}else{groups=groups.filter(x=>x.id!==pendingRemoveMember.groupId);if(selected.type==='group'&&selected.id===pendingRemoveMember.groupId)closeChat();renderGroups()}}else if(result?.error)showToast(result.error)})};
$('closeMemberModal').onclick=()=>{$('memberModal').classList.add('hidden')};
$('confirmAddMembers').onclick=()=>{if(selected.type!=='group')return;const names=[...$('addMembersList').querySelectorAll('input:checked')].map(x=>x.value);if(!names.length)return;const btn=$('confirmAddMembers');btn.disabled=true;btn.textContent='Adding…';s.emit('addGroupMembers',{groupId:selected.id,members:names},result=>{btn.disabled=false;btn.innerHTML='Add selected <span>→</span>';if(result?.ok){groups=groups.map(x=>x.id===result.group.id?result.group:x);renderGroups();if(selected.type==='group'&&selected.id===result.group.id){$('chatName').textContent=result.group.name;$('chatStatus').textContent=`${result.group.members.length} members`;renderGroupInfo(result.group)}$('memberModal').classList.add('hidden')}else if(result?.error)showToast(result.error)})};

$('renameGroupSave').onclick=()=>{const g=getGroup(selected.id),name=$('renameGroupInput').value.trim();if(!g||!name)return;if(name===g.name)return closeRenameGroup();$('renameGroupSave').disabled=true;s.emit('renameGroup',{id:g.id,name},()=>{$('renameGroupSave').disabled=false;closeRenameGroup()})};
$('renameGroupInput').oninput=()=>{$('renameCharCounter').textContent=`${$('renameGroupInput').value.length}/50`};$('renameGroupInput').onkeydown=e=>{if(e.key==='Enter')$('renameGroupSave').click();if(e.key==='Escape')closeRenameGroup()};$('renameGroupCancel').onclick=closeRenameGroup;$('closeRenameGroup').onclick=closeRenameGroup;
$('leaveGroupCancel').onclick=closeLeaveConfirm;$('closeLeaveGroup').onclick=closeLeaveConfirm;$('leaveGroupConfirmBtn').onclick=()=>{if(selected.type==='group'){s.emit('leaveGroup',{groupId:selected.id});closeLeaveConfirm()}};
$('deleteGroupCancel').onclick=closeDeleteGroupConfirm;$('closeDeleteGroup').onclick=closeDeleteGroupConfirm;$('deleteGroupConfirmBtn').onclick=()=>{const id=pendingDeleteGroupId,g=getGroup(id);if(!g)return closeDeleteGroupConfirm();const btn=$('deleteGroupConfirmBtn');btn.disabled=true;btn.textContent='Deleting…';s.emit('deleteGroup',{id},result=>{btn.disabled=false;btn.textContent='Delete group';if(result?.ok){groups=groups.filter(x=>x.id!==id);if(selected.type==='group'&&selected.id===id)closeChat();renderGroups();showToast('Group deleted');closeDeleteGroupConfirm()}else if(result?.error)showToast(result.error)})};

s.on('directHistory',d=>{if(selected.type==='direct'&&selected.name===d.with){renderMessages(d.messages);if(isChatVisible())s.emit('markSeen',{with:d.with})}});
s.on('groupHistory',d=>{
  if(selected.type==='group'&&selected.id===d.group.id){
    groups=groups.map(g=>g.id===d.group.id?d.group:g);
    renderMessages(d.messages);
    $('chatStatus').textContent=`${d.group.members.length} members`;
    if(isChatVisible())s.emit('groupSeen',{groupId:d.group.id});
  }
});
s.on('directMessage',m=>{
  if(m.from!==me.name&&m.to!==me.name)return;
  const incoming=m.to===me.name;
  const active=selected.type==='direct'&&((m.from===me.name&&m.to===selected.name)||(m.to===me.name&&m.from===selected.name));
  if(active){
    addMessage(m); scroll();
    if(incoming){
      if(isChatVisible()) s.emit('markSeen',{with:m.from});
      else bumpUnread('direct',m.from);
    }
  }else if(incoming){
    bumpUnread('direct',m.from);playNotificationSound();
  }
});
s.on('groupMessage',m=>{
  const g=getGroup(m.groupId); if(!g)return;
  const active=selected.type==='group'&&selected.id===m.groupId;
  const already=[...$('messages').children].some(el=>el.dataset.id===m.id);
  if(active){if(!already)addMessage(m);scroll();if(m.from!==me.name){if(isChatVisible())s.emit('groupSeen',{groupId:m.groupId});else bumpUnread('group',m.groupId)}}
  else if(m.from!==me.name) bumpUnread('group',m.groupId);
});
s.on('messageStatus',d=>refreshMessage(d.id,el=>{if(!el.classList.contains('mine'))return;const sm=el.querySelector('small');if(sm){let t=sm.querySelector('.messageTicks');if(!t){t=document.createElement('span');t.className='messageTicks';sm.append(t)}t.textContent=d.status==='sent'?'✓':'✓✓';t.classList.toggle('seen',d.status==='seen');t.title=d.status}}));
s.on('messageEdited',d=>refreshMessage(d.id,el=>{const b=el.querySelector('.bubble');if(b)b.textContent=d.text;const old=el.querySelector('.linkPreview');if(old)old.remove();if(d.linkPreview){el.querySelector('.messageContent').insertAdjacentHTML('beforeend',linkPreviewHtml(d.linkPreview))}const sm=el.querySelector('small');if(sm&&!sm.textContent.includes('edited'))sm.textContent+=' · edited'}));
$('messages').addEventListener('click',e=>{const q=e.target.closest('[data-reply-jump]');if(q){const target=document.querySelector(`[data-id="${CSS.escape(q.dataset.replyJump)}"]`);target?.scrollIntoView({behavior:'smooth',block:'center'});target?.classList.add('searchHit');setTimeout(()=>target?.classList.remove('searchHit'),1200)}});
$('jumpUnread').onclick=()=>{if(firstUnreadId){const el=document.querySelector(`[data-id="${CSS.escape(firstUnreadId)}"]`);el?.scrollIntoView({behavior:'smooth',block:'center'});$('jumpUnread').classList.add('hidden');}};
s.on('messageDeletedForEveryone',d=>{
  if(editingId===d.id){editingId=null;$('message').value='';resizeComposer()}
  refreshMessage(d.id,el=>{const mine=d.from===me.name;el.dataset.unsent='1';el.dataset.mine=mine?'1':'0';el.classList.remove('mine','theirs');el.classList.add(mine?'mine':'theirs','unsentMsg');el.style.alignSelf=mine?'flex-end':'flex-start';el.style.textAlign=mine?'right':'left';el.style.cursor='default';const sender=el.querySelector('.sender');if(sender) sender.textContent=d.from;const content=el.querySelector('.messageContent');if(content)content.innerHTML='<div class="bubble unsent">Message deleted</div>';el.querySelectorAll('.messageTicks').forEach(x=>x.remove())});
  if(d.from!==me?.name&&d.kind==='direct'){if(selected.type==='direct'&&selected.name===d.from&&isChatVisible())addSystemNotice('A message was deleted');else if(selected.type!=='direct'||selected.name!==d.from){bumpUnread('direct',d.from);showToast(`${d.from} deleted a message`)}}
});
s.on('groupEvent',m=>{if(selected.type==='group'&&selected.id===m.groupId){addMessage(m);scroll()}});
s.on('groupRenamed',g=>{groups=groups.map(x=>x.id===g.id?g:x);if(selected.type==='group'&&selected.id===g.id){selected.name=g.name;$('chatName').textContent=g.name;renderGroupInfo(g)}renderGroups()});
s.on('groupCreated',g=>{if(!groups.some(x=>x.id===g.id))groups.unshift(g);renderGroups()});
s.on('groupAdded',d=>{const g=d?.group;if(!g)return;if(!groups.some(x=>x.id===g.id))groups.unshift(g);else groups=groups.map(x=>x.id===g.id?g:x);renderGroups();showToast(d?.addedBy?`${d.addedBy} added you to ${g.name}`:`Added to ${g.name}`);if(selected.type==='group'&&selected.id===g.id){selected.name=g.name;$('chatName').textContent=g.name;$('chatStatus').textContent=`${g.members.length} members`;s.emit('openGroup',{id:g.id})}});
s.on('groupDeleted',payload=>{const id=typeof payload==='object'?payload.id:payload;groups=groups.filter(g=>g.id!==id);if(selected.type==='group'&&selected.id===id)closeChat();renderGroups();closeGroupInfo()});
s.on('groupRemoved',id=>{groups=groups.filter(g=>g.id!==id);if(selected.type==='group'&&selected.id===id)closeChat();renderGroups()});
s.on('groupLeft',id=>{groups=groups.filter(g=>g.id!==id);if(selected.type==='group'&&selected.id===id)closeChat();renderGroups()});
s.on('unreadCounts',d=>applyUnreadFromServer(d));
s.on('messageReaction',d=>refreshMessage(d.id,el=>{const m={reactions:d.reactions||{}};const bar=el.querySelector('.reactionBar');if(bar)bar.innerHTML=Object.entries(m.reactions).map(([e,n])=>`<button class="reactionChip" type="button">${escapeHtml(e)} ${n.length}</button>`).join('');else if(Object.keys(m.reactions).length){const c=el.querySelector('.messageContent');const b=document.createElement('div');b.className='reactionBar';b.innerHTML=Object.entries(m.reactions).map(([e,n])=>`<button class="reactionChip" type="button">${escapeHtml(e)} ${n.length}</button>`).join('');c.append(b)}}));
s.on('messagePinned',d=>refreshMessage(d.id,el=>{const sm=el.querySelector('small');if(!sm)return;let pin=sm.querySelector('.pinMark');if(d.pinned&&!pin){pin=document.createElement('span');pin.className='pinMark';pin.textContent='📌';pin.title='Pinned';sm.prepend(pin)}else if(!d.pinned&&pin)pin.remove()}));
s.on('chatRequests',d=>{chatRequests=d||{incoming:[],outgoing:[]};refreshRequestUI();if($('chatRequestModal')&&!$('chatRequestModal').classList.contains('hidden'))renderRequestModal()});
s.on('connectionUpdated',d=>{if(d?.name){connections=[...new Set([...connections,String(d.name).toLowerCase()])];refreshRequestUI();showToast('Chat connection ready')}});
s.on('directAccessError',d=>showToast(d?.error||'This chat is not available yet'));

s.on('chatHistoryCleared',d=>{if(!me)return;const key=String(d?.chatKey||'');if(selected.type==='direct'&&selected.name&&key===[me.name.toLowerCase(),selected.name.toLowerCase()].sort().join('::')){$('messages').innerHTML='<div class="empty"><h3>No messages yet</h3><p>Start the conversation.</p></div>'}if(d?.with)clearUnread('direct',d.with)});
s.on('groupUpdated',g=>{groups=groups.map(x=>x.id===g.id?g:x);if(selected.type==='group'&&selected.id===g.id){$('chatName').textContent=g.name;$('chatStatus').textContent=`${g.members.length} members`;if(!$('groupInfoPanel').classList.contains('hidden'))renderGroupInfo(g)}renderGroups()});
s.on('people',a=>{people=a;renderPeople();if(selected.type==='direct'){const p=a.find(x=>x.name===selected.name);if(p)setDirectStatus(p)}if(selected.type==='group'&&!$('groupInfoPanel').classList.contains('hidden')){const g=getGroup(selected.id);if(g)renderGroupInfo(g)}});

function renderTyping(){const active=[...typingUsers.entries()].filter(([k,v])=>v&&v.groupId===selected.id&&v.until>Date.now()).sort((a,b)=>a[0].localeCompare(b[0]));if(!active.length){$('typing').innerHTML='';return}$('typing').innerHTML=active.map(([name])=>`<span class="typingPerson"><span class="typingDots"><i></i><i></i><i></i></span><b>${escapeHtml(name)}</b> is typing…</span>`).join('')}
s.on('typing',p=>{if(selected.type==='direct'&&p.from===selected.name&&p.to===me.name){clearTimeout(window.__directTyping);$('typing').innerHTML=`<span class="typingPerson"><span class="typingDots"><i></i><i></i><i></i></span><b>${escapeHtml(p.from)}</b> is typing…</span>`}});
s.on('stopTyping',p=>{if(selected.type==='direct'&&p.from===selected.name)$('typing').innerHTML=''});
s.on('groupTyping',p=>{if(selected.type==='group'&&p.groupId===selected.id&&p.from!==me.name){typingUsers.set(p.from,{groupId:p.groupId,until:Date.now()+1800});renderTyping()}});
s.on('groupStopTyping',p=>{typingUsers.delete(p.from);renderTyping()});
setInterval(()=>{renderTyping()},250);setInterval(()=>{if(me){renderPeople();if(selected.type==='direct'){const p=people.find(x=>x.name===selected.name);if(p)setDirectStatus(p)}if(selected.type==='group'&&!$('groupInfoPanel').classList.contains('hidden')){const g=getGroup(selected.id);if(g)renderGroupInfo(g)}}},4000);
s.on('groupError',m=>showToast(m));s.on('groupMemberError',m=>showToast(m));

function startHeartbeat(){clearInterval(window.__hb);window.__hb=setInterval(()=>{if(me&&s.connected&&document.visibilityState==='visible')s.emit('heartbeat')},15000)}
function announceActive(){if(!me)return;if(!s.connected){s.connect();return}s.emit('presence',{visible:true});$('myStatus').textContent='Online';$('profileStatus').textContent='Online';const p=people.find(x=>x.name===selected.name);if(selected.type==='direct'&&p)setDirectStatus({...p,online:true,lastSeen:Date.now()});if(selected.type==='direct'&&selected.name)s.emit('markSeen',{with:selected.name});if(selected.type==='group'&&selected.id)s.emit('groupSeen',{groupId:selected.id});touchActivity()}
document.addEventListener('visibilitychange',()=>{if(!me)return;sendPushActivity();if(document.visibilityState==='visible')announceActive();else{s.emit('presence',{visible:false});$('myStatus').textContent='Away';$('profileStatus').textContent='Away';if(selected.type)stopTypingForCurrent()}});
window.addEventListener('focus',announceActive);window.addEventListener('pageshow',announceActive);window.addEventListener('pagehide',()=>{if(me&&s.connected)s.emit('presence',{visible:false})});
s.on('connect',()=>{if(me)showToast('Connection restored');if(logoutInProgress)return;const session=loadSession();if(me&&session?.token)s.emit('loginWithSession',{token:session.token});else if(me&&session?.name&&session?.pin)s.emit('login',{name:session.name,pin:session.pin})});
s.on('disconnect',()=>{if(me)showToast('Offline — reconnecting…')});s.on('connect_error',()=>{if(me)showToast('Reconnection in progress…')});

function performLogout(){if(pushSubscription&&s.connected)sendPushActivity();localStorage.removeItem(SESSION);window.__sessionToken='';window.__loginPin='';
  logoutInProgress=true;authRequestId++;
  if(s.connected)s.emit('logout');
  localStorage.removeItem(SESSION);localStorage.removeItem(ACTIVITY_KEY);clearTimeout(inactivityTimer);me=null; selected={type:null,id:null,name:null}; clearInterval(window.__hb); clearTimeout(typingTimer); pendingFiles=[];editingId=null;typingUsers.clear();hideContext();
  $('profileMenu').classList.add('hidden');$('memberModal').classList.add('hidden');$('groupModal').classList.add('hidden');$('renameGroupModal').classList.add('hidden');$('leaveGroupConfirm').classList.add('hidden');$('deleteGroupConfirm').classList.add('hidden');$('removeMemberConfirm').classList.add('hidden');$('app').classList.add('hidden');$('auth').classList.remove('hidden');$('authName').value='';$('authPin').value='';$('authCode').value='';$('authError').textContent='';authMode='login';updateAuth();closePeople();$('authName').focus();
}
function openLogoutConfirm(){ $('logoutConfirm').classList.remove('hidden');requestAnimationFrame(()=>$('logoutConfirm').classList.add('modalVisible')) }
function closeLogoutConfirm(){ $('logoutConfirm').classList.remove('modalVisible');setTimeout(()=>$('logoutConfirm').classList.add('hidden'),170) }
$('openSettings').onclick=e=>{e.stopPropagation();$('profileMenu').classList.add('hidden');openSettings()};$('closeSettings').onclick=closeSettings;$('saveSettings').onclick=()=>{const patch={theme:$('themeSelect').value,compact:$('compactMode').checked,privacy:{online:$('privacyOnline').checked,lastSeen:$('privacyLastSeen').checked,profilePhoto:document.getElementById('privacyPhoto')?.checked!==false,readReceipts:$('privacyRead').checked,requests:$('requestPrivacy').value},notifications:{sound:document.getElementById('notifySound')?.checked!==false,browser:document.getElementById('notifyBrowser')?.checked!==false,badge:document.getElementById('notifyBadge')?.checked!==false,messages:document.getElementById('notifyMessages')?.checked!==false,requests:document.getElementById('notifyRequests')?.checked!==false,groups:document.getElementById('notifyGroups')?.checked!==false,mentions:document.getElementById('notifyMentions')?.checked!==false,replies:document.getElementById('notifyReplies')?.checked!==false},profileAvatar:document.getElementById('profileAvatarUrl')?.value||'',accent:document.getElementById('accentColor')?.value||'#2563eb',bubble:document.getElementById('bubbleStyle')?.value||'default'};s.emit('updateSettings',patch,r=>{if(r?.ok){currentSettings=r.settings;applyTheme(r.settings.theme);s.emit('updateProfile',{bio:$('profileBio').value,avatar:document.getElementById('profileAvatarUrl')?.value||''},()=>{});closeSettings();showToast('Settings saved')}else showToast('Could not save settings')})};$('chatSearchBtn').onclick=openMessageSearch;$('closeSearchMessages').onclick=closeMessageSearch;$('messageSearchInput').oninput=runMessageSearch;$('chatMuteBtn').onclick=toggleChatMute;$('smartBtn').onclick=openSmart;$('closeSmart').onclick=closeSmart;$('smartResults').onclick=e=>{const b=e.target.closest('.smartSuggestion');if(b){$('message').value=b.textContent;saveDraft();resizeComposer();closeSmart();$('message').focus()}};$('reportCurrentUser').onclick=reportCurrent;$('profileReportBtn').onclick=reportCurrent;$('closeProfileView').onclick=()=>$('profileViewModal').classList.add('hidden');$('messageSearchResults').onclick=e=>{const b=e.target.closest('[data-search-id]');if(b){closeMessageSearch();const el=document.querySelector(`[data-id="${CSS.escape(b.dataset.searchId)}"]`);el?.scrollIntoView({behavior:'smooth',block:'center'});el?.classList.add('searchHit');setTimeout(()=>el?.classList.remove('searchHit'),1400)}};
$('openRequests').onclick=e=>{e.stopPropagation();closeMoreMenus();closeDirectInfo();openChatRequestModal()};$('closeChatRequests').onclick=closeChatRequestModal;$('chatRequestCancel').onclick=closeChatRequestModal;$('chatRequestList').onclick=e=>{const a=e.target.closest('[data-accept-request]'),d=e.target.closest('[data-decline-request]'),c=e.target.closest('[data-cancel-request]');if(a)acceptRequest(a.dataset.acceptRequest);else if(d)declineRequest(d.dataset.declineRequest);else if(c)cancelRequest(c.dataset.cancelRequest)};
$('logout').onclick=openLogoutConfirm;$('profileNotifications').onclick=e=>{e.stopPropagation();updateNotificationSetting()};$('profileLogout').onclick=e=>{e.stopPropagation();$('profileMenu').classList.add('hidden');openLogoutConfirm()};$('profileBtn').onclick=e=>{e.stopPropagation();$('profileMenu').classList.toggle('hidden')};
$('clearChatCancel').onclick=closeClearChatConfirm;$('closeClearChat').onclick=closeClearChatConfirm;$('clearChatConfirmBtn').onclick=()=>{const name=pendingClearChatKey;if(!name)return;const btn=$('clearChatConfirmBtn');btn.disabled=true;btn.textContent='Clearing…';s.emit('clearDirectHistory',{with:name},result=>{btn.disabled=false;btn.textContent='Clear history';if(result?.ok){if(selected.type==='direct'&&selected.name===name){$('messages').innerHTML='<div class="empty"><h3>No messages yet</h3><p>Start the conversation.</p></div>'}closeClearChatConfirm();showToast('Chat history cleared')}else showToast(result?.error||'Could not clear chat history')})};
$('logoutCancel').onclick=closeLogoutConfirm;$('closeLogout').onclick=closeLogoutConfirm;$('logoutConfirmBtn').onclick=()=>{closeLogoutConfirm();setTimeout(performLogout,120)};

const old=loadSession();if(old?.token){if(s.connected)s.emit('loginWithSession',{token:old.token});else s.once('connect',()=>s.emit('loginWithSession',{token:old.token}))}else if(old?.name&&old?.pin){window.__loginPin=old.pin;if(s.connected)s.emit('login',{name:old.name,pin:old.pin});else s.once('connect',()=>s.emit('login',{name:old.name,pin:old.pin}))}

if('serviceWorker' in navigator){navigator.serviceWorker.addEventListener('message',e=>{const d=e.data||{};if(!me)return;if(d.kind==='direct'&&d.with){const p=people.find(x=>x.name===d.with);if(p)openDirect(p)}else if(d.kind==='group'&&d.groupId){const g=getGroup(d.groupId);if(g)openGroup(g)}else if(d.kind==='chatRequest'){openChatRequestModal()}else if(d.kind==='chatRequestAccepted'&&d.with){const p=people.find(x=>x.name===d.with);if(p&&isConnectedTo(p.name))openDirect(p)}})}
window.addEventListener('load',()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});updateNotificationLabel(notificationEnabled,false)});
