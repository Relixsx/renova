import { MIGRATION_REVISION } from '../app/lib/migration-mode.mjs';
try {
 const secret=process.env.MIGRATION_CONTROL_SECRET?.trim();
 if(!secret||secret.length<32)throw new Error();
 const response=await fetch('https://shoprenova.com.ng/api/migration/status?check='+Date.now(),{headers:{authorization:`Bearer ${secret}`},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error();
 const data=await response.json();
 if(data.revision!==MIGRATION_REVISION)throw new Error();
 console.log(`Migration code: ${data.revision}\nMode: ${data.mode}\nProvider: ${data.provider}\nDatabase: ${data.database}\nOrders: ${data.orders}; products: ${data.products}\nAiven owner tables present: ${data.owner_schema===true?'yes':'no'}`);
 if(data.orderEmail)console.log(`Owner order email: ${data.orderEmail.recipient}; configured: ${data.orderEmail.configured===true?'yes':'no'}`);
 console.log('This checks configuration and store counts. Confirm owner sign-in and the final database name before reopening.');
}catch{console.error('The private migration status could not be verified. Confirm the new commit is Live and that MIGRATION_CONTROL_SECRET matches Render. No configuration was changed.');process.exitCode=1;}
