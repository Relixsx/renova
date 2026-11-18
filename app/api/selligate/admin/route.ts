import {currentUser,requireOwnerRequest} from '../../../lib/admin-auth';
import {failure,jsonBody,privateJson,readBody,transact} from '../../../../selligate/backend';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){const denied=await requireOwnerRequest(request);if(denied)return denied;try{return privateJson(await transact(s=>s.dashboard()));}catch(e){return failure(e);}}
export async function POST(request:Request){const denied=await requireOwnerRequest(request);if(denied)return denied;try{const actor=(await currentUser())?.email;if(!actor)return privateJson({error:'SIGN_IN_REQUIRED'},401);const input=jsonBody(await readBody(request));const action=String(input.action);const result=await transact<unknown>(s=>['simulate','sendTest'].includes(action)?s.simulation(actor,input):['retry','previewJob','markManual'].includes(action)?s.historyAction(actor,input):s.configure(actor,input));return privateJson(result);}catch(e){return failure(e);}}
