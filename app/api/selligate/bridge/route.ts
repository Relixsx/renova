import {DispatchError} from '../../../../selligate/core';
import {authenticateBridge,failure,jsonBody,privateJson,readBody,transact} from '../../../../selligate/backend';
import {getPostgresPool} from '../../../../db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{const raw=await readBody(request);await authenticateBridge(request,raw);const i=jsonBody(raw);if(i.action!=='heartbeat'){const c=(await getPostgresPool().query("SELECT instance_id FROM selligate.connection WHERE id=1 AND heartbeat_at>now()-interval '25 seconds'",[])).rows[0];if(!c||c.instance_id!==i.instanceId)throw new DispatchError('BRIDGE_LEASE_REQUIRED',409);}const value=await transact(s=>{switch(i.action){case 'heartbeat':return s.heartbeat(i);case 'claim':return s.claim();case 'authorize':return s.authorize(i);case 'permit':return s.permit(i);case 'reject':return s.reject(i);case 'outcome':return s.outcome(i);case 'ack':return s.acknowledge(i);default:throw new DispatchError('UNKNOWN_ACTION');}});return privateJson(value);}catch(e){return failure(e);}}
