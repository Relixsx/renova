import {build} from 'esbuild';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd();await mkdir(join(root,'node_modules/.cache'),{recursive:true});
const output=await mkdtemp(join(root,'node_modules/.cache/selligate-'));
try{
 await build({entryPoints:{core:'selligate/core.ts',areas:'selligate/delivery-areas.ts',service:'selligate/service.ts',protocol:'selligate/protocol.ts',runner:'bridge/src/runner.ts',journal:'bridge/src/journal.ts'},bundle:true,platform:'node',format:'esm',packages:'external',outdir:output,outExtension:{'.js':'.mjs'},logLevel:'warning'});
 await build({entryPoints:{admin:'app/api/selligate/admin/route.ts',bridge:'app/api/selligate/bridge/route.ts'},bundle:true,platform:'node',format:'esm',packages:'external',outdir:output,outExtension:{'.js':'.mjs'},logLevel:'warning',plugins:[{name:'isolated-owner-and-database',setup(b){
  b.onResolve({filter:/admin-auth$/},()=>({path:'owner',namespace:'fixtures'}));
  b.onResolve({filter:/^(?:\.\.\/)+db$/},()=>({path:'db',namespace:'fixtures'}));
  b.onLoad({filter:/.*/,namespace:'fixtures'},a=>({contents:a.path==='db'?'export function getPostgresPool(){return globalThis.__SELLIGATE_TEST_POOL__}':"export async function requireOwnerRequest(r){if(r.headers.get('x-test-owner')!=='yes')return Response.json({error:'OWNER_ONLY'},{status:403});if(r.method==='POST'&&r.headers.get('origin')!=='https://shoprenova.com.ng')return Response.json({error:'ORIGIN_REQUIRED'},{status:403});return null;} export async function currentUser(){return {email:'owner@example.test'}}",loader:'js'}));
 }}]});
 const result=spawnSync(process.execPath,['--test','--test-concurrency=1','tests/selligate/core.test.mjs','tests/selligate/integration.test.mjs','tests/selligate/bridge.test.mjs','tests/selligate/security.test.mjs'],{stdio:'inherit',env:{...process.env,DATABASE_URL:'',SELLIGATE_LIVE_ALLOWED:'false',SELLIGATE_VALIDATED_BUILD:'',SELLIGATE_TEST_BUILD:output}});
 process.exitCode=result.status??1;
}finally{await rm(output,{recursive:true,force:true});}
