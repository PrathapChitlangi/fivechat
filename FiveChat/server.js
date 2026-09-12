const express=require("express"),http=require("http"),path=require("path"),{Server}=require("socket.io"),{MongoClient}=require("mongodb"),webpush=require("web-push");
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static(path.join(__dirname,"public")));

const PORT=process.env.PORT||3000,MAX=20,TTL=24*60*60*1000,URI=process.env.MONGODB_URI;
let col=null,membersCol=null,roomsCol=null,pushCol=null;
const liveRooms=new Map();

const VAPID_PUBLIC_KEY=process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY=process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL=process.env.VAPID_EMAIL||"mailto:admin@example.com";
const PUSH_READY=!!(VAPID_PUBLIC_KEY&&VAPID_PRIVATE_KEY);
if(PUSH_READY) webpush.setVapidDetails(VAPID_EMAIL,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);

app.get("/push-public-key",(req,res)=>res.type("text/plain").send(VAPID_PUBLIC_KEY||""));

async function sendOfflinePush(roomName,sender,text){
  if(!PUSH_READY||!pushCol||!membersCol)return;
  try{
    const offline=await membersCol.find({roomName,online:false},{projection:{name:1}}).toArray();
    const names=new Set(offline.map(x=>x.name));
    if(!names.size)return;
    const subs=await pushCol.find({roomName,userName:{$in:[...names]}}).toArray();
    const payload=JSON.stringify({title:`${sender} • FiveChat`,body:text,roomName});
    await Promise.all(subs.map(async sub=>{
      try{await webpush.sendNotification(sub.subscription,payload)}
      catch(e){if(e.statusCode===404||e.statusCode===410)await pushCol.deleteOne({_id:sub._id});}
    }));
  }catch(e){console.error("Push notification error",e)}
}

async function db(){
  if(!URI){console.warn("MONGODB_URI missing - persistent members/rooms unavailable");return}
  const c=new MongoClient(URI);await c.connect();
  const d=c.db(process.env.MONGODB_DB||"fivechat");
  col=d.collection("messages");
  membersCol=d.collection("members");
  roomsCol=d.collection("rooms");
  pushCol=d.collection("pushSubscriptions");
  await col.createIndex({time:1},{expireAfterSeconds:TTL});
  await col.createIndex({roomName:1,time:1});
  await membersCol.createIndex({roomName:1,name:1},{unique:true});
  await membersCol.createIndex({roomName:1,online:1});
  await roomsCol.createIndex({roomName:1},{unique:true});
  await pushCol.createIndex({endpoint:1},{unique:true});
  await pushCol.createIndex({roomName:1,userName:1});
  console.log("MongoDB connected");
}

function liveRoom(n){if(!liveRooms.has(n))liveRooms.set(n,new Map());return liveRooms.get(n)}
async function history(n){
  return col?await col.find({roomName:n,time:{$gte:Date.now()-TTL}},{projection:{_id:0,roomName:0}}).sort({time:1}).toArray():[];
}
async function roomExists(n){
  if(roomsCol)return !!(await roomsCol.findOne({roomName:n},{projection:{_id:1}}));
  return liveRooms.has(n);
}
async function memberList(n){
  if(membersCol){
    return (await membersCol.find({roomName:n},{projection:{_id:0,name:1,online:1,lastSeen:1}}).sort({name:1}).toArray())
      .map(x=>({name:x.name,online:!!x.online,lastSeen:x.lastSeen||null}));
  }
  const r=liveRooms.get(n)||new Map();
  return [...r.values()].map(x=>({name:x.name,online:true,lastSeen:null}));
}
async function emitMembers(n){io.to(n).emit("members",await memberList(n))}

io.on("connection",s=>{
  s.on("pushSubscribe",async payload=>{
    try{
      const roomName=String(payload?.roomName||"").trim().slice(0,40);
      const userName=String(payload?.userName||"").trim().slice(0,30);
      const subscription=payload?.subscription;
      if(!roomName||!userName||!subscription?.endpoint||!pushCol)return;
      await pushCol.updateOne({endpoint:subscription.endpoint},{$set:{roomName,userName,subscription,updatedAt:Date.now()}},{upsert:true});
    }catch(e){console.error("pushSubscribe",e)}
  });

  s.on("listRooms",async()=>{
    try{
      if(roomsCol){
        const list=await roomsCol.find({},{projection:{_id:0,roomName:1,updatedAt:1}}).sort({updatedAt:-1}).limit(100).toArray();
        s.emit("rooms",list.map(x=>x.roomName));
      }else s.emit("rooms",[...liveRooms.keys()].sort());
    }catch(e){console.error(e);s.emit("rooms",[])}
  });

  s.on("joinRoom",async(payload)=>{
    try{
      let roomName=String(payload?.roomName||"").trim().slice(0,40);
      let userName=String(payload?.userName||"").trim().slice(0,30);
      let mode=payload?.mode==="create"?"create":"existing";
      if(!roomName||!userName)return s.emit("joinError","Enter your name and room name.");

      const exists=await roomExists(roomName);
      if(mode==="create" && exists)return s.emit("joinError","That room already exists. Choose it as an existing room.");
      if(mode==="existing" && !exists)return s.emit("joinError","Room not found. Choose an existing room or create a new one.");

      if(!exists){
        if(roomsCol)await roomsCol.insertOne({roomName,createdAt:Date.now(),updatedAt:Date.now()});
      }else if(roomsCol){
        await roomsCol.updateOne({roomName},{$set:{updatedAt:Date.now()}});
      }

      const r=liveRoom(roomName);
      const existingLive=[...r.values()].find(x=>x.name.toLowerCase()===userName.toLowerCase());
      if(r.size>=MAX && !existingLive)return s.emit("joinError",`This room already has ${MAX} members.`);

      // A member can reconnect with the same name. Only one active socket per name is allowed.
      if(existingLive){
        const oldId=existingLive.socketId;
        if(oldId!==s.id){
          const old=io.sockets.sockets.get(oldId);
          if(old)old.disconnect(true);
          r.delete(oldId);
        }
      }

      s.join(roomName);
      r.set(s.id,{name:userName,socketId:s.id});
      s.data.roomName=roomName;s.data.userName=userName;

      if(membersCol){
        await membersCol.updateOne(
          {roomName,name:userName},
          {$set:{online:true,lastSeen:Date.now()},$setOnInsert:{roomName,name:userName,createdAt:Date.now()}},
          {upsert:true}
        );
      }

      const list=await memberList(roomName);
      s.emit("joined",{roomName,userName,messages:await history(roomName),users:list});
      await emitMembers(roomName);
    }catch(e){console.error(e);s.emit("joinError","Unable to join room. Try again.")}
  });

  s.on("sendMessage",async payload=>{
    let n=s.data.roomName,u=s.data.userName;if(!n||!u)return;
    let text="",replyTo=null;
    if(payload&&typeof payload==="object"){
      text=String(payload.text||"").trim().slice(0,2000);
      if(payload.replyTo&&typeof payload.replyTo==="object"){
        const rid=String(payload.replyTo.id||"").slice(0,120),rn=String(payload.replyTo.name||"").slice(0,30),rt=String(payload.replyTo.text||"").slice(0,2000);
        if(rid&&rn&&rt)replyTo={id:rid,name:rn,text:rt};
      }
    }else text=String(payload||"").trim().slice(0,2000);
    if(!text)return;
    let m={id:Date.now()+"-"+Math.random().toString(36).slice(2),roomName:n,name:u,text,time:Date.now()};
    if(replyTo)m.replyTo=replyTo;
    try{
      if(col)await col.insertOne(m);
      delete m.roomName;io.to(n).emit("message",m); await sendOfflinePush(n,u,text);
    }catch(e){console.error(e);s.emit("sendError","Message was not saved. Try again.")}
  });

  s.on("deleteMessage",async id=>{
    const n=s.data.roomName,u=s.data.userName;id=String(id||"").slice(0,120);if(!n||!u||!id)return;
    try{
      if(col){const result=await col.deleteOne({id,roomName:n,name:u});if(!result.deletedCount)return}
      io.to(n).emit("messageDeleted",id);
    }catch(e){console.error(e);s.emit("sendError","Unable to delete message. Try again.")}
  });

  s.on("typing",()=>s.data.roomName&&s.to(s.data.roomName).emit("typing",s.data.userName));
  s.on("stopTyping",()=>s.data.roomName&&s.to(s.data.roomName).emit("stopTyping"));

  s.on("leaveRoom",async()=>{
    await markOffline(s);
  });

  s.on("disconnect",async()=>{await markOffline(s)});
});

async function markOffline(s){
  const n=s.data.roomName,u=s.data.userName;
  if(!n||!u)return;
  try{
    const r=liveRooms.get(n);
    if(r){
      r.delete(s.id);
      if(!r.size)liveRooms.delete(n);
    }
    if(membersCol)await membersCol.updateOne({roomName:n,name:u},{$set:{online:false,lastSeen:Date.now()}});
    await emitMembers(n);
  }catch(e){console.error(e)}
  delete s.data.roomName;delete s.data.userName;
}

db().then(()=>server.listen(PORT,()=>console.log("FiveChat v6 on "+PORT))).catch(e=>{console.error(e);process.exit(1)})
