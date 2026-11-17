import {getPostgresPool} from '../db';
import {DispatchError,RELEASE} from './core';
import {SelligateService} from './service';
import {validSignature} from './protocol';
export const gates=()=>({liveAllowed:process.env.SELLIGATE_LIVE_ALLOWED==='true',validatedBuild:process.env.SELLIGATE_VALIDATED_BUILD===RELEASE});
export async function transact<T>(work:(service:SelligateService)=>Promise<T>){const c=await getPostgresPool().connect();try{await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='10s'");const value=await work(new SelligateService(c,gates()));await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
export async function readBody(request:Request){if(Number(request.headers.get('content-length'))>150000)throw new DispatchError('REQUEST_TOO_LARGE',413);const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;if(reader){while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>150000){await reader.cancel();throw new DispatchError('REQUEST_TOO_LARGE',413);}chunks.push(value);}}return Buffer.concat(chunks).toString('utf8');}
export function jsonBody(raw:string):Record<string,unknown>{let v;try{v=JSON.parse(raw);}catch{throw new DispatchError('INVALID_JSON');}if(!v||typeof v!=='object'||Array.isArray(v))throw new DispatchError('INVALID_JSON');return v;}
export const privateJson=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store, private','pragma':'no-cache','x-content-type-options':'nosniff'}});
export function failure(e:unknown){if(e instanceof DispatchError)return privateJson({error:e.code},e.status);const code=(e as {code?:string})?.code;return privateJson({error:code==='42P01'||code==='3F000'?'SELLIGATE_MIGRATION_REQUIRED':'SELLIGATE_TEMPORARILY_UNAVAILABLE'},503);}
export async function authenticateBridge(request:Request,raw:string){
 let keys:Record<string,string>={};try{keys=JSON.parse(process.env.SELLIGATE_BRIDGE_KEYS||'{}');}catch{throw new DispatchError('BRIDGE_NOT_CONFIGURED',503);}
 const url=new URL(request.url);if(url.search)throw new DispatchError('UNAUTHORISED_BRIDGE',401);
 if(!validSignature(request.headers,request.method,url.pathname,raw,keys))throw new DispatchError('UNAUTHORISED_BRIDGE',401);
 // Consume before the business transaction; failed commands cannot be replayed.
 const result=await getPostgresPool().query("INSERT INTO selligate.nonces(key_id,nonce,expires_at) VALUES($1,$2,now()+interval '2 minutes') ON CONFLICT DO NOTHING RETURNING nonce",[request.headers.get('x-selligate-key'),request.headers.get('x-selligate-nonce')]);
 if(!result.rows.length)throw new DispatchError('REPLAY_REJECTED',409);
}
