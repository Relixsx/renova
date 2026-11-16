import ts from 'typescript';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(join(root,'node_modules/.cache'),{recursive:true});
const output=await mkdtemp(join(root,'node_modules/.cache/renova-aiven-test-'));
const files=['db/index.ts','db/schema.ts','app/lib/store-writer.ts','app/lib/admin-auth.ts','app/lib/owner-recovery.ts','app/lib/whatsapp-webhook-security.ts','app/api/migration/status/route.ts','proxy.ts'];
try {
 for(const file of files){
  let source=await readFile(join(root,file),'utf8');
  if(file==='app/lib/admin-auth.ts'){
   source=source.replace(/import\s*\{\s*createNeonAuth\s*\}\s*from\s*"@neondatabase\/auth\/next\/server";/,'const createNeonAuth = () => ({ handler: () => ({}) });');
   source=source.replace(/import\s*\{[\s\S]*?extractNeonAuthCookies,[\s\S]*?parseSessionData,[\s\S]*?\}\s*from\s*"@neondatabase\/auth\/server";/,'const extractNeonAuthCookies = (h) => h.get("cookie") || ""; const parseSessionData = (data) => data;');
   source=source.replace('import { headers } from "next/headers";','const headers = async () => globalThis[Symbol.for("renova.aiven.test.headers")] || new Headers();');
   source=source.replace('import { redirect } from "next/navigation";','const redirect = () => { throw new Error("Redirect required"); };');
  }
  if(file==='proxy.ts')source=source.replace('import { NextRequest, NextResponse } from "next/server";','type NextRequest = Request & {nextUrl: URL}; const NextResponse = {next: () => new Response(null, {headers:{"x-renova-test-pass":"yes"}})};');
  source=source.replace(/from\s+["'](\.[^"']+)["']/g,(whole,path)=>{
   if(path.endsWith('.mjs'))return whole;
   const target=resolve(dirname(join(root,file)),path);
   return `from ${JSON.stringify(target===join(root,'db')?path+'/index.mjs':path+'.mjs')}`;
  });
  const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},fileName:file});
  const target=join(output,file.replace(/\.ts$/,'.mjs'));await mkdir(dirname(target),{recursive:true});await writeFile(target,result.outputText);
 }
 for(const file of ['db/owner-schema.mjs','app/lib/postgres-config.mjs','app/lib/owner-auth.mjs','app/lib/owner-settings.mjs','app/lib/migration-mode.mjs','app/lib/owner-order-email.mjs']){
  const target=join(output,file);await mkdir(dirname(target),{recursive:true});await writeFile(target,await readFile(join(root,file),'utf8'));
 }
 const result=spawnSync(process.execPath,['--test','--test-concurrency=1','tests/aiven-owner.test.mjs','tests/aiven-migration.test.mjs'],{cwd:root,stdio:'inherit',env:{...process.env,DATABASE_URL:'',RENOVA_AIVEN_TEST_BUILD:output,NEXT_TELEMETRY_DISABLED:'1'}});
 process.exitCode=result.status??1;
}finally{await rm(output,{recursive:true,force:true});}
