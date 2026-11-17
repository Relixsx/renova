import {requireOwnerPage} from '../../lib/admin-auth';
import {SelligateConsole} from '../../components/selligate-console';
export const dynamic='force-dynamic';
export const metadata={title:'Selligate WhatsApp Automation',robots:{index:false,follow:false}};
export default async function SelligatePage(){const {authorised}=await requireOwnerPage();if(!authorised)return <main className="admin-access"><h1>This owner console is private.</h1><a href="/admin/login">Sign in as an approved owner</a></main>;return <SelligateConsole/>;}
