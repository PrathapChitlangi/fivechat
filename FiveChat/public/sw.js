self.addEventListener('install',event=>{self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});

self.addEventListener('push',event=>{
  let d={title:'FiveChat',body:'New message',kind:'',with:'',groupId:'',url:'/',messageId:''};
  try{if(event.data)d=event.data.json()}catch(e){}
  const options={
    body:d.body||'New message',
    tag:'fivechat-'+(d.messageId||Date.now()),
    renotify:true,
    silent:!!d.silent,
    requireInteraction:false,
    timestamp:Date.now(),
    data:{kind:d.kind||'',with:d.with||'',groupId:d.groupId||'',url:d.url||'/',messageId:d.messageId||''},
    icon:'/favicon.ico',
    badge:d.badge===false?'': '/favicon.ico'
  };
  event.waitUntil(self.registration.showNotification(d.title||'FiveChat',options));
});

self.addEventListener('notificationclick',event=>{
  const data=event.notification.data||{};
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async list=>{
    for(const client of list){
      try{client.postMessage(data);if('focus' in client)return client.focus()}catch(e){}
    }
    return clients.openWindow(data.url||'/');
  }));
});
