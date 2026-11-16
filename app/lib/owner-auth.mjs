import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as schema from '../../db/owner-schema.mjs';
import { siteOrigin, trustedOwnerOrigins } from './owner-settings.mjs';

export async function sendOwnerResetEmail({user,url},env=process.env) {
  const key=env.RESEND_API_KEY?.trim(),from=env.RESEND_FROM_EMAIL?.trim() || env.ORDER_FROM_EMAIL?.trim();
  if(!key||!from)throw new Error('Owner password recovery email is not configured.');
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},
    body:JSON.stringify({from,to:[user.email],subject:'Reset your Renova owner password',text:`A password reset was requested for your Renova owner account.\n\nOpen this secure link within 15 minutes:\n${url}\n\nIf you did not request this, you can ignore this email.`}),
    signal:AbortSignal.timeout(15000),
  });
  if(!response.ok)throw new Error('The owner recovery email could not be sent.');
}

/** @param {any} database @param {Record<string,string|undefined>} env @param {any} [sendReset] */
export function createOwnerAuth(database,env=process.env,sendReset=(data)=>sendOwnerResetEmail(data,env)) {
  const secret=env.BETTER_AUTH_SECRET?.trim();
  if(!secret||secret.length<32)throw new Error('BETTER_AUTH_SECRET must contain at least 32 random characters.');
  return betterAuth({
    appName:'Renova owner console',baseURL:siteOrigin(env),basePath:'/api/auth',secret,
    database:drizzleAdapter(database,{provider:'pg',schema,transaction:true}),
    trustedOrigins:trustedOwnerOrigins(env),
    emailAndPassword:{enabled:true,disableSignUp:true,minPasswordLength:12,maxPasswordLength:128,requireEmailVerification:true,resetPasswordTokenExpiresIn:900,revokeSessionsOnPasswordReset:true,sendResetPassword:sendReset},
    session:{expiresIn:60*60*12,updateAge:60*30,cookieCache:{enabled:false}},
    account:{accountLinking:{enabled:false}},
    advanced:{cookiePrefix:'renova_owner',useSecureCookies:env.NODE_ENV==='production',ipAddress:{ipAddressHeaders:[]}},
    rateLimit:{enabled:true,storage:'database',window:60,max:40,customRules:{'/sign-in/email':{window:60,max:5},'/request-password-reset':{window:300,max:3},'/reset-password':{window:60,max:5}}},
    logger:{disabled:true},
  });
}
