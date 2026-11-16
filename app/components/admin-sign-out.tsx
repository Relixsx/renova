"use client";
import { useState } from "react";
export function AdminSignOut() {
  const [busy,setBusy]=useState(false),[error,setError]=useState(false);
  async function signOut(){setBusy(true);setError(false);try{const response=await fetch('/api/auth/sign-out',{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error();window.location.assign('/admin/login');}catch{setBusy(false);setError(true);}}
  return <><button type="button" onClick={signOut} disabled={busy} style={{background:'transparent',border:0,padding:0,textAlign:'left',color:'inherit',cursor:'pointer'}}>{busy?'Signing out…':'Sign out'}</button>{error?<small role="alert">Sign-out could not complete. Try again.</small>:null}</>;
}
