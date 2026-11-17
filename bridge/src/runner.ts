import {digest} from '../../selligate/protocol.ts';
import type {Journal,Pending} from './journal.ts';
export type Control={mode:string;stopped:boolean;testGroup:string|null;productionGroup:string|null;generation:number;liveAllowed:boolean};
export type BridgeApi=(action:string,input?:Record<string,unknown>)=>Promise<any>;
export type GroupAdapter={validate:(id:string)=>Promise<boolean>;send:(id:string,message:string)=>Promise<{id:string;ack?:number}>};
export async function dispatchOnce(api:BridgeApi,journal:Journal,adapter:GroupAdapter,control:()=>Control,connected:()=>boolean){
 const current=control();if(current.stopped||current.mode==='OFF'||!connected())return;
 const {job}=await api('claim');if(!job)return;
 if(!connected()){await api('reject',{jobId:job.id,claimToken:job.claimToken,reason:'WHATSAPP_DISCONNECTED'});return;}
 let valid=false;try{valid=await adapter.validate(job.destination);}catch{/* No send has started. */}
 if(!valid){await api('reject',{jobId:job.id,claimToken:job.claimToken,reason:'GROUP_UNAVAILABLE'});return;}
 const auth=await api('authorize',{jobId:job.id,claimToken:job.claimToken});if(!auth.allowed)return;
 const outcome:Pending={jobId:job.id,attemptToken:auth.attemptToken,result:'UNCERTAIN'};
 if(journal.has(auth.attemptToken))return; // A repeated authorisation never repeats a send.
 journal.begin(job.id,auth.attemptToken);
 try {
  const c=control();const expected=job.mode==='TEST'?c.testGroup:c.productionGroup;
  if(journal.sentForJob(job.id))throw new Error('A confirmed local send already exists.');
  if(!/^\d{5,25}(?:-\d{5,20})?@g\.us$/.test(auth.destination)||auth.destination!==job.destination||auth.destination!==expected||c.testGroup===c.productionGroup||c.stopped||c.mode!==job.mode||c.generation!==auth.generation||!connected()||(job.mode==='LIVE'&&!c.liveAllowed)||digest(auth.message)!==auth.bodyHash){outcome.result='NOT_ATTEMPTED';return;}
  // Last remote mode/STOP check immediately before the external call.
  const permit=await api('permit',{jobId:job.id,attemptToken:auth.attemptToken});
  const latest=control();
  if(!permit.allowed||latest.stopped||latest.mode!==job.mode||!connected()){outcome.result='NOT_ATTEMPTED';return;}
  journal.calling(auth.attemptToken);
  const sent=await adapter.send(auth.destination,auth.message);
  if(!sent.id)throw new Error('No stable WhatsApp message ID.');
  outcome.result='SENT';outcome.messageId=sent.id;
  journal.finish(outcome);if(Number.isInteger(sent.ack))journal.ack(sent.id,sent.ack!);
 }catch{/* Any failure after authorisation is conservatively UNCERTAIN. */}
 finally{journal.finish(outcome);try{await api('outcome',outcome);journal.reported(outcome.attemptToken);}catch{/* Persist report for retry; never repeat the WhatsApp call. */}}
}
export async function flushReports(api:BridgeApi,journal:Journal){for(const p of journal.pending()){await api('outcome',p);journal.reported(p.attemptToken);}for(const a of journal.pendingAcks()){await api('ack',a);journal.ackReported(String(a.attemptToken),Number(a.ack));}}
