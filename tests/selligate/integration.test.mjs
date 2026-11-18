import test from 'node:test';import assert from 'node:assert/strict';import {fixture,TEST,PRODUCTION,instanceId} from './fixture.mjs';
const owner='owner@example.test';
test('migration is additive, defaults OFF/STOP and never backfills sending jobs',()=>fixture(async c=>{const d=await c.tx(s=>s.dashboard());assert.equal(d.settings.mode,'OFF');assert.equal(d.settings.stopped,true);await c.place();assert.equal((await c.jobs()).length,0);}));
test('OFF preserves new orders but creates no sending jobs',()=>fixture(async c=>{await c.available();await c.place();assert.equal((await c.q('SELECT count(*)::int n FROM public.orders')).rows[0].n,1);assert.equal((await c.jobs()).length,0);assert.equal((await c.api('claim')).job,null);}));
test('confirmed COD and processing lifecycle events create one durable LIVE job',()=>fixture(async c=>{await c.configure();const o=await c.place();await c.q("UPDATE public.orders SET status='processing' WHERE id=$1",[o.id]);await c.q("UPDATE public.orders SET status='confirmed' WHERE id=$1",[o.id]);assert.equal((await c.jobs()).length,1);assert.equal((await c.jobs())[0].destination,PRODUCTION);}));
test('pending checkout attempt does not dispatch until existing placed-order lifecycle event',()=>fixture(async c=>{await c.configure();const o=await c.place({status:'payment_pending'});assert.equal((await c.jobs()).length,0);await c.q("UPDATE public.orders SET status='processing' WHERE id=$1",[o.id]);assert.equal((await c.jobs()).length,1);}));
test('routing adds no payment eligibility rule',()=>fixture(async c=>{await c.configure();await c.place({payment:'arbitrary-owner-managed-state'});const {job}=await c.api('claim');assert.ok(job);}));
test('unavailable product is SKIPPED with every item decision saved',()=>fixture(async c=>{await c.configure();await c.place({state:'OY'});assert.equal((await c.api('claim')).job,null);const j=(await c.jobs())[0];assert.equal(j.status,'SKIPPED');assert.equal(j.decisions[0].eligible,false);assert.equal(j.decisions[0].reason,'UNAVAILABLE_IN_STATE');}));
test('mixed items retain individual decisions and partial request',()=>fixture(async c=>{await c.configure();await c.available(2,['KN']);await c.place({items:[{slug:'anagen',name:'Available product',quantity:2},{slug:'book',name:'Unavailable book',quantity:1}]});const {job}=await c.api('claim');const auth=await c.api('authorize',{jobId:job.id,claimToken:job.claimToken});assert.match(auth.message,/PARTIAL/);assert.doesNotMatch(auth.message,/Unavailable book/);const j=(await c.jobs())[0];assert.equal(j.decisions.length,2);assert.equal(j.partial,true);}));
test('current availability is rechecked immediately before send authorisation',()=>fixture(async c=>{await c.configure();await c.place();const {job}=await c.api('claim');await c.available(1,[]);assert.equal((await c.api('authorize',{jobId:job.id,claimToken:job.claimToken})).allowed,false);assert.equal((await c.jobs())[0].status,'SKIPPED');}));
test('parallel workers never claim one job twice',()=>fixture(async c=>{await c.configure();await c.place();const [a,b]=await Promise.all([c.api('claim'),c.api('claim')]);assert.equal([a,b].filter(x=>x.job).length,1);}));
test('emergency STOP cancels queued jobs and revokes permission for authorised sends',()=>fixture(async c=>{await c.configure();await c.place();const {job}=await c.api('claim');const a=await c.api('authorize',{jobId:job.id,claimToken:job.claimToken});await c.tx(s=>s.configure(owner,{action:'stop'}));assert.equal((await c.api('permit',{jobId:job.id,attemptToken:a.attemptToken})).allowed,false);await c.place();assert.equal((await c.jobs()).length,1);}));
test('LIVE to OFF prevents new jobs and preserves history',()=>fixture(async c=>{await c.configure();await c.place();await c.tx(s=>s.configure(owner,{action:'mode',mode:'OFF'}));await c.place();const jobs=await c.jobs();assert.equal(jobs.length,1);assert.equal(jobs[0].status,'CANCELLED');}));
test('TEST cannot queue customer orders and needs explicit fictional-send approval',()=>fixture(async c=>{await c.configure('TEST');await c.place();assert.equal((await c.jobs()).length,0);await assert.rejects(c.tx(s=>s.simulation(owner,{action:'sendTest',productId:1,state:'LA',lga:'Ikeja',quantity:1})),/EXPLICIT_TEST_REQUEST/);const v=await c.tx(s=>s.simulation(owner,{action:'sendTest',productId:1,state:'LA',lga:'Ikeja',quantity:1,confirmation:'SEND FICTIONAL TEST'}));assert.equal(v.dryRun,false);assert.equal((await c.jobs())[0].destination,TEST);}));
test('TEST jobs never become LIVE jobs after mode changes',()=>fixture(async c=>{await c.configure('TEST');await c.tx(s=>s.simulation(owner,{action:'sendTest',productId:1,state:'LA',lga:'Ikeja',quantity:1,confirmation:'SEND FICTIONAL TEST'}));await c.tx(s=>s.configure(owner,{action:'mode',mode:'LIVE',confirmation:'ENABLE LIVE DISPATCH'}));const j=(await c.jobs())[0];assert.equal(j.mode,'TEST');assert.equal(j.destination,TEST);assert.equal(j.status,'CANCELLED');assert.equal((await c.api('claim')).job,null);}));
test('dry run works while OFF and creates neither orders nor jobs',()=>fixture(async c=>{await c.available();const v=await c.tx(s=>s.simulation(owner,{action:'simulate',productId:1,state:'LA',lga:'Ikeja',quantity:2}));assert.equal(v.dryRun,true);assert.equal(v.result.eligible.length,1);assert.equal((await c.jobs()).length,0);assert.equal((await c.q('SELECT count(*)::int n FROM public.orders')).rows[0].n,0);}));
test('equal test and production group selections are rejected',()=>fixture(async c=>{await c.heartbeat();await assert.rejects(c.tx(s=>s.configure(owner,{action:'groups',testGroup:TEST,productionGroup:TEST})),/GROUPS_MUST_DIFFER/);}));
test('unrecognised, inaccessible and stale group configurations fail safely',()=>fixture(async c=>{await c.heartbeat();await assert.rejects(c.tx(s=>s.configure(owner,{action:'groups',testGroup:'120363000009999@g.us'})),/GROUP_NOT_VALIDATED/);await c.q("UPDATE selligate.connection SET groups_at=now()-interval '1 minute'");await assert.rejects(c.tx(s=>s.configure(owner,{action:'groups',testGroup:TEST})),/GROUP_NOT_VALIDATED/);}));
test('disconnection stops sending and reconnect cancels backlog until owner resume',()=>fixture(async c=>{await c.configure();await c.place();await c.tx(s=>s.heartbeat({instanceId,status:'DISCONNECTED',groups:[]}));assert.equal((await c.api('claim')).job,null);await c.heartbeat();const d=await c.tx(s=>s.dashboard());assert.equal(d.settings.stopped,true);assert.equal((await c.jobs())[0].status,'CANCELLED');}));
test('second bridge instance cannot steal a fresh connection lease',()=>fixture(async c=>{await c.heartbeat();await assert.rejects(c.tx(s=>s.heartbeat({instanceId:'11111111-1111-1111-1111-111111111111',status:'CONNECTED',groups:[]})),/ANOTHER_BRIDGE/);}));
test('ambiguous sends never retry automatically, including worker restart',()=>fixture(async c=>{await c.configure();await c.place();const {job}=await c.api('claim');const a=await c.api('authorize',{jobId:job.id,claimToken:job.claimToken});await c.api('outcome',{jobId:job.id,attemptToken:a.attemptToken,result:'UNCERTAIN'});assert.equal((await c.api('claim')).job,null);await assert.rejects(c.tx(s=>s.historyAction(owner,{action:'retry',jobId:job.id,confirmation:'RETRY THIS DISPATCH'})),/RETRY_CONFIRMATION/);}));
test('expired SENDING lease becomes UNCERTAIN rather than QUEUED',()=>fixture(async c=>{await c.configure();await c.place();const {job}=await c.api('claim');await c.api('authorize',{jobId:job.id,claimToken:job.claimToken});await c.q("UPDATE selligate.jobs SET lease_until=now()-interval '1 minute'");await c.tx(s=>s.dashboard());assert.equal((await c.jobs())[0].status,'UNCERTAIN');}));
test('SENT reports are idempotent and delivery acknowledgement is separate',()=>fixture(async c=>{await c.configure();await c.place();const {job}=await c.api('claim');const a=await c.api('authorize',{jobId:job.id,claimToken:job.claimToken});const outcome={jobId:job.id,attemptToken:a.attemptToken,result:'SENT',messageId:'true_120363000000002@g.us_FAKE12345'};await c.api('outcome',outcome);await c.api('outcome',outcome);await c.api('outcome',{...outcome,result:'UNCERTAIN'});let j=(await c.jobs())[0];assert.equal(j.status,'SENT');assert.equal(j.ack,null);await c.api('ack',{...outcome,ack:2});await c.api('ack',{...outcome,ack:1});j=(await c.jobs())[0];assert.equal(j.ack,2);assert.equal((await c.api('claim')).job,null);}));
test('LIVE requires explicit owner confirmation',()=>fixture(async c=>{await c.configure('TEST');await assert.rejects(c.tx(s=>s.configure(owner,{action:'mode',mode:'LIVE'})),/OWNER_CONFIRMATION/);}));
test('deployment gate independently keeps LIVE locked',()=>fixture(async c=>{await c.configure('TEST');await assert.rejects(c.tx(s=>s.configure(owner,{action:'mode',mode:'LIVE',confirmation:'ENABLE LIVE DISPATCH'})),/LIVE_READINESS/);},{liveAllowed:false,validatedBuild:false}));

test('availability changes after authorisation invalidate final send permission',()=>fixture(async c=>{await c.configure();await c.place();const {job}=await c.api('claim');const a=await c.api('authorize',{jobId:job.id,claimToken:job.claimToken});await c.available(1,[]);assert.equal((await c.api('permit',{jobId:job.id,attemptToken:a.attemptToken})).allowed,false);}));

test('late superseded outcome reports do not block the bridge or repeat sends',()=>fixture(async c=>{
 await c.configure();await c.place();const {job}=await c.api('claim');const a=await c.api('authorize',{jobId:job.id,claimToken:job.claimToken});
 await c.api('outcome',{jobId:job.id,attemptToken:a.attemptToken,result:'UNCERTAIN'});
 await c.tx(s=>s.historyAction(owner,{action:'retry',jobId:job.id,confirmation:'I CHECKED THE GROUP AND NO MESSAGE WAS SENT'}));
 assert.equal((await c.api('outcome',{jobId:job.id,attemptToken:a.attemptToken,result:'UNCERTAIN'})).superseded,true);
 assert.equal((await c.jobs())[0].status,'QUEUED');
 const messageId='true_120363000000002@g.us_LATE12345';
 await c.api('outcome',{jobId:job.id,attemptToken:a.attemptToken,result:'SENT',messageId});
 assert.equal((await c.jobs())[0].status,'UNCERTAIN');assert.equal((await c.control()).stopped,true);
 await c.api('ack',{jobId:job.id,attemptToken:a.attemptToken,messageId,ack:2});
 assert.equal((await c.jobs())[0].ack,2);assert.equal((await c.api('claim')).job,null);
}));

test('Oye is skipped without deleting the order, and a correction to Oye revokes the final send',()=>fixture(async c=>{
 await c.configure();
 await c.available(1,['EK']);
 const oye=await c.place({state:'EK',lga:'',streetAddress:'Fictional road, Oye-Ekiti, Ekiti State'});
 assert.equal((await c.api('claim')).job,null);
 const rejected=(await c.jobs())[0];
 assert.equal(rejected.status,'SKIPPED');
 assert.equal(rejected.reason,'SELLIGATE_LGA_NOT_COVERED');
 assert.equal((await c.q('SELECT count(*)::int AS count FROM public.orders WHERE id=$1',[oye.id])).rows[0].count,1);
 const ado=await c.place({state:'EK',lga:'Ado Ekiti'});
 const {job}=await c.api('claim');
 assert.ok(job);
 const allowed=await c.api('authorize',{jobId:job.id,claimToken:job.claimToken});
 assert.equal(allowed.allowed,true);
 assert.match(allowed.message,/LGA: Ado Ekiti/);
 assert.equal((await c.api('permit',{jobId:job.id,attemptToken:allowed.attemptToken})).allowed,true);
 await c.q('UPDATE public.orders SET address_json=$2 WHERE id=$1',[ado.id,JSON.stringify({stateCode:'EK',lga:'Oye',streetAddress:'Fictional street, Oye Ekiti'})]);
 assert.equal((await c.api('permit',{jobId:job.id,attemptToken:allowed.attemptToken})).allowed,false);
}));

test('OFF preview compares Ado Ekiti and Oye without queueing a message',()=>fixture(async c=>{
 await c.available(1,['EK']);
 const preview=lga=>c.tx(s=>s.simulation(owner,{action:'simulate',productId:1,state:'EK',lga,quantity:1}));
 const a=await preview('Ado Ekiti'),b=await preview('Oye');
 assert.equal(a.dryRun,true);
 assert.match(a.message,/TEST ONLY[\s\S]*LGA: Ado Ekiti/);
 assert.equal(b.result.area.reason,'SELLIGATE_LGA_NOT_COVERED');
 assert.match(b.message,/No dispatch:.*outside/);
 assert.equal((await c.jobs()).length,0);
 assert.equal((await c.q('SELECT count(*)::int AS count FROM public.orders')).rows[0].count,0);
}));
