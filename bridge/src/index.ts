import {createServer} from 'node:http';
import {existsSync,mkdirSync,chmodSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import lockfile from 'proper-lockfile';
import QRCode from 'qrcode';
import whatsapp from 'whatsapp-web.js';
import {signedHeaders} from '../../selligate/protocol.ts';
import {Journal} from './journal.ts';
import {dispatchOnce,flushReports,type Control} from './runner.ts';
const {Client,LocalAuth}=whatsapp;
process.umask(0o077);
const enabled=process.env.SELLIGATE_BRIDGE_ENABLED==='true';
const origin=new URL(process.env.RENOVA_URL||'https://shoprenova.com.ng');
if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('RENOVA_URL must be a plain HTTPS origin.');
const secret=process.env.SELLIGATE_BRIDGE_SECRET||'',key=process.env.SELLIGATE_BRIDGE_KEY_ID||'primary';
if(secret.length<32||/^REPLACE_/i.test(secret))throw new Error('Configure a strong bridge service secret.');
const dataDir=resolve(process.env.SELLIGATE_DATA_DIR||'/data');mkdirSync(dataDir,{recursive:true,mode:0o700});chmodSync(dataDir,0o700);
// Keep the singleton lock on the writable volume when the container root is read-only.
const releaseLock=await lockfile.lock(dataDir,{lockfilePath:join(dataDir,'.renova-bridge.lock'),realpath:true,stale:30000,update:5000,retries:0});
const journal=new Journal(join(dataDir,'dispatch-journal.sqlite'));
const instanceId=randomUUID();let status='DISCONNECTED',qr:string|null=null,qrAt=0,account:string|null=null,completedCommand:string|null=null,client:InstanceType<typeof Client>|null=null,starting=false,closing=false,lastSuccess=0,lastGroupsAt=0,recoveryRequired=true;
let groups:Array<{id:string;name:string;canSend:boolean}>=[];
let control:Control={mode:'OFF',stopped:true,testGroup:null,productionGroup:null,generation:0,liveAllowed:false};
async function api(action:string,fields:Record<string,unknown>={}){const path='/api/selligate/bridge',body=JSON.stringify({action,instanceId,...fields});const r=await fetch(new URL(path,origin),{method:'POST',headers:signedHeaders(secret,'POST',path,body,key),body,redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`CONTROL_${r.status}`);return r.json();}
async function validGroup(id:string){if(status!=='CONNECTED'||!client||!/^\d{5,25}(?:-\d{5,20})?@g\.us$/.test(id))return false;const chat=await client.getChatById(id);if(!chat.isGroup||chat.isReadOnly||chat.id._serialized!==id)return false;const participants=(chat as import('whatsapp-web.js').GroupChat).participants;const ids=[client.info?.wid?._serialized,(client.info as any)?.lid?._serialized].filter(Boolean);return participants.some(p=>ids.includes(p.id._serialized));}
async function discover(){if(!client||status!=='CONNECTED')return;const chats=await client.getChats();const next=[];for(const chat of chats.filter(c=>c.isGroup)){const id=chat.id._serialized;let canSend=false;try{canSend=await validGroup(id);}catch{}next.push({id,name:chat.name,canSend});}groups=next.slice(0,500);lastGroupsAt=Date.now();}
async function destroy(revoke=false){control.stopped=true;status='DISCONNECTED';qr=null;groups=[];account=null;const old=client;client=null;if(old){try{if(revoke)await old.logout();}catch{console.error('Remote revocation could not be confirmed. Remove this device in WhatsApp Linked Devices.');}finally{await old.destroy().catch(()=>{});}}if(revoke)rmSync(join(dataDir,'auth'),{recursive:true,force:true});}
async function start(){if(!enabled||client||starting)return;starting=true;status='RECONNECTING';try{
 const c=new Client({authStrategy:new LocalAuth({clientId:'renova-selligate',dataPath:join(dataDir,'auth')}),puppeteer:{headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--disable-dev-shm-usage']},webVersionCache:{type:'none'},takeoverOnConflict:false,deviceName:'Renova Selligate',qrMaxRetries:5});client=c;
 c.on('qr',async value=>{qr=await QRCode.toDataURL(value,{width:256,margin:2});qrAt=Date.now();status='AUTHENTICATION_REQUIRED';});
 c.on('ready',()=>{status='CONNECTED';qr=null;account=c.info?.wid?.user||null;void Promise.all([c.setAutoDownloadAudio(false),c.setAutoDownloadDocuments(false),c.setAutoDownloadPhotos(false),c.setAutoDownloadVideos(false),c.setBackgroundSync(false)]).catch(()=>{});void discover().catch(()=>{groups=[];});});
 c.on('auth_failure',()=>{status='AUTHENTICATION_REQUIRED';qr=null;control.stopped=true;});
 c.on('disconnected',()=>{status='DISCONNECTED';qr=null;control.stopped=true;});
 // No message/chat-content handlers: only acknowledgements for our own journal.
 c.on('message_ack',(message,ack)=>{if(message.fromMe&&message.id?._serialized)journal.ack(message.id._serialized,ack);});
 void c.initialize().catch(()=>{status='DISCONNECTED';control.stopped=true;});
 }finally{starting=false;}}
const server=createServer((req,res)=>{if(req.url!=='/healthz'){res.writeHead(404).end();return;}const healthy=Date.now()-lastSuccess<25000;res.writeHead(healthy?200:503,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify({ok:healthy,enabled,status}));});
server.listen(Number(process.env.PORT||8787),'127.0.0.1');
if(enabled&&existsSync(join(dataDir,'auth','session-renova-selligate')))await start();
async function tick(){
 try{
  if(status==='CONNECTED'&&Date.now()-lastGroupsAt>20000)await discover();
  const next=await api('heartbeat',{status:enabled?status:'DISCONNECTED',account,groups,recoveryRequired,qr:qr&&Date.now()-qrAt<40000?qr:null,completedCommand});control=next;lastSuccess=Date.now();recoveryRequired=false;
  if(next.commandId&&next.commandId!==completedCommand){
   if(next.command==='REVOKE'){await destroy(true);completedCommand=next.commandId;}
   else if(next.command==='PAIR'&&enabled){await destroy();await start();completedCommand=next.commandId;}
   else if(next.command==='GROUPS'){await discover();completedCommand=next.commandId;}
  }
  await flushReports(api,journal);
  if(enabled)await dispatchOnce(api,journal,{validate:validGroup,send:async(id,message)=>{if(!client||status!=='CONNECTED')throw new Error('Disconnected');const sent=await client.sendMessage(id,message,{sendSeen:false,linkPreview:false});return {id:sent.id._serialized,ack:sent.ack};}},()=>control,()=>status==='CONNECTED');
 }catch{control.stopped=true;recoveryRequired=true;console.error('Selligate bridge paused; check owner console and service health.');}
}
async function shutdown(){if(closing)return;closing=true;control.stopped=true;await destroy().catch(()=>{});try{await api('heartbeat',{status:'DISCONNECTED',groups:[]});}catch{}server.close();journal.close();await releaseLock();process.exit(0);}
process.on('SIGTERM',()=>void shutdown());process.on('SIGINT',()=>void shutdown());
while(!closing){await tick();await new Promise(r=>setTimeout(r,5000));}
