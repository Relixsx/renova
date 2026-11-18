import {randomUUID} from 'node:crypto';
import {DispatchError,RELEASE,STATES,evaluate,fictionalOrder,formatMessage,groupId,parseOrder,validateGroups,validateStateCodes,type Mode} from './core';
import {digest} from './protocol';
export type Database={query:(sql:string,values?:unknown[])=>Promise<{rows:Record<string,any>[]}>};
export type Gates={liveAllowed:boolean;validatedBuild:boolean};
export class SelligateService {
 constructor(private db:Database,private gates:Gates){}
 private async audit(actor:string,action:string,details:Record<string,unknown>={}){await this.db.query('INSERT INTO selligate.audit(actor,action,details) VALUES($1,$2,$3::jsonb)',[actor,action,JSON.stringify(details)]);}
 private async settings(){const r=(await this.db.query('SELECT * FROM selligate.settings WHERE id=1 FOR UPDATE')).rows[0];if(!r)throw new DispatchError('MIGRATION_REQUIRED',503);return r;}
 private async connection(){return (await this.db.query("SELECT *,heartbeat_at>now()-interval '25 seconds' AS fresh FROM selligate.connection WHERE id=1")).rows[0];}
 private async rules(){return Object.fromEntries((await this.db.query('SELECT p.slug,a.states FROM selligate.availability a JOIN public.products p ON p.id=a.product_id')).rows.map(r=>[r.slug,r.states])) as Record<string,string[]>;}
 private groupReady(c:Record<string,any>,id:string|null){return Boolean(id&&c?.fresh&&c.status==='CONNECTED'&&c.groups_at&&Date.now()-new Date(c.groups_at).getTime()<45000&&c.groups.some((g:any)=>g.id===id&&g.canSend===true));}
 private async expire(){
  await this.db.query("UPDATE selligate.jobs SET status='UNCERTAIN',reason='SENDING_LEASE_EXPIRED',updated_at=now() WHERE status='SENDING' AND lease_until<now()");
  await this.db.query("UPDATE selligate.attempts SET status='UNCERTAIN',reason='SENDING_LEASE_EXPIRED',finished_at=now() WHERE status='SENDING' AND job_id IN(SELECT id FROM selligate.jobs WHERE status='UNCERTAIN')");
  await this.db.query("UPDATE selligate.jobs SET status='QUEUED',claim_token=NULL,lease_until=NULL,updated_at=now() WHERE status='CLAIMED' AND lease_until<now()");
  await this.db.query('UPDATE selligate.connection SET qr_data=NULL,qr_expires_at=NULL WHERE qr_expires_at<now()');
  await this.db.query('DELETE FROM selligate.nonces WHERE expires_at<now()');
  await this.db.query("DELETE FROM selligate.audit WHERE created_at<now()-interval '90 days'");
  await this.db.query("DELETE FROM selligate.acks WHERE observed_at<now()-interval '90 days'");
  await this.db.query("UPDATE selligate.jobs SET decisions='[]',fixture=CASE WHEN mode='TEST' THEN '{}'::jsonb ELSE NULL END WHERE updated_at<now()-interval '30 days' AND status IN('SENT','SKIPPED','CANCELLED') AND decisions<>'[]'::jsonb");
 }
 private async halt(actor:string,reason:string){await this.db.query('UPDATE selligate.settings SET stopped=true,generation=generation+1,updated_at=now(),updated_by=$1 WHERE id=1',[actor]);await this.db.query("UPDATE selligate.jobs SET status='CANCELLED',reason=$1,claim_token=NULL,lease_until=NULL,updated_at=now() WHERE status IN('QUEUED','CLAIMED')",[reason]);await this.audit(actor,'STOP',{reason});}
 async dashboard(){
  const settings=await this.settings();await this.expire();const c=await this.connection();
  if(c.status==='CONNECTED'&&!c.fresh&&!settings.stopped){await this.halt('system','BRIDGE_HEARTBEAT_EXPIRED');settings.stopped=true;}
  const products=(await this.db.query("SELECT p.id,p.slug,p.name,p.sku,COALESCE(a.states,'{}') AS states,a.updated_at,a.updated_by FROM public.products p LEFT JOIN selligate.availability a ON p.id=a.product_id ORDER BY p.name")).rows;
  const history=(await this.db.query('SELECT id,order_number,mode,status,destination,decisions,state_code,partial,reason,attempts,message_id,ack,created_at,updated_at FROM selligate.jobs ORDER BY created_at DESC LIMIT 100')).rows;
  const audit=(await this.db.query('SELECT action,actor,details,created_at FROM selligate.audit ORDER BY id DESC LIMIT 20')).rows;
  return {settings,products,history,audit,states:STATES,release:RELEASE,connection:{status:c.fresh?c.status:'DISCONNECTED',account:c.account,heartbeatAt:c.heartbeat_at,groups:c.fresh?c.groups:[],qr:c.qr_expires_at&&new Date(c.qr_expires_at).getTime()>Date.now()?c.qr_data:null,qrExpiresAt:c.qr_expires_at,command:c.command},readiness:{connected:c.fresh&&c.status==='CONNECTED',productionGroup:this.groupReady(c,settings.production_group),rulesConfigured:products.some(p=>p.states.length>0),validatedBuild:this.gates.validatedBuild,liveAllowed:this.gates.liveAllowed,ownerApproved:Boolean(settings.live_approved_at)}};
 }
 async configure(actor:string,i:Record<string,unknown>){
  const s=await this.settings();
  if(i.action==='stop'){await this.halt(actor,'OWNER_EMERGENCY_STOP');return {ok:true};}
  if(i.action==='mode'){
   const mode=i.mode as Mode;if(!['OFF','TEST','LIVE'].includes(mode))throw new DispatchError('INVALID_MODE');
   if(mode==='LIVE'){
    if(!this.gates.liveAllowed||!this.gates.validatedBuild||!this.groupReady(await this.connection(),s.production_group)||!Object.values(await this.rules()).some(v=>v.length))throw new DispatchError('LIVE_READINESS_INCOMPLETE',409);
    if(i.confirmation!=='ENABLE LIVE DISPATCH')throw new DispatchError('OWNER_CONFIRMATION_REQUIRED');
   }
   await this.halt(actor,'MODE_CHANGED');await this.db.query("UPDATE selligate.settings SET mode=$1,stopped=$2,live_approved_at=CASE WHEN $1='LIVE' THEN now() ELSE NULL END,live_approved_by=CASE WHEN $1='LIVE' THEN $3 ELSE NULL END WHERE id=1",[mode,mode==='OFF',actor]);await this.audit(actor,'MODE_CHANGED',{from:s.mode,to:mode});return {ok:true};
  }
  if(i.action==='resume'){
   if(s.mode==='OFF'||(s.mode==='LIVE'&&(!this.gates.liveAllowed||!this.gates.validatedBuild||!s.live_approved_at)))throw new DispatchError('SELECT_AUTHORISED_MODE_FIRST',409);
   if(!this.groupReady(await this.connection(),s.mode==='LIVE'?s.production_group:s.test_group))throw new DispatchError('DESTINATION_NOT_READY',409);
   if(i.confirmation!=='RESUME NEW DISPATCHES')throw new DispatchError('OWNER_CONFIRMATION_REQUIRED');
   await this.db.query('UPDATE selligate.settings SET stopped=false,generation=generation+1,updated_at=now(),updated_by=$1 WHERE id=1',[actor]);await this.audit(actor,'RESUMED_NEW_ONLY');return {ok:true};
  }
  if(i.action==='groups'){
   const test=i.testGroup?groupId(i.testGroup):null,production=i.productionGroup?groupId(i.productionGroup):null;validateGroups(test,production);const c=await this.connection();
   if((test&&!this.groupReady(c,test))||(production&&!this.groupReady(c,production)))throw new DispatchError('GROUP_NOT_VALIDATED',409);
   await this.halt(actor,'DESTINATION_CHANGED');await this.db.query('UPDATE selligate.settings SET test_group=$1,production_group=$2,live_approved_at=NULL,live_approved_by=NULL WHERE id=1',[test,production]);await this.audit(actor,'GROUPS_SELECTED',{test,production});return {ok:true};
  }
  if(i.action==='availability'){
   const id=Number(i.productId);if(!Number.isSafeInteger(id)||id<1)throw new DispatchError('INVALID_PRODUCT');if(!(await this.db.query('SELECT id FROM public.products WHERE id=$1',[id])).rows.length)throw new DispatchError('PRODUCT_NOT_FOUND',404);
   const states=validateStateCodes(i.states);await this.db.query('INSERT INTO selligate.availability(product_id,states,updated_by) VALUES($1,$2::text[],$3) ON CONFLICT(product_id) DO UPDATE SET states=excluded.states,updated_by=excluded.updated_by,updated_at=now()',[id,states,actor]);await this.audit(actor,'AVAILABILITY_SAVED',{productId:id,states});return {ok:true};
  }
  if(['connect','disconnect','refreshGroups'].includes(String(i.action))){
   if(i.action==='connect'&&i.confirmation!=='LINK MY DEDICATED NUMBER')throw new DispatchError('ACCOUNT_AUTHORISATION_REQUIRED');
   if(i.action!=='refreshGroups')await this.halt(actor,i.action==='disconnect'?'OWNER_REVOKED_SESSION':'PAIRING_REQUESTED');
   const command=i.action==='connect'?'PAIR':i.action==='disconnect'?'REVOKE':'GROUPS';await this.db.query('UPDATE selligate.connection SET command=$1,command_id=$2,qr_data=NULL,qr_expires_at=NULL WHERE id=1',[command,randomUUID()]);await this.audit(actor,'CONNECTION_COMMAND',{command});return {ok:true};
  }
  throw new DispatchError('UNKNOWN_ACTION');
 }
 async simulation(actor:string,i:Record<string,unknown>){
  const s=await this.settings();const p=(await this.db.query('SELECT slug,name FROM public.products WHERE id=$1',[Number(i.productId)])).rows[0];if(!p)throw new DispatchError('PRODUCT_NOT_FOUND',404);
  const fixture=fictionalOrder(p as {slug:string;name:string},String(i.state),Number(i.quantity),`TEST-${randomUUID().slice(0,8).toUpperCase()}`),order=parseOrder(fixture),result=evaluate(order,await this.rules());
  const message=result.eligible.length?formatMessage(order,result,'TEST'):'No dispatch: this product is unavailable in the selected state.';
  if(i.action==='sendTest'){
   if(s.mode!=='TEST'||s.stopped||!this.groupReady(await this.connection(),s.test_group))throw new DispatchError('TEST_MODE_AND_TEST_GROUP_REQUIRED',409);
   if(i.confirmation!=='SEND FICTIONAL TEST')throw new DispatchError('EXPLICIT_TEST_REQUEST_REQUIRED');if(!result.eligible.length)throw new DispatchError('NOT_ELIGIBLE');
   await this.db.query("INSERT INTO selligate.jobs(id,order_number,mode,destination,generation,fixture,decisions,state_code) VALUES($1,$2,'TEST',$3,$4,$5::jsonb,$6::jsonb,$7)",[randomUUID(),order.number,s.test_group,s.generation,JSON.stringify(fixture),JSON.stringify(result.decisions),result.state]);await this.audit(actor,'FICTIONAL_TEST_QUEUED',{reference:order.number});
  }
  return {dryRun:i.action!=='sendTest',result,message};
 }
 private async job(id:unknown){if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))throw new DispatchError('INVALID_JOB');const j=(await this.db.query('SELECT * FROM selligate.jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!j)throw new DispatchError('JOB_NOT_FOUND',404);return j;}
 private async evaluateJob(j:Record<string,any>){
  const row=j.mode==='TEST'?j.fixture:(await this.db.query('SELECT * FROM public.orders WHERE id=$1',[j.order_id])).rows[0];if(!row)throw new DispatchError('ORDER_UNAVAILABLE');
  if(j.mode==='LIVE'&&!['confirmed','processing','packaged'].includes(row.status))throw new DispatchError('ORDER_NO_LONGER_AWAITING_FULFILMENT');
  const order=parseOrder(row),result=evaluate(order,await this.rules());await this.db.query('UPDATE selligate.jobs SET decisions=$2::jsonb,state_code=$3,partial=$4,updated_at=now() WHERE id=$1',[j.id,JSON.stringify(result.decisions),result.state,result.partial]);
  return {order,result,message:result.eligible.length?formatMessage(order,result,j.mode):null};
 }
 async historyAction(actor:string,i:Record<string,unknown>){
  const s=await this.settings(),j=await this.job(i.jobId);
  if(i.action==='previewJob'){const e=await this.evaluateJob(j);await this.audit(actor,'MANUAL_PREVIEW',{jobId:j.id});return {message:e.message,decisions:e.result.decisions};}
  if(i.action==='markManual'){
   if(!['FAILED','CANCELLED','UNCERTAIN','QUEUED','SKIPPED'].includes(j.status)||i.confirmation!=='I SENT THIS MANUALLY')throw new DispatchError('MANUAL_CONFIRMATION_REQUIRED');
   await this.db.query("UPDATE selligate.jobs SET status='SENT',reason='OWNER_RECORDED_MANUAL_DISPATCH',updated_at=now() WHERE id=$1",[j.id]);await this.audit(actor,'MANUAL_DISPATCH_RECORDED',{jobId:j.id});return {ok:true};
  }
  if(i.action!=='retry'||!['FAILED','CANCELLED','UNCERTAIN'].includes(j.status))throw new DispatchError('JOB_NOT_RETRYABLE',409);
  if(s.mode!==j.mode||s.stopped||j.destination!==(j.mode==='TEST'?s.test_group:s.production_group))throw new DispatchError('ORIGINAL_MODE_AND_GROUP_REQUIRED',409);
  if(i.confirmation!==(j.status==='UNCERTAIN'?'I CHECKED THE GROUP AND NO MESSAGE WAS SENT':'RETRY THIS DISPATCH'))throw new DispatchError('RETRY_CONFIRMATION_REQUIRED');
  if(j.message_id)throw new DispatchError('MESSAGE_ALREADY_IDENTIFIED_RECONCILE_MANUALLY',409);
  await this.db.query("UPDATE selligate.jobs SET status='QUEUED',generation=$2,reason=NULL,claim_token=NULL,attempt_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1",[j.id,s.generation]);await this.audit(actor,'OWNER_RETRY',{jobId:j.id,previousStatus:j.status});return {ok:true};
 }
 async heartbeat(i:Record<string,any>){
  await this.settings();await this.expire();if(typeof i.instanceId!=='string'||!/^[0-9a-f-]{36}$/.test(i.instanceId)||!['CONNECTED','DISCONNECTED','RECONNECTING','AUTHENTICATION_REQUIRED'].includes(i.status))throw new DispatchError('INVALID_HEARTBEAT');
  const old=await this.connection();if(old.fresh&&old.instance_id&&old.instance_id!==i.instanceId)throw new DispatchError('ANOTHER_BRIDGE_IS_ACTIVE',409);
  if(i.recoveryRequired===true||old.instance_id!==i.instanceId||!old.fresh||(old.status==='CONNECTED'&&i.status!=='CONNECTED'))await this.halt('bridge','CONNECTION_RESTART_REQUIRES_OWNER_RESUME');
  const account=typeof i.account==='string'&&/^\+?\d{5,20}$/.test(i.account)?i.account:null;
  let groups:Array<{id:string;name:string;canSend:boolean}>|null=null;
  if(i.groups!=null){if(!Array.isArray(i.groups)||i.groups.length>500)throw new DispatchError('INVALID_GROUP_LIST');groups=i.groups.map((g:any)=>({id:groupId(g.id),name:String(g.name||'Group').slice(0,200),canSend:g.canSend===true}));}
  const qr=i.status==='AUTHENTICATION_REQUIRED'&&typeof i.qr==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(i.qr)&&i.qr.length<60000?i.qr:null;
  await this.db.query("UPDATE selligate.connection SET instance_id=$1,status=$2,account=$3,heartbeat_at=now(),groups=CASE WHEN $4::jsonb IS NULL THEN groups ELSE $4::jsonb END,groups_at=CASE WHEN $4::jsonb IS NULL THEN groups_at ELSE now() END,qr_data=$5,qr_expires_at=CASE WHEN $5::text IS NOT NULL THEN now()+interval '45 seconds' ELSE NULL END WHERE id=1",[i.instanceId,i.status,account,groups?JSON.stringify(groups):null,qr]);
  if(i.completedCommand&&i.completedCommand===old.command_id)await this.db.query('UPDATE selligate.connection SET command=NULL,command_id=NULL WHERE id=1 AND command_id=$1',[i.completedCommand]);
  const s=await this.settings(),c=await this.connection();return {mode:s.mode,stopped:s.stopped,generation:s.generation,testGroup:s.test_group,productionGroup:s.production_group,command:c.command,commandId:c.command_id,liveAllowed:this.gates.liveAllowed};
 }
 private async canRun(s:Record<string,any>,j?:Record<string,any>){if(s.stopped||s.mode==='OFF'||(s.mode==='LIVE'&&(!this.gates.liveAllowed||!this.gates.validatedBuild||!s.live_approved_at)))return false;if(j&&(j.mode!==s.mode||j.generation!==s.generation||j.destination!==(j.mode==='TEST'?s.test_group:s.production_group)))return false;return this.groupReady(await this.connection(),s.mode==='TEST'?s.test_group:s.production_group);}
 private async fail(id:string,e:unknown){await this.db.query("UPDATE selligate.jobs SET status='FAILED',reason=$2,updated_at=now() WHERE id=$1",[id,e instanceof DispatchError?e.code:'ORDER_EVALUATION_FAILED']);}
 async claim(){
  const s=await this.settings();await this.expire();if(!await this.canRun(s))return {job:null};
  const j=(await this.db.query("SELECT * FROM selligate.jobs WHERE status='QUEUED' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED")).rows[0];if(!j)return {job:null};
  if(!await this.canRun(s,j)){await this.db.query("UPDATE selligate.jobs SET status='CANCELLED',reason='STALE_MODE_OR_DESTINATION',updated_at=now() WHERE id=$1",[j.id]);return {job:null};}
  try{const e=await this.evaluateJob(j);if(!e.message){await this.db.query("UPDATE selligate.jobs SET status='SKIPPED',reason='NO_ELIGIBLE_ITEMS',updated_at=now() WHERE id=$1",[j.id]);return {job:null};}const token=randomUUID();await this.db.query("UPDATE selligate.jobs SET status='CLAIMED',claim_token=$2,lease_until=now()+interval '45 seconds',updated_at=now() WHERE id=$1",[j.id,token]);return {job:{id:j.id,mode:j.mode,destination:j.destination,claimToken:token,generation:j.generation}};}catch(e){if(!(e instanceof DispatchError))throw e;await this.fail(j.id,e);return {job:null};}
 }
 async authorize(i:Record<string,unknown>){
  const s=await this.settings(),j=await this.job(i.jobId);if(j.status!=='CLAIMED'||j.claim_token!==i.claimToken||new Date(j.lease_until).getTime()<=Date.now()||!await this.canRun(s,j))throw new DispatchError('SEND_NOT_AUTHORISED',409);
  try{const e=await this.evaluateJob(j);if(!e.message){await this.db.query("UPDATE selligate.jobs SET status='SKIPPED',reason='NO_ELIGIBLE_ITEMS',updated_at=now() WHERE id=$1",[j.id]);return {allowed:false};}const token=randomUUID(),bodyHash=digest(e.message);await this.db.query("INSERT INTO selligate.attempts(token,job_id,number,status,body_hash) VALUES($1,$2,$3,'SENDING',$4)",[token,j.id,j.attempts+1,bodyHash]);await this.db.query("UPDATE selligate.jobs SET status='SENDING',attempt_token=$2,attempts=attempts+1,lease_until=now()+interval '2 minutes',updated_at=now() WHERE id=$1",[j.id,token]);return {allowed:true,attemptToken:token,destination:j.destination,message:e.message,bodyHash,mode:j.mode,generation:j.generation};}catch(e){if(!(e instanceof DispatchError))throw e;await this.fail(j.id,e);return {allowed:false};}
 }
 async permit(i:Record<string,unknown>){const s=await this.settings(),j=await this.job(i.jobId);if(j.status!=='SENDING'||j.attempt_token!==i.attemptToken||new Date(j.lease_until).getTime()<=Date.now()||!await this.canRun(s,j))return {allowed:false};try{const e=await this.evaluateJob(j),a=(await this.db.query('SELECT body_hash FROM selligate.attempts WHERE token=$1',[j.attempt_token])).rows[0];return {allowed:Boolean(e.message&&a&&digest(e.message)===a.body_hash)};}catch(e){if(e instanceof DispatchError)return {allowed:false};throw e;}}
 async reject(i:Record<string,unknown>){await this.settings();const j=await this.job(i.jobId);if(j.status!=='CLAIMED'||j.claim_token!==i.claimToken)throw new DispatchError('INVALID_CLAIM',409);if(!['GROUP_UNAVAILABLE','WHATSAPP_DISCONNECTED'].includes(String(i.reason)))throw new DispatchError('INVALID_REASON');await this.db.query("UPDATE selligate.jobs SET status='FAILED',reason=$2,updated_at=now() WHERE id=$1",[j.id,i.reason]);return {ok:true};}
 async outcome(i:Record<string,unknown>){
  await this.settings();const j=await this.job(i.jobId);
  if(!['SENT','UNCERTAIN','NOT_ATTEMPTED'].includes(String(i.result)))throw new DispatchError('INVALID_OUTCOME');
  const messageId=typeof i.messageId==='string'&&/^[A-Za-z0-9_@.:-]{5,300}$/.test(i.messageId)?i.messageId:null;
  if(i.result==='SENT'&&!messageId)throw new DispatchError('MESSAGE_ID_REQUIRED');
  if(j.attempt_token!==i.attemptToken){
   // A report can arrive after an owner-approved retry. Consume the old report
   // without resending; a late confirmed message stops all further dispatch.
   const previous=(await this.db.query('SELECT * FROM selligate.attempts WHERE token=$1 AND job_id=$2',[i.attemptToken,j.id])).rows[0];
   if(!previous)throw new DispatchError('INVALID_ATTEMPT',409);
   if(i.result==='SENT'){
    await this.db.query("UPDATE selligate.attempts SET status='SENT',message_id=$2,finished_at=now() WHERE token=$1",[i.attemptToken,messageId]);
    await this.halt('bridge','LATE_PRIOR_SEND_REQUIRES_REVIEW');
    await this.db.query("UPDATE selligate.jobs SET status='UNCERTAIN',message_id=$2,reason='LATE_PRIOR_SEND_REQUIRES_REVIEW',updated_at=now() WHERE id=$1",[j.id,messageId]);
    await this.audit('bridge','LATE_CONFIRMED_SEND',{jobId:j.id});
   }else if(previous.status!=='SENT'){
    await this.db.query("UPDATE selligate.attempts SET status=$2,finished_at=now() WHERE token=$1",[i.attemptToken,i.result==='NOT_ATTEMPTED'?'CANCELLED':'UNCERTAIN']);
   }
   return {ok:true,superseded:true};
  }
  if(!['SENDING','UNCERTAIN','SENT','CANCELLED'].includes(j.status))throw new DispatchError('INVALID_ATTEMPT',409);
  if(j.status==='SENT'||(j.status==='CANCELLED'&&i.result!=='SENT'))return {ok:true};
  const status=i.result==='NOT_ATTEMPTED'?'CANCELLED':String(i.result),reason=status==='UNCERTAIN'?'SEND_OUTCOME_AMBIGUOUS_REVIEW_GROUP':status==='CANCELLED'?'SEND_BLOCKED_BEFORE_CALL':null;
  await this.db.query('UPDATE selligate.jobs SET status=$2,message_id=$3,reason=$4,lease_until=NULL,updated_at=now() WHERE id=$1',[j.id,status,messageId,reason]);
  await this.db.query('UPDATE selligate.attempts SET status=$2,message_id=$3,reason=$4,finished_at=now() WHERE token=$1',[j.attempt_token,status,messageId,reason]);
  await this.audit('bridge','SEND_OUTCOME',{jobId:j.id,status});return {ok:true};
 }
 async acknowledge(i:Record<string,unknown>){
  const ack=Number(i.ack);if(!Number.isInteger(ack)||ack< -1||ack>4||typeof i.messageId!=='string')throw new DispatchError('INVALID_ACK');
  await this.settings();const j=await this.job(i.jobId);
  const attempt=(await this.db.query('SELECT token FROM selligate.attempts WHERE token=$1 AND job_id=$2 AND message_id=$3',[i.attemptToken,j.id,i.messageId])).rows[0];
  if(!attempt)throw new DispatchError('UNRECOGNISED_MESSAGE',409);
  await this.db.query('INSERT INTO selligate.acks(job_id,message_id,ack) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[j.id,i.messageId,ack]);
  if(j.message_id===i.messageId)await this.db.query('UPDATE selligate.jobs SET ack=CASE WHEN ack IS NULL THEN $2 ELSE GREATEST(ack,$2) END WHERE id=$1',[j.id,ack]);
  return {ok:true};
 }
}
