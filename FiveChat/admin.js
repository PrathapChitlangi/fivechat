#!/usr/bin/env node
/* FiveChat v36 terminal admin utility.
   Use only against a database you administer. No PINs/passwords are printed.
*/
const {MongoClient}=require('mongodb');
const readline=require('readline');
const URI=process.env.MONGODB_URI;
const DB=process.env.MONGODB_DB||'fivechat';
const TTL=24*60*60*1000;
if(!URI){console.error('MONGODB_URI is required.');process.exit(1)}
const [command,...args]=process.argv.slice(2);
const usage=`\nFiveChat v36 admin commands\n\n  node admin.js list-users\n  node admin.js list-groups\n  node admin.js show-user <name>\n  node admin.js show-group <group-id>\n  node admin.js add-member <group-id> <username>\n  node admin.js remove-member <group-id> <username>\n  node admin.js rename-group <group-id> <new-name>\n  node admin.js remove-user <username> [--purge-chats]\n  node admin.js delete-group <group-id>\n\nDestructive commands ask for confirmation. PINs are never displayed.\n`;
function die(m){console.error('\n'+m);console.log(usage);process.exit(1)}
function confirm(question){return new Promise(resolve=>{const rl=readline.createInterface({input:process.stdin,output:process.stdout});rl.question(question+' Type YES to continue: ',a=>{rl.close();resolve(a.trim()==='YES')})})}
(async()=>{
 const c=new MongoClient(URI,{serverSelectionTimeoutMS:10000});
 try{await c.connect();const db=c.db(DB),accounts=db.collection('accounts'),groups=db.collection('groups'),messages=db.collection('messages');
  const name=x=>String(x||'').trim().slice(0,30), gid=x=>String(x||'').trim();
  if(!command){console.log(usage);return}
  if(command==='list-users'){
    const rows=await accounts.find({}, {projection:{_id:0,name:1,createdAt:1,lastSeen:1}}).sort({name:1}).toArray();
    console.table(rows.map(x=>({name:x.name,createdAt:new Date(x.createdAt).toISOString(),lastSeen:x.lastSeen?new Date(x.lastSeen).toISOString():'never'})));return;
  }
  if(command==='list-groups'){
    const rows=await groups.find({}, {projection:{_id:0,id:1,name:1,createdBy:1,members:1,updatedAt:1}}).sort({updatedAt:-1}).toArray();
    console.table(rows.map(x=>({id:x.id,name:x.name,admin:x.createdBy,members:x.members.length,updatedAt:new Date(x.updatedAt).toISOString()})));return;
  }
  if(command==='show-user'){
    const n=name(args[0]);if(!n)die('Username is required.');const u=await accounts.findOne({nameLower:n.toLowerCase()},{projection:{_id:0,name:1,nameLower:1,pinHash:0,createdAt:1,lastSeen:1}});if(!u)return console.log('User not found.');const gs=await groups.find({membersLower:n.toLowerCase()},{projection:{_id:0,id:1,name:1,createdBy:1}}).toArray();const recent=await messages.countDocuments({$or:[{from:n},{to:n}],time:{$gt:Date.now()-TTL}});console.log({user:u,groups:gs,recentRetainedMessages:recent});return;
  }
  if(command==='show-group'){
    const id=gid(args[0]);if(!id)die('Group ID is required.');const g=await groups.findOne({id},{projection:{_id:0}});if(!g)return console.log('Group not found.');console.dir(g,{depth:5});return;
  }
  if(command==='add-member'){
    const id=gid(args[0]),n=name(args[1]);if(!id||!n)die('Group ID and username are required.');const [g,u]=await Promise.all([groups.findOne({id}),accounts.findOne({nameLower:n.toLowerCase()})]);if(!g)return die('Group not found.');if(!u)return die('User not found.');if(g.membersLower.includes(u.nameLower))return console.log('User is already a member.');g.members.push(u.name);g.membersLower.push(u.nameLower);g.updatedAt=Date.now();await groups.updateOne({id},{$set:{members:g.members,membersLower:g.membersLower,updatedAt:g.updatedAt}});console.log(`Added ${u.name} to ${g.name}.`);return;
  }
  if(command==='remove-member'){
    const id=gid(args[0]),n=name(args[1]);if(!id||!n)die('Group ID and username are required.');const g=await groups.findOne({id});if(!g)return die('Group not found.');if(g.createdBy.toLowerCase()===n.toLowerCase())return die('The group admin cannot be removed; transfer/delete the group through your admin process.');const idx=g.membersLower.indexOf(n.toLowerCase());if(idx<0)return die('User is not a member.');const ok=await confirm(`Remove ${g.members[idx]} from ${g.name}?`);if(!ok)return console.log('Cancelled.');g.members.splice(idx,1);g.membersLower.splice(idx,1);if(!g.members.length){await groups.deleteOne({id});console.log('Group became empty and was deleted.');return}g.updatedAt=Date.now();await groups.updateOne({id},{$set:{members:g.members,membersLower:g.membersLower,updatedAt:g.updatedAt}});console.log(`Removed ${n} from ${g.name}.`);return;
  }
  if(command==='rename-group'){
    const id=gid(args[0]),newName=args.slice(1).join(' ').trim().slice(0,50);if(!id||!newName)die('Group ID and new name are required.');const g=await groups.findOne({id});if(!g)return die('Group not found.');await groups.updateOne({id},{$set:{name:newName,updatedAt:Date.now()}});console.log(`Renamed group ${id} to ${newName}.`);return;
  }
  if(command==='delete-group'){
    const id=gid(args[0]);if(!id)die('Group ID is required.');const g=await groups.findOne({id});if(!g)return die('Group not found.');const ok=await confirm(`DELETE group "${g.name}" and its retained messages?`);if(!ok)return console.log('Cancelled.');await groups.deleteOne({id});const r=await messages.deleteMany({kind:'group',chatKey:id});console.log(`Deleted group ${g.name}; removed ${r.deletedCount} retained messages.`);return;
  }
  if(command==='remove-user'){
    const n=name(args[0]),purge=args.includes('--purge-chats');if(!n)die('Username is required.');const u=await accounts.findOne({nameLower:n.toLowerCase()});if(!u)return console.log('User not found.');const ok=await confirm(`REMOVE account "${u.name}"${purge?' and PURGE its retained direct/group chat data':''}?`);if(!ok)return console.log('Cancelled.');
    const gs=await groups.find({membersLower:u.nameLower}).toArray();let deletedGroups=0,updatedGroups=0;
    for(const g of gs){const idx=g.membersLower.indexOf(u.nameLower);if(idx>=0){g.members.splice(idx,1);g.membersLower.splice(idx,1)}if(!g.members.length||g.createdBy.toLowerCase()===u.nameLower){await groups.deleteOne({id:g.id});await messages.deleteMany({kind:'group',chatKey:g.id});deletedGroups++;}else{g.updatedAt=Date.now();await groups.updateOne({id:g.id},{$set:{members:g.members,membersLower:g.membersLower,updatedAt:g.updatedAt}});updatedGroups++}}
    let purged=0;if(purge){const r=await messages.deleteMany({$or:[{from:u.name},{to:u.name}]});purged=r.deletedCount}
    await accounts.deleteOne({nameLower:u.nameLower});console.log(`Removed account ${u.name}. Updated ${updatedGroups} groups, deleted ${deletedGroups} groups${purge?`, purged ${purged} retained messages`:''}.`);return;
  }
  die('Unknown command: '+command);
 }catch(e){console.error('Admin command failed:',e.message);process.exitCode=1}finally{await c.close()}
})();
